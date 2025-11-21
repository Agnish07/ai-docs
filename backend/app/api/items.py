# backend/app/api/items.py
import json
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.schemas.item import RefineRequest
from app.core.llm_client import generate_text
from app.core.formatters import parse_llm_output

from app.models.models import User, Project, Item  # concrete models from your project

router = APIRouter(prefix="/projects", tags=["projects"])


def get_or_create_user(db: Session, firebase_user: dict):
    """
    Ensure a local User exists for the authenticated firebase_user dict.
    Expects firebase_user to contain a 'uid' (Firebase UID) or 'sub'.
    Creates a minimal user record with firebase_uid (non-nullable in your model).
    Returns the SQLAlchemy user instance.
    """
    uid = firebase_user.get("uid") or firebase_user.get("user_id") or firebase_user.get("sub")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid firebase user payload: missing uid")

    # Try to find existing user by firebase_uid (matches your models.User.firebase_uid)
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if user:
        return user

    # Create minimal user record (firebase_uid required by model)
    create_kwargs: Dict[str, Optional[str]] = {"firebase_uid": uid}

    email = firebase_user.get("email")
    if email:
        create_kwargs["email"] = email

    user = User(**create_kwargs)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_project_for_user(db: Session, project_id: int, user_id: int):
    """
    Load project and verify ownership.
    Uses Project.user_id (per your models) to check permission.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify owner
    if getattr(project, "user_id", None) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this project")

    return project


# helper to persist structured content into item.content (JSON string)
def save_structured_content(db: Session, item_instance: Item, struct: dict):
    item_instance.content = json.dumps(struct, ensure_ascii=False)
    db.add(item_instance)
    db.commit()
    db.refresh(item_instance)
    return item_instance


@router.post("/{project_id}/items/{item_id}/generate")
async def generate_item_content(
    project_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    user = get_or_create_user(db, firebase_user)
    project = get_project_for_user(db, project_id, user.id)

    item = db.query(Item).filter(Item.id == item_id, Item.project_id == project.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    prompt = f"""
Return ONLY a single valid JSON object with exactly these fields:
- heading: string (section/slide title)
- content_md: string (Markdown for the section; use '-' bullets for lists)
No extra commentary, no backticks.

Original info:
Project topic: {project.main_prompt or ''}
Section title: {item.title or ''}
Write concise, well-structured content for this section.
"""

    raw = await generate_text(prompt)
    struct = parse_llm_output(raw) or {}

    if struct.get("sections"):
        first = struct["sections"][0]
        out = {
            "heading": first.get("heading") or item.title,
            "content_md": first.get("content_md") or "",
        }
    else:
        out = {"heading": item.title, "content_md": raw}

    save_structured_content(db, item, {"title": project.main_prompt or "", "sections": [out]})

    return {"generated_raw": raw, "parsed": out, "item_id": item.id}


@router.post("/{project_id}/items/{item_id}/refine")
async def refine_item_content(
    project_id: int,
    item_id: int,
    data: RefineRequest,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    user = get_or_create_user(db, firebase_user)
    project = get_project_for_user(db, project_id, user.id)

    item = db.query(Item).filter(Item.id == item_id, Item.project_id == project.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        existing = json.loads(item.content) if item.content else {}
    except Exception:
        existing = {}

    content_md = ""
    if existing.get("sections"):
        content_md = existing["sections"][0].get("content_md", "")
    else:
        content_md = item.content or ""

    prompt = f"""
Refine the following Markdown content based on this user instruction:
INSTRUCTION: {data.refinement_prompt}

MARKDOWN CONTENT:
{content_md}

Return ONLY a JSON object with fields: heading (string), content_md (string). No commentary.
"""

    raw = await generate_text(prompt)
    struct = parse_llm_output(raw) or {}

    if struct.get("sections"):
        first = struct["sections"][0]
        out = {
            "heading": first.get("heading") or item.title,
            "content_md": first.get("content_md") or "",
        }
    else:
        out = {"heading": item.title, "content_md": raw}

    save_structured_content(db, item, {"title": project.main_prompt or "", "sections": [out]})
    return {"refined_raw": raw, "parsed": out, "item_id": item.id}
