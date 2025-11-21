# api/fastapi_app.py
# Correct handler for FastAPI running on Vercel Python serverless

import sys
from pathlib import Path

# Add backend to Python path
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_PATH = REPO_ROOT / "backend"
sys.path.append(str(BACKEND_PATH))

# Import FastAPI app
from app.main import app

# ASGI adapter for Vercel serverless functions
# Vercel requires this wrapper to execute FastAPI correctly.
try:
    from mangum import Mangum
except ImportError:
    raise ImportError(
        "Mangum must be installed. Add `mangum` to your requirements.txt"
    )

handler = Mangum(app)
