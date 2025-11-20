# backend/app/schemas/project.py
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ItemOut(BaseModel):
    id: int
    title: str
    order: int
    type: str
    content: Optional[str] = ""

    class Config:
        orm_mode = True


class ProjectCreate(BaseModel):
    title: str
    doc_type: str
    main_prompt: Optional[str] = None
    config: dict


class ProjectOut(BaseModel):
    id: int
    title: str
    doc_type: str
    main_prompt: Optional[str]
    created_at: datetime
    items: List[ItemOut] = []

    class Config:
        orm_mode = True
