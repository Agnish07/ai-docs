# backend/app/api/export.py
import io, json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.models import Project, Item
from app.api.items import get_project_for_user, get_or_create_user  # or re-implement checks
from app.core.export_docx import create_docx_from_structure
from app.core.export_pptx import create_pptx_from_structure

router = APIRouter(prefix="/api/v1/projects", tags=["export"])

@router.get("/{project_id}/export/docx")
def export_docx(project_id: int, db: Session = Depends(get_db), firebase_user: dict = Depends(get_current_user)):
    user = get_or_create_user(db, firebase_user)
    project = get_project_for_user(db, project_id, user.id)

    # assemble latest content from all items
    items = db.query(Item).filter(Item.project_id == project.id).order_by(Item.position).all()
    # combine sections
    structure = {"title": project.title or project.main_prompt, "summary": project.main_prompt, "sections": []}
    for it in items:
        try:
            j = json.loads(it.content) if it.content else {}
        except Exception:
            j = {"sections": [{"heading": it.title, "content_md": it.content or ""}]}
        if j.get("sections"):
            structure["sections"].extend(j["sections"])
        else:
            structure["sections"].append({"heading": it.title, "content_md": it.content or ""})

    docx_bytes = create_docx_from_structure(structure)
    return StreamingResponse(io.BytesIO(docx_bytes), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition":f"attachment; filename=project-{project_id}.docx"})

@router.get("/{project_id}/export/pptx")
def export_pptx(project_id: int, db: Session = Depends(get_db), firebase_user: dict = Depends(get_current_user)):
    user = get_or_create_user(db, firebase_user)
    project = get_project_for_user(db, project_id, user.id)

    items = db.query(Item).filter(Item.project_id == project.id).order_by(Item.position).all()
    structure = {"title": project.title or project.main_prompt, "summary": project.main_prompt, "sections": []}
    for it in items:
        try:
            j = json.loads(it.content) if it.content else {}
        except Exception:
            j = {"sections": [{"heading": it.title, "content_md": it.content or ""}]}
        if j.get("sections"):
            structure["sections"].extend(j["sections"])
        else:
            structure["sections"].append({"heading": it.title, "content_md": it.content or ""})

    pptx_bytes = create_pptx_from_structure(structure)
    return StreamingResponse(io.BytesIO(pptx_bytes), media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation", headers={"Content-Disposition":f"attachment; filename=project-{project_id}.pptx"})
