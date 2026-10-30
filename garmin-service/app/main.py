"""
Garmin sync service (FastAPI).

Why a separate service? `python-garminconnect` is Python and logs in with the
user's Garmin credentials, so it can't run in a Deno Edge Function. This small
service does only the Garmin-specific work and talks to the same Supabase DB.

Endpoints
  POST   /garmin/connect       user JWT   {email, password} -> connected | mfa_required
  POST   /garmin/mfa           user JWT   {code}            -> connected
  POST   /garmin/sync          user JWT   manual "sync now" (60s cooldown)
  POST   /garmin/backfill      user JWT   import full history in the background (202)
  GET    /garmin/activities/{id}/route   user JWT   GPS track of one run (downloaded once, then cached)
  POST   /strava/connect       user JWT   {code, scope} -> OAuth finish + history import
  POST   /strava/sync          user JWT   manual sync (60s cooldown)
  POST   /strava/backfill      user JWT   import full history in the background (202)
  DELETE /strava/disconnect    user JWT   revoke + delete tokens and Strava activities
  DELETE /garmin/disconnect    user JWT   deletes tokens + Garmin activities + daily metrics
  POST   /internal/sync-all    X-Service-Secret (pg_cron) -> 202, runs in background
  GET    /health

IMPORTANT: run exactly ONE instance/worker. An in-progress MFA login lives in
this process's memory (the library keeps the pending MFA state on the Garmin
client object), so /garmin/connect and /garmin/mfa must hit the same process.
"""
import logging
import re
import secrets
import threading
import time

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
from pydantic import BaseModel

import httpx

from . import db, strava, sync
from .settings import ALLOWED_ORIGIN_REGEX, ALLOWED_ORIGINS, SERVICE_SECRET

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("garmin.api")

app = FastAPI(title="Garmin sync service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    # The deployed (https) frontend may call this service on http://localhost.
    # Chrome sends a "private network" preflight for that and needs this to
    # succeed. Origins are still restricted by the allow-list above.
    allow_private_network=True,
)



@app.exception_handler(httpx.TransportError)
async def network_error(request, exc):
    """
    Supabase unreachable even after a retry. Answer with a JSON 503 instead of
    crashing: an unhandled 500 carries no CORS headers, so the browser would
    only show the misleading "Could not reach the Garmin service".
    """
    log.warning("network error talking to Supabase: %s", type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "Network problem reaching the database. Please try again."},
    )


@app.middleware("http")
async def log_rejected_origin(request, call_next):
    """Names the origin when CORS will reject it (the browser only says 'failed')."""
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS and not (
        ALLOWED_ORIGIN_REGEX and re.fullmatch(ALLOWED_ORIGIN_REGEX, origin)
    ):
        log.warning("CORS: origin %r is not allowed (ALLOWED_ORIGINS %s)", origin, ALLOWED_ORIGINS)
    return await call_next(request)


# user_id -> (Garmin client awaiting MFA, client_state, created_at)
_pending: dict[str, tuple[Garmin, object, float]] = {}
_pending_lock = threading.Lock()
PENDING_TTL_S = 300  # user has 5 minutes to enter the MFA code
SYNC_COOLDOWN_S = 60
_last_attempt: dict[str, float] = {}  # user_id -> time of last manual sync attempt
_attempt_lock = threading.Lock()


class ConnectBody(BaseModel):
    email: str
    password: str


class MfaBody(BaseModel):
    code: str


class StravaConnectBody(BaseModel):
    code: str
    scope: str = ""


def _purge_pending() -> None:
    """Drops expired MFA sessions so abandoned logins don't pile up in memory."""
    cutoff = time.time() - PENDING_TTL_S
    with _pending_lock:
        for uid in [u for u, (_, _, ts) in _pending.items() if ts < cutoff]:
            del _pending[uid]


