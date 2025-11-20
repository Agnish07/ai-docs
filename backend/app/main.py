# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import test_routes
from app.api import projects  # ⬅️ new

from app.api import items


app = FastAPI(title="Ocean Project - AI Docs")

app.include_router(items.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test_routes.router)
app.include_router(projects.router)

@app.get("/health")
def health():
  return {"status": "ok"}
