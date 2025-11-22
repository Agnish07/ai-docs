# backend/app/core/firebase_admin.py
"""
Robust Firebase admin initializer.

This module exposes two helpers:
- load_firebase_credentials() -> dict or raises RuntimeError
- init_firebase(path_or_json)  -> initializes firebase_admin (no-op if already initialized)

It will look for credentials in this order:
1. FIREBASE_SERVICE_ACCOUNT_B64    (base64-encoded JSON string)
2. FIREBASE_SERVICE_ACCOUNT        (raw JSON string)
3. GOOGLE_APPLICATION_CREDENTIALS  (file path)
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
    """
    Return the service account credentials as a dict.
    Prefer base64 env var, then raw JSON env var, then file path in GOOGLE_APPLICATION_CREDENTIALS.
    Raise RuntimeError if none found or JSON invalid.
    """
    # 1) base64 encoded JSON in env (use this for Render / Vercel safely)
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

    # 3) path to json file in GOOGLE_APPLICATION_CREDENTIALS
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
    """
    Initialize firebase_admin using a credentials dict.
    Safe to call multiple times (it checks firebase_admin._apps).
    """
    try:
        import firebase_admin
        from firebase_admin import credentials
    except Exception as e:
        # if firebase_admin is not installed, bubble up
        raise RuntimeError(f"firebase_admin import failed: {e}") from e

    if not firebase_admin._apps:
        cred = credentials.Certificate(sa_dict)
        firebase_admin.initialize_app(cred)


def init_firebase_from_path(path: str):
    """
    Initialize firebase_admin using a file path (string).
    """
    try:
        import firebase_admin
        from firebase_admin import credentials
    except Exception as e:
        raise RuntimeError(f"firebase_admin import failed: {e}") from e

    p = Path(path)
    if not p.exists():
        raise RuntimeError(f"Firebase service account file not found: {path}")

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(p))
        firebase_admin.initialize_app(cred)


# convenience wrapper used by other modules
def init_firebase(default_path: Optional[str] = None):
    """
    Attempt to load credentials and initialize firebase_admin.
    If default_path is provided, it will try that path first.
    """
    # if user supplied explicit file path, try it first
    if default_path:
        try:
            init_firebase_from_path(default_path)
            return
        except Exception:
            pass

    sa = load_firebase_credentials()  # may raise RuntimeError
    # If load returns a dict, initialize from dict
    if isinstance(sa, dict):
        init_firebase_from_dict(sa)
    else:
        # Shouldn't happen but be defensive
        raise RuntimeError("Loaded firebase credentials are not a dict.")
