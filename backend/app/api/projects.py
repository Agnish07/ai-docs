# backend/app/api/projects.py
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import io

from app.api.deps import get_current_user, get_db
from app.models.models import User, Project, Item
from app.schemas.project import ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def get_or_create_user(db: Session, firebase_user: dict) -> User:
    """
    Ensure a local User record exists for the authenticated firebase_user payload.
    Returns SQLAlchemy User instance.
    """
    uid = firebase_user.get("uid") or firebase_user.get("sub") or firebase_user.get("user_id")
    email = firebase_user.get("email")
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid firebase user payload")

    user = db.query(User).filter(User.firebase_uid == uid).first()
    if user:
        return user

    user = User(firebase_uid=uid, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=List[ProjectOut])
def list_projects(
    q: Optional[str] = Query(None, description="Search query (case-insensitive)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of projects to return"),
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    List projects owned by the current user.
    Supports optional case-insensitive search across title and main_prompt using `q`.
    Projects are ordered by creation date (newest first).
    Each project's .items list is sorted by Item.order for stable outline ordering.
    """
    user = get_or_create_user(db, firebase_user)

    query = db.query(Project).filter(Project.user_id == user.id)

    # apply search filter if q provided and non-empty after trimming
    if q:
        q_trim = q.strip()
        if q_trim:
            q_like = f"%{q_trim}%"
            # use ilike for case-insensitive match (Postgres). If using another DB adapt accordingly.
            query = query.filter(
                or_(
                    Project.title.ilike(q_like),
                    Project.main_prompt.ilike(q_like)
                )
            )

    projects = query.order_by(Project.created_at.desc()).limit(limit).all()

    # ensure items for each project are stable-ordered by Item.order (in-memory)
    for proj in projects:
        if getattr(proj, "items", None):
            proj.items = sorted(proj.items, key=lambda it: (it.order or 0))
    return projects


@router.post("", response_model=ProjectOut)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    Create a new project and initial items from the provided config (outline or slides).
    """
    user = get_or_create_user(db, firebase_user)

    project = Project(
        user_id=user.id,
        title=project_in.title,
        doc_type=project_in.doc_type,
        main_prompt=project_in.main_prompt,
        config=project_in.config,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Create initial items from config
    if project_in.doc_type == "DOCX":
        outline = project_in.config.get("outline", []) if project_in.config else []
        item_type = "SECTION"
    else:
        outline = project_in.config.get("slides", []) if project_in.config else []
        item_type = "SLIDE"

    items = []
    for idx, title in enumerate(outline, start=1):
        if isinstance(title, dict):
            t = title.get("title", "")
        else:
            t = str(title)
        item = Item(
            project_id=project.id,
            title=t,
            order=idx,
            type=item_type,
            content="",
        )
        db.add(item)
        items.append(item)

    db.commit()
    for item in items:
        db.refresh(item)

    # Attach items in correct order
    project.items = sorted(items, key=lambda it: (it.order or 0))
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    Get a single project (owner only).
    Ensures returned items are sorted by Item.order.
    """
    user = get_or_create_user(db, firebase_user)
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if getattr(project, "items", None):
        project.items = sorted(project.items, key=lambda it: (it.order or 0))
    return project


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    Delete a project. Only the project owner may delete.
    This will remove the Project row and (assuming your SQLAlchemy relationship)
    cascade-delete its Items if configured.
    """
    user = get_or_create_user(db, firebase_user)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # ownership check: project.user_id must equal current user.id
    if getattr(project, "user_id", None) is not None and project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this project")

    db.delete(project)
    db.commit()
    return {"status": "deleted", "project_id": project_id}


# -----------------------
# Export endpoints
# -----------------------
def _project_bytes_and_name_for_docx(project: Project, db: Session) -> Tuple[bytes, str]:
    """
    Adapt this helper to use your actual exporter logic.
    The function should return (bytes, filename).
    """
    # Try common exporter entrypoints; adapt names if your project differs.
    try:
        # expected to return bytes
        from app.core.export_docx import build_docx_bytes
        doc_bytes = build_docx_bytes(project, db)
        filename = f"{(project.title or 'project').replace(' ', '_')}.docx"
        return doc_bytes, filename
    except Exception:
        # fallback: try another location/name
        try:
            from app.services.exporter import generate_docx  # alternative path
            doc_bytes = generate_docx(project, db)
            filename = f"{(project.title or 'project').replace(' ', '_')}.docx"
            return doc_bytes, filename
        except Exception as e:
            raise RuntimeError(f"No docx exporter available: {e}")


def _project_bytes_and_name_for_pptx(project: Project, db: Session) -> Tuple[bytes, str]:
    try:
        from app.core.export_pptx import build_pptx_bytes
        ppt_bytes = build_pptx_bytes(project, db)
        filename = f"{(project.title or 'project').replace(' ', '_')}.pptx"
        return ppt_bytes, filename
    except Exception:
        try:
            from app.services.exporter import generate_pptx
            ppt_bytes = generate_pptx(project, db)
            filename = f"{(project.title or 'project').replace(' ', '_')}.pptx"
            return ppt_bytes, filename
        except Exception as e:
            raise RuntimeError(f"No pptx exporter available: {e}")


@router.get("/{project_id}/export/docx")
def export_project_docx(
    project_id: int,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    Export project as a .docx file (returns file bytes).
    Frontend expects responseType=arraybuffer.
    """
    user = get_or_create_user(db, firebase_user)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if getattr(project, "user_id", None) is not None and project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    try:
        doc_bytes, filename = _project_bytes_and_name_for_docx(project, db)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not doc_bytes:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Exporter returned empty content")

    stream = io.BytesIO(doc_bytes)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers=headers)


@router.get("/{project_id}/export/pptx")
def export_project_pptx(
    project_id: int,
    db: Session = Depends(get_db),
    firebase_user: dict = Depends(get_current_user),
):
    """
    Export project as a .pptx file (returns file bytes).
    """
    user = get_or_create_user(db, firebase_user)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if getattr(project, "user_id", None) is not None and project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    try:
        ppt_bytes, filename = _project_bytes_and_name_for_pptx(project, db)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not ppt_bytes:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Exporter returned empty content")

    stream = io.BytesIO(ppt_bytes)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation", headers=headers)
