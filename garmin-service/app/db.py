"""
Tiny Supabase (PostgREST) client using the service role key.

We talk to PostgREST over plain HTTP instead of pulling in a full SDK: it is
~40 lines, easy to reason about, and has no extra dependency to break.
"""
import httpx
from fastapi import Header, HTTPException

from .settings import SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

_rest = httpx.Client(
    base_url=f"{SUPABASE_URL}/rest/v1",
    headers={
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    },
    timeout=20,
)


def select(table: str, params: dict) -> list[dict]:
    """GET rows. `params` are PostgREST filters, e.g. {"user_id": "eq.<uuid>", "select": "id"}."""
    r = _rest.get(f"/{table}", params=params)
    r.raise_for_status()
    return r.json()


def upsert(table: str, rows: list[dict] | dict, on_conflict: str, returning: bool = False):
    """
    Insert-or-update on a unique key. All rows in one call must have the same
    keys (PostgREST bulk rule); our mappers guarantee that.
    """
    prefer = "resolution=merge-duplicates," + ("return=representation" if returning else "return=minimal")
    r = _rest.post(
        f"/{table}",
        params={"on_conflict": on_conflict},
        json=rows,
        headers={"Prefer": prefer},
    )
    r.raise_for_status()
    return r.json() if returning else None


def patch(table: str, params: dict, values: dict) -> None:
    """UPDATE rows matching the filters."""
    r = _rest.patch(f"/{table}", params=params, json=values)
    r.raise_for_status()


def delete(table: str, params: dict) -> None:
    """DELETE rows matching the filters."""
    r = _rest.delete(f"/{table}", params=params)
    r.raise_for_status()


def current_user_id(authorization: str | None = Header(default=None)) -> str:
    """
    FastAPI dependency: resolves the caller's Supabase user id from the
    `Authorization: Bearer <user JWT>` header by asking Supabase Auth.
    Asking Auth (instead of verifying the JWT locally) means we never handle
    JWT secrets/keys and automatically honour revoked sessions.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    r = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": authorization},
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return r.json()["id"]
