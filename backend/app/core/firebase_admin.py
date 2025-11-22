# backend/app/core/firebase_admin.py
import os
import json
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

def load_firebase_credentials():
    # 1) If local file exists (dev), use it
    local_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    if os.path.exists(local_path):
        return credentials.Certificate(local_path)

    # 2) Otherwise use Vercel env var containing raw JSON
    json_data = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if json_data:
        try:
            cred_dict = json.loads(json_data)
            return credentials.Certificate(cred_dict)
        except Exception as e:
            raise RuntimeError("Invalid FIREBASE_SERVICE_ACCOUNT JSON") from e

    raise RuntimeError(
        "No Firebase credentials found. "
        "Set GOOGLE_APPLICATION_CREDENTIALS for local dev OR FIREBASE_SERVICE_ACCOUNT on Vercel."
    )

cred = load_firebase_credentials()

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

def verify_token(id_token: str):
    return firebase_auth.verify_id_token(id_token)