def _finish_connect(user_id: str, g: Garmin) -> dict:
    """
    Persists the authenticated session (tokens only, never the password), then
    runs the first sync, which doubles as validation that the session works.
    """
    conn = sync.save_connection(user_id, g.client.dumps())
    result = sync.sync_connection(conn, limit=50, wellness_days=28)
    if result["status"] != "active":
        raise HTTPException(status_code=502, detail=result["error"] or "Connected, but the first sync failed.")
    return {"status": "connected", "imported": result["imported"]}


@app.get("/health")
def health() -> dict:
    """Liveness probe for the host."""
    return {"ok": True}


@app.post("/garmin/connect")
def connect(body: ConnectBody, user_id: str = Depends(db.current_user_id)) -> dict:
    """
    Step 1 of linking Garmin. Logs in with the user's credentials (kept only in
    memory for the duration of this request). If the account has MFA enabled,
    the pending login is parked and the client must call /garmin/mfa next.
    """
    _purge_pending()
    g = Garmin(body.email, body.password, return_on_mfa=True)
    try:
        status, state = g.login()
    except GarminConnectTooManyRequestsError:
        raise HTTPException(429, "Garmin is rate limiting logins right now. Try again in a few minutes.")
    except GarminConnectAuthenticationError:
        raise HTTPException(400, "Garmin rejected that email/password.")
    except Exception as e:
        # Log the exception TYPE only; never anything that could echo credentials.
        log.warning("garmin login failed: %s", type(e).__name__)
        raise HTTPException(502, "Could not reach Garmin. Try again later.")

    if status == "needs_mfa":
        # garminconnect 0.3.x returns state=None here by design: the pending MFA
        # lives on the Garmin object `g`, and resume_login ignores the argument.
        with _pending_lock:
            _pending[user_id] = (g, state, time.time())
        return {"status": "mfa_required"}
    return _finish_connect(user_id, g)


@app.post("/garmin/mfa")
def submit_mfa(body: MfaBody, user_id: str = Depends(db.current_user_id)) -> dict:
    """
    Step 2 (only if /garmin/connect returned mfa_required). A wrong code keeps
    the pending login alive so the user can retry within the 5 minute window.
    """
    _purge_pending()
    with _pending_lock:
        entry = _pending.get(user_id)
    if not entry:
        raise HTTPException(410, "That login expired. Please start again.")
    g, state, _ = entry
    try:
        g.resume_login(state, body.code.strip())
    except GarminConnectTooManyRequestsError:
        raise HTTPException(429, "Too many attempts. Wait a few minutes and start again.")
    except Exception as e:
        log.info("mfa verification failed: %s", type(e).__name__)
        raise HTTPException(400, "That code didn't work. Check it and try again.")
    with _pending_lock:
        _pending.pop(user_id, None)
    return _finish_connect(user_id, g)


@app.post("/garmin/sync")
def sync_now(user_id: str = Depends(db.current_user_id)) -> dict:
    """Manual 'sync now' for the signed-in user, with a short cooldown to protect Garmin rate limits."""
    rows = db.select(
        "connections",
        {"user_id": f"eq.{user_id}", "provider": "eq.garmin", "select": "id,user_id,status,last_synced_at"},
    )
    if not rows:
        raise HTTPException(404, "Garmin is not connected.")
    conn = rows[0]
    if conn["status"] == "needs_reauth":
        raise HTTPException(409, "Garmin session expired. Please log in again.")
    # Cooldown counts the last ATTEMPT (not last success), so a failing or
    # rate-limited sync can't be hammered against Garmin by repeated clicks.
    now = time.time()
    with _attempt_lock:
        if now - _last_attempt.get(user_id, 0.0) < SYNC_COOLDOWN_S:
            return {"status": "recent", "imported": 0}
        _last_attempt[user_id] = now
    return sync.sync_connection(conn)


