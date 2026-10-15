"""
Environment-driven settings for the Garmin service.

All values are required except ALLOWED_ORIGINS. The service fails fast at
startup if one is missing, so a misconfigured deploy never half-works.
"""
import os


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


# Supabase project URL, e.g. https://abcd1234.supabase.co
SUPABASE_URL = _required("SUPABASE_URL").rstrip("/")

# Public anon key. Only used to ask Supabase "who owns this user JWT?".
SUPABASE_ANON_KEY = _required("SUPABASE_ANON_KEY")

# Service role key: bypasses RLS to read/write tokens and activities.
# Server-side only. Never ship this to the browser.
SUPABASE_SERVICE_ROLE_KEY = _required("SUPABASE_SERVICE_ROLE_KEY")

# Fernet key used to encrypt Garmin session tokens before they hit the DB.
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Losing this key means every user has to reconnect Garmin.
TOKEN_ENCRYPTION_KEY = _required("TOKEN_ENCRYPTION_KEY")

# Shared secret that pg_cron sends in the X-Service-Secret header.
SERVICE_SECRET = _required("SERVICE_SECRET")

# Comma-separated list of browser origins allowed to call this service.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
