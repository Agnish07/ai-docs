# backend/app/main.py
import os
import sys
import base64
from pathlib import Path
from typing import List

from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# import routers
from app.api import test_routes
from app.api import projects
from app.api import items

app = FastAPI(title="Ocean Project - AI Docs")

# serve static if exists
static_dir = BACKEND_ROOT / "static"
if static_dir.exists() and static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# CORS
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

# Firebase init (if provided as base64 env)
firebase_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")
if firebase_b64:
    try:
        sa_path = Path("/tmp/firebase_sa.json")
        sa_decoded = base64.b64decode(firebase_b64).decode("utf-8")
        sa_path.write_text(sa_decoded)
        try:
            from app.core.firebase_admin import init_firebase
            init_firebase(str(sa_path))
            print("Firebase initialized via app.core.firebase_admin.init_firebase", flush=True)
        except Exception as e_inner:
            # fallback to direct firebase_admin usage
            try:
                import firebase_admin
                from firebase_admin import credentials
                cred = credentials.Certificate(str(sa_path))
                if not firebase_admin._apps:
                    firebase_admin.initialize_app(cred)
                print("Firebase initialized via firebase_admin.initialize_app", flush=True)
            except Exception as e_fb:
                print("Firebase fallback init failed:", str(e_fb), flush=True)
                print("Original inner error:", str(e_inner), flush=True)
    except Exception as e:
        print("Firebase init failed:", str(e), flush=True)

# register routers
app.include_router(test_routes.router)
app.include_router(projects.router)
app.include_router(items.router)


@app.on_event("startup")
async def on_startup():
    # Print environment summary for easy debugging in Render logs
    print("=== startup: ENV SUMMARY ===", flush=True)
    print("PYTHONPATH (top 4):", sys.path[:4], flush=True)
    print("FRONTEND_ORIGINS:", os.getenv("FRONTEND_ORIGINS"), flush=True)
    print("FIREBASE_SERVICE_ACCOUNT_B64 present:", bool(os.getenv("FIREBASE_SERVICE_ACCOUNT_B64")), flush=True)
    print("=== registered routes ===", flush=True)

    # print each registered route (path and methods)
    try:
        routes_info: List[str] = []
        for r in app.routes:
            methods = ",".join(sorted(getattr(r, "methods", []) or []))
            routes_info.append(f"{r.path}  [{methods}]")
        for line in sorted(routes_info):
            print(line, flush=True)
    except Exception as e:
        print("Failed to list routes:", str(e), flush=True)

    # DB init (safe)
    try:
        from app.db.session import engine, Base
        if hasattr(Base, "metadata") and engine is not None:
            Base.metadata.create_all(bind=engine)
            print("DB metadata.create_all invoked", flush=True)
    except Exception as e:
        print("DB init failed:", str(e), flush=True)


# Root: GET redirects to /docs. HEAD returns a 204 so proxies/health-checkers get success without redirect body.
@app.get("/", include_in_schema=False, methods=["GET", "HEAD"])
async def root_get(request: Request):
    # If it's a HEAD request, return empty 204 (no body) to satisfy health checks quickly
    if request.method == "HEAD":
        return Response(status_code=204)
    # For GET, redirect to docs
    return RedirectResponse(url="/docs")


# Simple health endpoint: support GET and HEAD explicitly
@app.get("/health", tags=["health"], methods=["GET", "HEAD"])
async def health(request: Request):
    if request.method == "HEAD":
        return Response(status_code=204)
    return JSONResponse({"status": "ok"})


# Optional: keep a JSON fallback for unknown root-like requests (not necessary, but useful)
@app.get("/status", tags=["health"])
def status():
    return {"status": "ok", "service": "ai-docs"}