@app.post("/garmin/backfill", status_code=202)
def backfill(background: BackgroundTasks, user_id: str = Depends(db.current_user_id)) -> dict:
    """
    Imports the user's ENTIRE Garmin history. Returns immediately; pages are
    saved as they arrive, so activities show up live in the app while it runs.
    """
    rows = db.select(
        "connections",
        {"user_id": f"eq.{user_id}", "provider": "eq.garmin", "select": "id,user_id,status"},
    )
    if not rows:
        raise HTTPException(404, "Garmin is not connected.")
    conn = rows[0]
    if conn["status"] == "needs_reauth":
        raise HTTPException(409, "Garmin session expired. Please log in again.")
    if sync.is_busy(conn["id"]):
        raise HTTPException(409, "A sync is already running. Try again in a minute.")
    background.add_task(sync.sync_connection, conn, 20, True)
    return {"status": "started"}


_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


@app.get("/garmin/activities/{activity_id}/route")
def activity_route(activity_id: str, user_id: str = Depends(db.current_user_id)) -> dict:
    """
    GPS track of one of the caller's Garmin activities: {"points": [[lat, lon, ele], ...]}.
    The first request downloads the GPX from Garmin and caches the thinned track in
    `activity_routes`; later requests are answered from the cache. [] = no GPS track.
    """
    if not _UUID.fullmatch(activity_id):
        raise HTTPException(404, "Activity not found.")
    acts = db.select(
        "activities",
        {"id": f"eq.{activity_id}", "user_id": f"eq.{user_id}", "select": "id,provider,external_id"},
    )
    if not acts:
        raise HTTPException(404, "Activity not found.")
    act = acts[0]
    if act["provider"] != "garmin":
        raise HTTPException(404, "Routes are only available for Garmin activities.")

    cached = db.select("activity_routes", {"activity_id": f"eq.{activity_id}", "select": "points"})
    if cached:
        return {"points": cached[0]["points"]}

    conns = db.select(
        "connections",
        {"user_id": f"eq.{user_id}", "provider": "eq.garmin", "select": "id,user_id,status"},
    )
    if not conns:
        raise HTTPException(404, "Garmin is not connected.")
    conn = conns[0]
    if conn["status"] == "needs_reauth":
        raise HTTPException(409, "Garmin session expired. Please log in again.")

    try:
        points = sync.fetch_route(conn, act["external_id"])
    except sync.RouteBusy:
        raise HTTPException(409, "A sync is running. Try again in a minute.")
    except sync.TokenKeyMismatch:
        raise HTTPException(
            503,
            "This server cannot decrypt the saved Garmin session: its TOKEN_ENCRYPTION_KEY "
            "differs from the one that saved it.",
        )
    except GarminConnectAuthenticationError:
        sync.mark_needs_reauth(conn["id"])
        raise HTTPException(409, "Garmin session expired. Please log in again.")
    except GarminConnectTooManyRequestsError:
        raise HTTPException(429, "Garmin is rate limiting requests. Try again in a few minutes.")
    except GarminConnectConnectionError as e:
        if "404" not in str(e):
            raise HTTPException(502, "Could not reach Garmin. Try again later.")
        points = []  # Garmin has no file for this activity (no GPS)
    except ValueError:
        raise HTTPException(502, "Garmin returned a route we could not read.")

    db.upsert(
        "activity_routes",
        {"activity_id": activity_id, "user_id": user_id, "points": points},
        on_conflict="activity_id",
    )
    return {"points": points}


@app.delete("/garmin/disconnect")
def disconnect(user_id: str = Depends(db.current_user_id)) -> dict:
    """Deletes the stored session and all Garmin activities + daily metrics for this user."""
    db.delete("activities", {"user_id": f"eq.{user_id}", "provider": "eq.garmin"})
    db.delete("daily_metrics", {"user_id": f"eq.{user_id}", "provider": "eq.garmin"})
    db.delete("connections", {"user_id": f"eq.{user_id}", "provider": "eq.garmin"})  # tokens cascade
    with _pending_lock:
        _pending.pop(user_id, None)
    return {"ok": True}


# --- Strava ------------------------------------------------------------------

