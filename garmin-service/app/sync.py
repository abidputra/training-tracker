"""
Garmin sync logic: activity mapping, token persistence, per-connection sync.

Design notes
- Passwords are NEVER stored. After the one-time login we keep only the
  session tokens (garminconnect >= 0.3 returns them via `client.dumps()`),
  Fernet-encrypted, in `provider_tokens.token_blob`.
- Later runs do `Garmin().login(<token json string>)`. The library refreshes
  the access token on its own; if it did, we persist the new tokens.
- If Garmin rejects the stored session the connection is flagged
  `needs_reauth` and the UI asks the user to log in again.
"""
import logging
import threading
import time
from datetime import date, datetime, timedelta, timezone

from cryptography.fernet import InvalidToken
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from . import crypto, db, gpx, splits

log = logging.getLogger("garmin.sync")

# Prevents two overlapping "sync everyone" runs if cron fires while one is busy.
_sync_all_lock = threading.Lock()

# Full-history import: pages of 100, a pause between pages, and a hard cap
# (200 pages = 20,000 activities) so a misbehaving API can't loop forever.
BACKFILL_PAGE = 100
BACKFILL_PAUSE_S = 2.0
BACKFILL_MAX_PAGES = 200

# Daily wellness (HRV, sleep, weight) lookback in days: a regular sync only
# needs the last few nights; a full import pulls about half a year.
WELLNESS_DAYS = 7
WELLNESS_DAYS_BACKFILL = 180
HRV_CHUNK_DAYS = 28  # keep each HRV range request modest

# Connections being synced right now. Stops a manual "sync now" and the cron
# run from refreshing and overwriting the same token blob at the same time.
_active: set[str] = set()
_active_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_gmt(value: str | None) -> str | None:
    """Garmin's startTimeGMT looks like '2026-10-14 05:30:00' (UTC)."""
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()


def map_activity(user_id: str, a: dict) -> dict | None:
    """
    Maps one Garmin activity dict to a normalized `activities` row.
    Returns None when the activity has no usable UTC start time: `start_time`
    is NOT NULL, and one bad row would otherwise fail the whole bulk upsert.
    (startTimeLocal is deliberately not used: it is local time, not UTC.)
    """
    try:
        start = _parse_gmt(a.get("startTimeGMT"))
    except ValueError:
        start = None
    if not start:
        return None
    return {
        "user_id": user_id,
        "provider": "garmin",
        "external_id": str(a["activityId"]),
        "name": a.get("activityName"),
        "sport_type": (a.get("activityType") or {}).get("typeKey"),
        "start_time": start,
        "distance_m": a.get("distance"),
        "moving_time_s": a.get("movingDuration") or a.get("duration"),
        "elapsed_time_s": a.get("elapsedDuration") or a.get("duration"),
        "elevation_gain_m": a.get("elevationGain"),
        "avg_hr": a.get("averageHR"),
        "max_hr": a.get("maxHR"),
        "avg_speed_mps": a.get("averageSpeed"),
        "calories": a.get("calories"),
        "raw": a,
        "updated_at": _now_iso(),
    }


def _num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def _wellness_hrv(g: Garmin, uid: str, start: date, end: date) -> list[dict]:
    rows = []
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=HRV_CHUNK_DAYS - 1), end)
        data = g.get_hrv_data_range(cur.isoformat(), chunk_end.isoformat()) or {}
        for h in data.get("hrvSummaries") or []:
            if not h.get("calendarDate"):
                continue
            base = h.get("baseline") or {}
            rows.append({
                "user_id": uid,
                "day": h["calendarDate"],
                "hrv_last_night": _num(h.get("lastNightAvg")),
                "hrv_weekly_avg": _num(h.get("weeklyAvg")),
                "hrv_status": h.get("status"),
                "hrv_baseline_low": _num(base.get("balancedLow")),
                "hrv_baseline_high": _num(base.get("balancedUpper")),
                "updated_at": _now_iso(),
            })
        cur = chunk_end + timedelta(days=1)
    return rows


