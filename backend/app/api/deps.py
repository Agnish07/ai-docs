# backend/app/api/deps.py
from fastapi import Header, HTTPException, Depends
from app.core.firebase_admin import verify_token
from app.db.session import SessionLocal
from sqlalchemy.orm import Session

async def get_current_user(authorization: str = Header(...)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    id_token = authorization.split(" ")[1]
    try:
        decoded = verify_token(id_token)
        return decoded  # uid, email etc
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