def _strava_connection(user_id: str) -> dict:
    """The caller's Strava connection row, or the right HTTP error."""
    if not strava.configured():
        raise HTTPException(503, "Strava is not configured on this server.")
    rows = db.select(
        "connections",
        {"user_id": f"eq.{user_id}", "provider": "eq.strava", "select": "id,user_id,status"},
    )
    if not rows:
        raise HTTPException(404, "Strava is not connected.")
    if rows[0]["status"] == "needs_reauth":
        raise HTTPException(409, "Strava authorization expired. Please reconnect Strava.")
    return rows[0]


@app.post("/strava/connect")
def strava_connect(
    body: StravaConnectBody,
    background: BackgroundTasks,
    user_id: str = Depends(db.current_user_id),
) -> dict:
    """
    Finishes the Strava OAuth flow: exchanges the `code` (the client secret
    never reaches the browser), stores encrypted tokens, imports the latest
    activities right away, then pulls the full history in the background.
    """
    if not strava.configured():
        raise HTTPException(503, "Strava is not configured on this server.")
    scopes = body.scope.split(",")
    if "activity:read" not in scopes and "activity:read_all" not in scopes:
        raise HTTPException(
            400,
            "Strava access to activities was not granted. Reconnect and keep "
            "'View data about your activities' ticked.",
        )
    try:
        tokens = strava.exchange_code(body.code)
        conn = strava.save_connection(user_id, tokens)
    except strava.StravaAuthError:
        raise HTTPException(400, "Strava rejected the login. Please try connecting again.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:  # (provider, external_id) already linked
            raise HTTPException(409, "This Strava account is already linked to another user.")
        log.warning("strava connect failed: HTTP %s", e.response.status_code)
        raise HTTPException(502, "Could not connect Strava. Please try again.")
    except Exception as e:
        log.warning("strava connect failed: %s", type(e).__name__)
        raise HTTPException(502, "Could not connect Strava. Please try again.")

    first = strava.sync_connection(conn)
    background.add_task(strava.sync_connection, conn, True)
    return {"status": "connected", "imported": first["imported"], "importing_history": True}


@app.post("/strava/sync")
def strava_sync(user_id: str = Depends(db.current_user_id)) -> dict:
    """Manual Strava sync (latest 50) with the same 60 s cooldown as Garmin."""
    conn = _strava_connection(user_id)
    now = time.time()
    key = f"strava:{user_id}"
    with _attempt_lock:
        if now - _last_attempt.get(key, 0.0) < SYNC_COOLDOWN_S:
            return {"status": "recent", "imported": 0}
        _last_attempt[key] = now
    return strava.sync_connection(conn)


@app.post("/strava/backfill", status_code=202)
def strava_backfill(background: BackgroundTasks, user_id: str = Depends(db.current_user_id)) -> dict:
    """Imports the entire Strava history in the background (saved page by page)."""
    conn = _strava_connection(user_id)
    if strava.is_busy(conn["id"]):
        raise HTTPException(409, "A Strava sync is already running. Try again in a minute.")
    background.add_task(strava.sync_connection, conn, True)
    return {"status": "started"}


@app.delete("/strava/disconnect")
def strava_disconnect(user_id: str = Depends(db.current_user_id)) -> dict:
    """Revokes our Strava access (best effort), then deletes its tokens and activities."""
    rows = db.select(
        "connections",
        {"user_id": f"eq.{user_id}", "provider": "eq.strava", "select": "id"},
    )
    if rows and strava.configured():
        strava.deauthorize(rows[0]["id"])
    db.delete("activities", {"user_id": f"eq.{user_id}", "provider": "eq.strava"})
    db.delete("connections", {"user_id": f"eq.{user_id}", "provider": "eq.strava"})  # tokens cascade
    return {"ok": True}


@app.post("/internal/sync-all", status_code=202)
def sync_all(background: BackgroundTasks, x_service_secret: str | None = Header(default=None)) -> dict:
    """Called by pg_cron. Returns immediately; the actual sync runs in the background."""
    if not x_service_secret or not secrets.compare_digest(x_service_secret, SERVICE_SECRET):
        raise HTTPException(403, "Forbidden")
    background.add_task(sync.sync_all)
    return {"status": "started"}
