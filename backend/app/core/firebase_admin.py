# backend/app/core/firebase_admin.py
"""
Robust Firebase admin initializer + token verifier.

Search order for credentials:
1. FIREBASE_SERVICE_ACCOUNT_B64 (base64-encoded JSON)
2. FIREBASE_SERVICE_ACCOUNT     (raw JSON string)
3. GOOGLE_APPLICATION_CREDENTIALS (file path)
"""
import os
import json
import base64
from pathlib import Path
from typing import Optional

FIREBASE_B64_NAME = "FIREBASE_SERVICE_ACCOUNT_B64"
FIREBASE_JSON_NAME = "FIREBASE_SERVICE_ACCOUNT"
GOOGLE_CREDS_PATH = "GOOGLE_APPLICATION_CREDENTIALS"


def load_firebase_credentials() -> dict:
    """Return service account credentials as a dict. Raise RuntimeError if not found/invalid."""
    # 1) base64 encoded JSON in env
    b64 = os.getenv(FIREBASE_B64_NAME)
    if b64:
        try:
            decoded = base64.b64decode(b64).decode("utf-8")
            return json.loads(decoded)
        except Exception as e:
            raise RuntimeError(f"Invalid {FIREBASE_B64_NAME} (base64 or JSON parse failed): {e}") from e

    # 2) raw JSON in env
    raw = os.getenv(FIREBASE_JSON_NAME)
    if raw:
        try:
            return json.loads(raw)
        except Exception as e:
            raise RuntimeError(f"Invalid {FIREBASE_JSON_NAME} (JSON parse failed): {e}") from e

    # 3) path to json file
    path = os.getenv(GOOGLE_CREDS_PATH)
    if path:
        p = Path(path)
        if not p.exists():
            raise RuntimeError(f"GOOGLE_APPLICATION_CREDENTIALS is set but file not found: {path}")
        try:
            data = p.read_text(encoding="utf-8")
            return json.loads(data)
        except Exception as e:
            raise RuntimeError(f"Unable to read/parse GOOGLE_APPLICATION_CREDENTIALS JSON: {e}") from e

    raise RuntimeError(
        "No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS for local dev "
        "OR set FIREBASE_SERVICE_ACCOUNT (raw JSON) or FIREBASE_SERVICE_ACCOUNT_B64 (base64 JSON) in env."
    )


def init_firebase_from_dict(sa_dict: dict):
    """Initialize firebase_admin from a service-account dict (idempotent)."""
    try:
        import firebase_admin
        from firebase_admin import credentials
    except Exception as e:
        raise RuntimeError(f"firebase_admin import failed: {e}") from e

    if not getattr(firebase_admin, "_apps", None):
        cred = credentials.Certificate(sa_dict)
        firebase_admin.initialize_app(cred)


def init_firebase_from_path(path: str):
    """Initialize firebase_admin from a file path (idempotent)."""
    try:
        import firebase_admin
        from firebase_admin import credentials
    except Exception as e:
        raise RuntimeError(f"firebase_admin import failed: {e}") from e

    p = Path(path)
    if not p.exists():
        raise RuntimeError(f"Firebase service account file not found: {path}")

    if not getattr(firebase_admin, "_apps", None):
        cred = credentials.Certificate(str(p))
        firebase_admin.initialize_app(cred)


def init_firebase(default_path: Optional[str] = None):
    """
    Load credentials (using load_firebase_credentials) and initialize firebase_admin.
    Safe to call multiple times.
    """
    # try explicit path first
    if default_path:
        try:
            init_firebase_from_path(default_path)
            return
        except Exception:
            pass

    sa = load_firebase_credentials()
    if isinstance(sa, dict):
        init_firebase_from_dict(sa)
    else:
        raise RuntimeError("Loaded firebase credentials are not a dict.")


def verify_token(id_token: str) -> dict:
    """
    Verify an incoming Firebase ID token and return the decoded token (claims).
    Raises RuntimeError on failure.
    """
    # Ensure firebase is initialized
    try:
        import firebase_admin
        from firebase_admin import auth, credentials
    except Exception as e:
        raise RuntimeError(f"firebase_admin import failed: {e}") from e

    # initialize app if not already
    if not getattr(firebase_admin, "_apps", None):
        # attempt to initialize using envs
        sa = load_firebase_credentials()
        init_firebase_from_dict(sa)  # will raise if invalid

    try:
        decoded = auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        # firebase_admin.auth raises several exception types; normalize to RuntimeError
        raise RuntimeError(f"Failed to verify Firebase ID token: {e}") from e
