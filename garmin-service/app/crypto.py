"""
Symmetric encryption for Garmin session tokens.

Garmin tokens (refresh token included) grant persistent access to a user's
Garmin account. We encrypt them with Fernet (AES-128-CBC + HMAC) BEFORE they
are written to Postgres, so a database leak alone does not expose usable
sessions. The key lives only in this service's environment.
"""
from cryptography.fernet import Fernet

from .settings import TOKEN_ENCRYPTION_KEY

_fernet = Fernet(TOKEN_ENCRYPTION_KEY.encode())


def encrypt(plaintext: str) -> str:
    """Encrypts a string and returns URL-safe base64 ciphertext."""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypts ciphertext from `encrypt`. Raises InvalidToken if tampered/wrong key."""
    return _fernet.decrypt(ciphertext.encode()).decode()