def _wellness_sleep(g: Garmin, uid: str, start: date, end: date) -> list[dict]:
    rows = []
    for s in g.get_sleep_daily(start.isoformat(), end.isoformat()) or []:
        v = s.get("values") or s
        score = v.get("sleepScore")
        if isinstance(score, dict):  # defensive: some payloads nest {"value": n}
            score = score.get("value")
        seconds = _num(v.get("totalSleepTimeInSeconds")) or _num(v.get("sleepTimeSeconds"))
        if score is None and seconds is None:
            continue  # no sleep recorded that night
        rows.append({
            "user_id": uid,
            "day": s["calendarDate"],
            "sleep_score": _num(score),
            "sleep_quality": v.get("sleepScoreQuality"),
            "sleep_seconds": seconds,
            "resting_hr": _num(v.get("restingHeartRate")),
            "updated_at": _now_iso(),
        })
    return rows


def _wellness_weight(g: Garmin, uid: str, start: date, end: date) -> list[dict]:
    data = g.get_body_composition(start.isoformat(), end.isoformat()) or {}
    by_day: dict[str, float] = {}
    for w in sorted(data.get("dateWeightList") or [], key=lambda w: w.get("date") or 0):
        if w.get("calendarDate") and _num(w.get("weight")):
            by_day[w["calendarDate"]] = w["weight"] / 1000  # grams -> kg; last weigh-in of the day wins
    rows = [
        {"user_id": uid, "day": d, "weight_kg": kg, "weight_source": "weigh_in", "updated_at": _now_iso()}
        for d, kg in by_day.items()
    ]
    if not rows:
        # No weigh-ins in the window: fall back to the weight set in the Garmin profile.
        profile = (g.get_user_profile() or {}).get("userData") or {}
        if _num(profile.get("weight")):
            rows.append({
                "user_id": uid,
                "day": datetime.now(timezone.utc).date().isoformat(),
                "weight_kg": profile["weight"] / 1000,
                "weight_source": "profile",
                "updated_at": _now_iso(),
            })
    return rows


def sync_wellness(g: Garmin, uid: str, days: int) -> int:
    """
    Upserts HRV, sleep and weight into `daily_metrics` for the last `days` days.
    Each source is saved on its own (an upsert only touches the columns it
    sends), and a failure in one never fails the activity sync.
    Rate limiting propagates so the caller handles it like any other sync.
    """
    end = datetime.now(timezone.utc).date() + timedelta(days=1)  # users ahead of UTC are already "tomorrow"
    start = end - timedelta(days=days)
    saved = 0
    for name, fetch in (("hrv", _wellness_hrv), ("sleep", _wellness_sleep), ("weight", _wellness_weight)):
        try:
            rows = fetch(g, uid, start, end)
            if rows:
                db.upsert("daily_metrics", rows, on_conflict="user_id,day")
                saved += len(rows)
        except GarminConnectTooManyRequestsError:
            raise
        except Exception as e:
            log.warning("wellness %s sync failed: %s", name, type(e).__name__)
    return saved


def save_connection(user_id: str, token_json: str) -> dict:
    """Creates/updates the user's Garmin connection and stores encrypted tokens."""
    rows = db.upsert(
        "connections",
        {"user_id": user_id, "provider": "garmin", "status": "active", "last_error": None},
        on_conflict="user_id,provider",
        returning=True,
    )
    conn = rows[0]
    db.upsert(
        "provider_tokens",
        {"connection_id": conn["id"], "token_blob": crypto.encrypt(token_json)},
        on_conflict="connection_id",
    )
    return conn


def _set_status(connection_id: str, status: str, error: str | None, synced: bool = False) -> None:
    values = {"status": status, "last_error": error}
    if synced:
        values["last_synced_at"] = _now_iso()
    db.patch("connections", {"id": f"eq.{connection_id}"}, values)


def is_busy(connection_id: str) -> bool:
    with _active_lock:
        return connection_id in _active


def mark_needs_reauth(connection_id: str) -> None:
    """The stored Garmin session was rejected: ask the user to log in again."""
    _set_status(connection_id, "needs_reauth", "Garmin session expired. Please log in to Garmin again.")


class RouteBusy(Exception):
    """A sync is running on this connection, so the token blob must not be touched now."""


