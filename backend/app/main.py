# backend/app/main.py
import os
import sys
import base64
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api import test_routes
from app.api import projects
from app.api import items

app = FastAPI(title="Ocean Project - AI Docs")

static_dir = BACKEND_ROOT / "static"
if static_dir.exists() and static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

origins_env = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
ALLOW_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]
if not ALLOW_ORIGINS:
    ALLOW_ORIGINS = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

firebase_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")
if firebase_b64:
    try:
        sa_path = Path("/tmp/firebase_sa.json")
        sa_decoded = base64.b64decode(firebase_b64).decode("utf-8")
        sa_path.write_text(sa_decoded)
        try:
            from app.core.firebase_admin import init_firebase
            init_firebase(str(sa_path))
        except Exception:
            import firebase_admin
            from firebase_admin import credentials
            cred = credentials.Certificate(str(sa_path))
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
    except Exception as e:
        print("Firebase init failed:", str(e), flush=True)

app.include_router(test_routes.router)
app.include_router(projects.router)
app.include_router(items.router)


@app.on_event("startup")
async def on_startup():
    try:
        from app.db.session import engine, Base
        if hasattr(Base, "metadata") and engine is not None:
            Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("DB init failed:", str(e), flush=True)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}
