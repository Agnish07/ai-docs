# backend/app/schemas/item.py

from pydantic import BaseModel

class ItemUpdate(BaseModel):
    content: str

class RefineRequest(BaseModel):
    refinement_prompt: str
