# backend/app/db/users.py
from typing import Dict, Optional
from sqlalchemy.orm import Session

# adjust this import path if your User model lives elsewhere
from app.db.models import User

def get_user_by_uid(db: Session, uid: str) -> Optional[User]:
    return db.query(User).filter(User.uid == uid).first()

def create_user(db: Session, firebase_user: Dict) -> User:
    # adapt keys to match what you get from firebase_user
    user = User(
        uid=firebase_user.get("uid"),
        email=firebase_user.get("email"),
        name=firebase_user.get("name") or firebase_user.get("displayName"),
        # add other required User model fields here with defaults if needed
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_or_create_user(db: Session, firebase_user: Dict) -> User:
    uid = firebase_user.get("uid")
    if not uid:
        raise ValueError("firebase_user missing 'uid'")
    existing = get_user_by_uid(db, uid)
    if existing:
        return existing
    return create_user(db, firebase_user)
