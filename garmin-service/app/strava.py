"""
Strava import: OAuth, token refresh, and polling sync (no webhooks).

Purpose here is mainly OLDER HISTORY: we import whatever Strava has for each
activity and leave the rest null (the summary API has no running dynamics).
Runs that Garmin already has are de-duplicated in the dashboard, not here, so
nothing is ever lost and the rule can change without re-importing.

Tokens are Fernet-encrypted (same key as Garmin sessions) before they are
written to `provider_tokens`. Strava rotates refresh tokens, so every refresh
is persisted.
"""
import logging
import re
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx

from . import crypto, db
from .settings import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET

log = logging.getLogger("strava.sync")

API = "https://www.strava.com/api/v3"
OAUTH = "https://www.strava.com/oauth"
PAGE = 200  # Strava's maximum per_page
MAX_PAGES = 100  # 20,000 activities; a safety cap
PAUSE_S = 1.0

# Connections being synced right now (manual sync vs. background import).
_active: set[str] = set()
_active_lock = threading.Lock()


class StravaAuthError(Exception):
    """Strava rejected our authorization (revoked or expired refresh token)."""


class StravaRateLimited(Exception):
    """HTTP 429 from Strava."""


def configured() -> bool:
    return bool(STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)


def is_busy(connection_id: str) -> bool:
    with _active_lock:
        return connection_id in _active


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- OAuth -------------------------------------------------------------------

def _token_request(params: dict) -> httpx.Response:
    return httpx.post(
        f"{OAUTH}/token",
        data={"client_id": STRAVA_CLIENT_ID, "client_secret": STRAVA_CLIENT_SECRET, **params},
        timeout=20,
    )


def exchange_code(code: str) -> dict:
    """Trades the OAuth `code` for tokens + athlete info."""
    r = _token_request({"code": code, "grant_type": "authorization_code"})
    if r.status_code in (400, 401):
        raise StravaAuthError("Strava rejected the authorization code")
    r.raise_for_status()
    return r.json()


def _store_tokens(connection_id: str, t: dict) -> None:
    db.upsert(
        "provider_tokens",
        {
            "connection_id": connection_id,
            "access_token": crypto.encrypt(t["access_token"]),
            "refresh_token": crypto.encrypt(t["refresh_token"]),
            "expires_at": datetime.fromtimestamp(t["expires_at"], timezone.utc).isoformat(),
        },
        on_conflict="connection_id",
    )


def save_connection(user_id: str, tokens: dict) -> dict:
    """Creates/updates the user's Strava connection and stores encrypted tokens."""
    athlete_id = (tokens.get("athlete") or {}).get("id")
    if not athlete_id:
        raise ValueError("Strava did not return an athlete id")
    rows = db.upsert(
        "connections",
        {
            "user_id": user_id,
            "provider": "strava",
            "external_id": str(athlete_id),
            "status": "active",
            "last_error": None,
        },
        on_conflict="user_id,provider",
        returning=True,
    )
    conn = rows[0]
    _store_tokens(conn["id"], tokens)
    return conn


def _access_token(connection_id: str) -> str:
    """A valid access token, refreshed (and persisted) if it expires within 5 minutes."""
    rows = db.select(
        "provider_tokens",
        {"connection_id": f"eq.{connection_id}", "select": "access_token,refresh_token,expires_at"},
    )
    if not rows or not rows[0].get("refresh_token"):
        raise StravaAuthError("No stored Strava tokens")
    t = rows[0]
    expires = datetime.fromisoformat(t["expires_at"].replace("Z", "+00:00"))
    if expires - _now() > timedelta(minutes=5):
        return crypto.decrypt(t["access_token"])

    r = _token_request({"grant_type": "refresh_token", "refresh_token": crypto.decrypt(t["refresh_token"])})
    if r.status_code in (400, 401):
        raise StravaAuthError("Strava authorization expired or was revoked")
    r.raise_for_status()
    fresh = r.json()
    _store_tokens(connection_id, fresh)
    return fresh["access_token"]


def deauthorize(connection_id: str) -> None:
    """Best effort: tell Strava to revoke our access. Never raises."""
    try:
        httpx.post(f"{OAUTH}/deauthorize", data={"access_token": _access_token(connection_id)}, timeout=15)
    except Exception as e:  # token already dead, network, etc.
        log.info("strava deauthorize skipped: %s", type(e).__name__)


# --- Mapping -----------------------------------------------------------------