class TokenKeyMismatch(Exception):
    """The stored session was encrypted with a different TOKEN_ENCRYPTION_KEY than this server has."""


# Route downloads go one at a time (be gentle with Garmin).
_route_lock = threading.Lock()


def fetch_route(conn: dict, external_id: str) -> list[list]:
    """
    Downloads ONE activity's GPX from Garmin and returns the thinned track
    ([] when the activity has no GPS). Uses the stored session and keeps the
    refreshed tokens, exactly like a sync, and never overlaps one (RouteBusy).
    Raises the library's Garmin* errors for the caller to map to HTTP.
    """
    cid = conn["id"]
    with _route_lock:
        with _active_lock:
            if cid in _active:
                raise RouteBusy()
            _active.add(cid)
        try:
            stored = db.select("provider_tokens", {"connection_id": f"eq.{cid}", "select": "token_blob"})
            if not stored or not stored[0].get("token_blob"):
                raise GarminConnectAuthenticationError("No stored Garmin session")
            try:
                token_json = crypto.decrypt(stored[0]["token_blob"])
            except InvalidToken as e:
                # Not the user's fault, and not a dead session: leave the connection as it is.
                raise TokenKeyMismatch() from e
            g = _login_from_tokens(token_json)
            data = g.download_activity(external_id, Garmin.ActivityDownloadFormat.GPX)
            fresh = g.client.dumps()
            if fresh != token_json:
                db.patch("provider_tokens", {"connection_id": f"eq.{cid}"}, {"token_blob": crypto.encrypt(fresh)})
            return gpx.parse_track(data)
        finally:
            with _active_lock:
                _active.discard(cid)


def fetch_splits(conn: dict, external_id: str) -> dict:
    """
    Laps and per-km splits of ONE activity: {"laps": [...], "splits": [...]} (see splits.py).
    Same session handling as fetch_route: one at a time, never during a sync, refreshed
    tokens are kept. Two Garmin calls: the watch's laps, and the time series the km splits
    are worked out from. If the time series is unavailable, auto-lapped km laps stand in.
    Raises the library's Garmin* errors for the caller to map to HTTP.
    """
    cid = conn["id"]
    with _route_lock:
        with _active_lock:
            if cid in _active:
                raise RouteBusy()
            _active.add(cid)
        try:
            stored = db.select("provider_tokens", {"connection_id": f"eq.{cid}", "select": "token_blob"})
            if not stored or not stored[0].get("token_blob"):
                raise GarminConnectAuthenticationError("No stored Garmin session")
            try:
                token_json = crypto.decrypt(stored[0]["token_blob"])
            except InvalidToken as e:
                raise TokenKeyMismatch() from e
            g = _login_from_tokens(token_json)
            laps = splits.parse_laps(g.get_activity_splits(external_id))
            try:
                km = splits.km_splits(g.get_activity_details(external_id))
            except GarminConnectConnectionError:
                km = []  # no time series for this activity: fall back to the laps below
            if not km:
                km = splits.splits_from_laps(laps)
            fresh = g.client.dumps()
            if fresh != token_json:
                db.patch("provider_tokens", {"connection_id": f"eq.{cid}"}, {"token_blob": crypto.encrypt(fresh)})
            return {"laps": laps, "splits": km}
        finally:
            with _active_lock:
                _active.discard(cid)


def sync_connection(conn: dict, limit: int = 20, everything: bool = False, wellness_days: int | None = None) -> dict:
    """
    Pulls the latest `limit` activities for one connection and upserts them.
    With `everything=True` it pages through the user's entire Garmin history.
    Also refreshes daily wellness (HRV, sleep, weight) for `wellness_days`.

    Returns {"status": "active"|"needs_reauth"|"error", "imported": int, "error": str|None}.
    Never raises: failures are recorded on the connection row.
    """
    cid, uid = conn["id"], conn["user_id"]
    with _active_lock:
        if cid in _active:
            return {"status": "active", "imported": 0, "error": None}
        _active.add(cid)
    try:
        days = wellness_days or (WELLNESS_DAYS_BACKFILL if everything else WELLNESS_DAYS)
        return _sync_connection(cid, uid, limit, everything, days)
    finally:
        with _active_lock:
            _active.discard(cid)


