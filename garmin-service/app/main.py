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
  DELETE /garmin/disconnect    user JWT   deletes tokens + Garmin activities
  POST   /internal/sync-all    X-Service-Secret (pg_cron) -> 202, runs in background
  GET    /health

IMPORTANT: run exactly ONE instance/worker. An in-progress MFA login lives in
this process's memory (the library keeps the pending MFA state on the Garmin
client object), so /garmin/connect and /garmin/mfa must hit the same process.
"""
import logging
import secrets
import threading
import time

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)
from pydantic import BaseModel

from . import db, sync
from .settings import ALLOWED_ORIGINS, SERVICE_SECRET

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("garmin.api")

app = FastAPI(title="Garmin sync service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

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
    result = sync.sync_connection(conn, limit=50)
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


@app.delete("/garmin/disconnect")
def disconnect(user_id: str = Depends(db.current_user_id)) -> dict:
    """Deletes the stored session and all Garmin activities for this user."""
    db.delete("activities", {"user_id": f"eq.{user_id}", "provider": "eq.garmin"})
    db.delete("connections", {"user_id": f"eq.{user_id}", "provider": "eq.garmin"})  # tokens cascade
    with _pending_lock:
        _pending.pop(user_id, None)
    return {"ok": True}


@app.post("/internal/sync-all", status_code=202)
def sync_all(background: BackgroundTasks, x_service_secret: str | None = Header(default=None)) -> dict:
    """Called by pg_cron. Returns immediately; the actual sync runs in the background."""
    if not x_service_secret or not secrets.compare_digest(x_service_secret, SERVICE_SECRET):
        raise HTTPException(403, "Forbidden")
    background.add_task(sync.sync_all)
    return {"status": "started"}
