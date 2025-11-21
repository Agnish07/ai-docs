# api/fastapi_app.py
# Vercel will treat this file as a Python serverless function and expose `app`.
# It imports your FastAPI app from backend.app.main

import os
# ensure backend package is on path if necessary
import sys
from pathlib import Path
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(REPO_ROOT / "backend"))

# import app from your backend
from app.main import app  # make sure backend/app/main.py defines `app`