def _login_from_tokens(token_json: str) -> Garmin:
    """
    Restores a session from stored tokens. We have no credentials here, so if
    the library cannot use the tokens it has nothing to fall back to and raises
    something that is not necessarily GarminConnectAuthenticationError. Any such
    failure (other than rate limiting / network) means the session is dead, so
    normalise it to an auth error and the connection gets flagged needs_reauth.
    """
    g = Garmin()
    try:
        g.login(token_json)
    except (GarminConnectAuthenticationError, GarminConnectTooManyRequestsError, GarminConnectConnectionError):
        raise
    except Exception as e:
        log.info("stored garmin session unusable: %s", type(e).__name__)
        raise GarminConnectAuthenticationError("Stored Garmin session is no longer valid") from e
    return g


def _sync_connection(cid: str, uid: str, limit: int, everything: bool, wellness_days: int) -> dict:
    try:
        stored = db.select("provider_tokens", {"connection_id": f"eq.{cid}", "select": "token_blob"})
        if not stored or not stored[0].get("token_blob"):
            raise GarminConnectAuthenticationError("No stored Garmin session")
        token_json = crypto.decrypt(stored[0]["token_blob"])

        g = _login_from_tokens(token_json)  # refreshes the access token if needed

        imported = 0
        start = 0
        page = BACKFILL_PAGE if everything else limit
        for _ in range(BACKFILL_MAX_PAGES if everything else 1):
            raw = g.get_activities(start, page)
            if isinstance(raw, dict):  # defensive: some versions wrap the list
                raw = raw.get("activities", [])
            if not raw:
                break
            candidates = [a for a in raw if a.get("activityId")]
            rows = [r for r in (map_activity(uid, a) for a in candidates) if r]
            skipped = len(candidates) - len(rows)
            if skipped:
                log.warning("skipped %d garmin activities without a UTC start time", skipped)
            if rows:
                # Saved page by page, so a long backfill shows up live and a
                # rate limit halfway through keeps what was already imported.
                db.upsert("activities", rows, on_conflict="user_id,provider,external_id")
                imported += len(rows)
            if not everything or len(raw) < page:
                break
            start += page
            time.sleep(BACKFILL_PAUSE_S)  # be gentle with Garmin

        sync_wellness(g, uid, wellness_days)

        # The library may have refreshed the session; keep the newest tokens.
        fresh = g.client.dumps()
        if fresh != token_json:
            db.patch("provider_tokens", {"connection_id": f"eq.{cid}"}, {"token_blob": crypto.encrypt(fresh)})

        _set_status(cid, "active", None, synced=True)
        return {"status": "active", "imported": imported, "error": None}

    except GarminConnectAuthenticationError:
        msg = "Garmin session expired. Please log in to Garmin again."
        _set_status(cid, "needs_reauth", msg)
        return {"status": "needs_reauth", "imported": 0, "error": msg}
    except GarminConnectTooManyRequestsError:
        # Temporary. Keep the connection healthy and just try again next run.
        msg = "Garmin is rate limiting requests. Will retry automatically."
        _set_status(cid, "active", msg)
        return {"status": "active", "imported": 0, "error": msg}
    except Exception as e:  # network, schema change, etc.
        log.warning("sync failed for connection %s: %s", cid, type(e).__name__)
        msg = "Sync failed. Will retry automatically."
        _set_status(cid, "error", msg)
        return {"status": "error", "imported": 0, "error": msg}


def sync_all() -> None:
    """
    Syncs every healthy Garmin connection, one at a time with a short pause
    (be gentle: Garmin's unofficial API rate limits aggressively, especially
    when many accounts come from one IP). Skips connections that need re-login.
    """
    if not _sync_all_lock.acquire(blocking=False):
        log.info("sync_all already running, skipping")
        return
    try:
        conns = db.select(
            "connections",
            {"provider": "eq.garmin", "status": "in.(active,error)", "select": "id,user_id"},
        )
        log.info("sync_all: %d connections", len(conns))
        for conn in conns:
            sync_connection(conn)
            time.sleep(3)
    finally:
        _sync_all_lock.release()
