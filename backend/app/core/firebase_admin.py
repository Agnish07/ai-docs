# backend/app/core/firebase_admin.py
import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

def verify_token(id_token: str):
    """Return decoded token dict or raise exception."""
    return firebase_auth.verify_id_token(id_token)
