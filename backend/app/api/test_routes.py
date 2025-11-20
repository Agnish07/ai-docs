# backend/app/api/test_routes.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.services.llm_client import generate_text
from app.services.doc_assembler import assemble_docx
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1")

@router.post("/generate-test")
async def gen_test(payload: dict, user=Depends(get_current_user)):
    prompt = payload.get("prompt", "Hello")
    text = await generate_text(prompt)  # stub or real LLM
    return {"text": text, "user": {"uid": user.get("uid"), "email": user.get("email")}}

@router.get("/export-test")
def export_test(user=Depends(get_current_user)):
    items = [{"title":"Intro","content":"Sample content"}]
    bio = assemble_docx("Ocean Project Demo", items)
    return StreamingResponse(bio, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                             headers={"Content-Disposition":"attachment; filename=demo.docx"})