_SPORTS = {
    "Run": "running",
    "TrailRun": "trail_running",
    "VirtualRun": "virtual_run",
    "Walk": "walking",
    "Hike": "hiking",
    "Ride": "cycling",
    "VirtualRide": "virtual_ride",
    "MountainBikeRide": "mountain_biking",
    "GravelRide": "gravel_cycling",
    "EBikeRide": "cycling",
    "Swim": "swimming",
    "WeightTraining": "strength_training",
    "Yoga": "yoga",
}


def _sport(a: dict) -> str | None:
    """Maps Strava sport names onto the lowercase vocabulary Garmin rows use."""
    s = a.get("sport_type") or a.get("type") or ""
    if s == "Run" and a.get("trainer"):
        return "treadmill_running"
    if s in _SPORTS:
        return _SPORTS[s]
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower() or None


def map_activity(user_id: str, a: dict) -> dict | None:
    """Strava SummaryActivity -> `activities` row. None if it can't be stored."""
    if not a.get("id") or not a.get("start_date"):
        return None
    return {
        "user_id": user_id,
        "provider": "strava",
        "external_id": str(a["id"]),
        "name": a.get("name"),
        "sport_type": _sport(a),
        "start_time": a["start_date"],  # ISO 8601, UTC
        "distance_m": a.get("distance"),
        "moving_time_s": a.get("moving_time"),
        "elapsed_time_s": a.get("elapsed_time"),
        "elevation_gain_m": a.get("total_elevation_gain"),
        "avg_hr": a.get("average_heartrate"),
        "max_hr": a.get("max_heartrate"),
        "avg_speed_mps": a.get("average_speed"),
        "calories": a.get("calories"),  # not in the summary representation; usually null
        "raw": a,
        "updated_at": _now().isoformat(),
    }


# --- Sync --------------------------------------------------------------------

def _set_status(connection_id: str, status: str, error: str | None, synced: bool = False) -> None:
    values = {"status": status, "last_error": error}
    if synced:
        values["last_synced_at"] = _now().isoformat()
    db.patch("connections", {"id": f"eq.{connection_id}"}, values)


def _list_page(token: str, page: int, per_page: int) -> list[dict]:
    r = httpx.get(
        f"{API}/athlete/activities",
        params={"page": page, "per_page": per_page},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if r.status_code == 429:
        raise StravaRateLimited()
    if r.status_code == 401:
        raise StravaAuthError("Strava rejected the access token")
    r.raise_for_status()
    return r.json()


def sync_connection(conn: dict, everything: bool = False, limit: int = 50) -> dict:
    """
    Imports the latest `limit` activities, or the whole history with
    `everything=True`. Pages are saved as they arrive, so a rate limit halfway
    keeps what was imported and a re-run simply continues (upserts).

    Returns {"status": "active"|"needs_reauth"|"error", "imported": int, "error": str|None}.
    Never raises: failures are recorded on the connection row.
    """
    cid, uid = conn["id"], conn["user_id"]
    with _active_lock:
        if cid in _active:
            return {"status": "active", "imported": 0, "error": None}
        _active.add(cid)
    imported = 0
    try:
        token = _access_token(cid)
        per_page = PAGE if everything else limit
        for page in range(1, (MAX_PAGES if everything else 1) + 1):
            raw = _list_page(token, page, per_page)
            if not raw:
                break
            rows = [r for r in (map_activity(uid, a) for a in raw) if r]
            if rows:
                db.upsert("activities", rows, on_conflict="user_id,provider,external_id")
                imported += len(rows)
            if not everything or len(raw) < per_page:
                break
            time.sleep(PAUSE_S)
        _set_status(cid, "active", None, synced=True)
        return {"status": "active", "imported": imported, "error": None}

    except StravaAuthError:
        msg = "Strava authorization expired. Please reconnect Strava."
        _set_status(cid, "needs_reauth", msg)
        return {"status": "needs_reauth", "imported": imported, "error": msg}
    except StravaRateLimited:
        # Strava allows ~100 requests / 15 min for new apps. Keep healthy, retry later.
        msg = "Strava is rate limiting requests. Try again in 15 minutes."
        _set_status(cid, "active", msg)
        return {"status": "active", "imported": imported, "error": msg}
    except Exception as e:  # network, schema change, etc.
        log.warning("strava sync failed for connection %s: %s", cid, type(e).__name__)
        msg = "Strava sync failed. Try again later."
        _set_status(cid, "error", msg)
        return {"status": "error", "imported": imported, "error": msg}
    finally:
        with _active_lock:
            _active.discard(cid)
