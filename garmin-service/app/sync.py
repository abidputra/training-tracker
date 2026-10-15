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
from datetime import datetime, timezone

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from . import crypto, db

log = logging.getLogger("garmin.sync")

# Prevents two overlapping "sync everyone" runs if cron fires while one is busy.
_sync_all_lock = threading.Lock()

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


def sync_connection(conn: dict, limit: int = 20) -> dict:
    """
    Pulls the latest `limit` activities for one connection and upserts them.

    Returns {"status": "active"|"needs_reauth"|"error", "imported": int, "error": str|None}.
    Never raises: failures are recorded on the connection row.
    """
    cid, uid = conn["id"], conn["user_id"]
    with _active_lock:
        if cid in _active:
            return {"status": "active", "imported": 0, "error": None}
        _active.add(cid)
    try:
        return _sync_connection(cid, uid, limit)
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


def _sync_connection(cid: str, uid: str, limit: int) -> dict:
    try:
        stored = db.select("provider_tokens", {"connection_id": f"eq.{cid}", "select": "token_blob"})
        if not stored or not stored[0].get("token_blob"):
            raise GarminConnectAuthenticationError("No stored Garmin session")
        token_json = crypto.decrypt(stored[0]["token_blob"])

        g = _login_from_tokens(token_json)  # refreshes the access token if needed

        raw = g.get_activities(0, limit)
        if isinstance(raw, dict):  # defensive: some versions wrap the list
            raw = raw.get("activities", [])
        candidates = [a for a in raw if a.get("activityId")]
        rows = [r for r in (map_activity(uid, a) for a in candidates) if r]
        skipped = len(candidates) - len(rows)
        if skipped:
            log.warning("skipped %d garmin activities without a UTC start time", skipped)
        if rows:
            db.upsert("activities", rows, on_conflict="user_id,provider,external_id")

        # The library may have refreshed the session; keep the newest tokens.
        fresh = g.client.dumps()
        if fresh != token_json:
            db.patch("provider_tokens", {"connection_id": f"eq.{cid}"}, {"token_blob": crypto.encrypt(fresh)})

        _set_status(cid, "active", None, synced=True)
        return {"status": "active", "imported": len(rows), "error": None}

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
