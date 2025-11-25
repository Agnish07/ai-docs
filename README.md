# AI-Assisted Document Authoring & Generation Platform

**Full-stack AI web app (FastAPI + React)**

This repository contains a full-stack application that allows authenticated users to generate, iteratively refine, and export structured business documents as **DOCX** or **PPTX** using an LLM. It was built to satisfy the assignment requirements for an AI-assisted document authoring platform.

---

## Table of Contents

* ✅ Features
* 🧰 Tech stack
* ⚙️ Prerequisites
* 🔐 Required environment variables
* 🚀 Local setup & run (backend + frontend)
* ☁️ Deployment notes (Vercel / Render / Railway)
* 🧩 Project structure
* 🧭 Usage examples
* 🧪 Tests & validation
* 🔧 Troubleshooting
* 📹 Demo video checklist
* 📜 License & acknowledgements

---

## ✅ Features

* User registration & login via **Firebase Authentication**
* Project dashboard and management
* Document scaffolding for **Word (.docx)** and **PowerPoint (.pptx)**
* Section/slide-by-slide AI content generation using an LLM (Gemini / OpenAI)
* Interactive refinement UI (per-section refinement prompts, like/dislike hooks, comments)
* Persistent storage of generated content and refinement history (Postgres/SQLite)
* Export assembled `.docx` and `.pptx` files via backend streaming
* Clean, modular codebase with migrations (Alembic)

---

## 🧰 Tech stack

* **Backend:** FastAPI, Uvicorn
* **Database:** PostgreSQL (recommended) or SQLite (dev)
* **Migrations:** Alembic
* **Auth:** Firebase Authentication (frontend SDK) + backend Firebase token validation
* **LLM integration:** `core/llm_client.py` / services/llm_client.py — pluggable for Gemini/OpenAI
* **Export:** `python-docx` (DOCX), `python-pptx` (PPTX)
* **Frontend:** React + Vite, TailwindCSS (optional styles)
* **Hosting:** Vercel / Render / Railway (examples provided below)

---

## ⚙️ Prerequisites

Install the following on your machine:

* Node.js (16+)
* Python 3.10+
* `pip` or `pipx`
* PostgreSQL (optional — for local full-run) or SQLite for quick dev

Install global tools (optional):

```bash
# for backend migrations & env management
pip install alembic
# or use virtualenv / pipenv / poetry as preferred
```

---

## 🔐 Required environment variables

Create a `.env` file for the backend and a `.env` or `.env.local` for the frontend (if using Vite). Below are the environment variables used by this repo.

**Backend (`backend/.env` or environment variables):**

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# or sqlite:///./dev.db for local quick dev

# Firebase admin: service account JSON path OR JSON string
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json
# or FIREBASE_SERVICE_ACCOUNT_JSON="{...}"

# JWT / Secrets
JWT_SECRET=your_jwt_secret_here

# LLM provider key (Gemini / OpenAI)
LLM_API_KEY=sk-xxxxx
LLM_PROVIDER=openai   # or "gemini" depending on implementation

# Optional
FRONTEND_ORIGIN=http://localhost:5173
```

**Frontend (`frontend/.env` or Vite env):**

```
VITE_API_URL=http://localhost:8000
# Firebase config (only for frontend public SDK initialization)
VITE_FIREBASE_API_KEY=XXXXX
VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_APP_ID=1:...:web:...
```

> Note: Sensitive Firebase service account keys belong only to the backend (server-side). Do not commit them to git.

---

## 🚀 Local setup & run

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # macOS / Linux
.venv\Scripts\activate       # Windows Powershell
pip install -r requirements.txt

# If using Postgres, ensure DATABASE_URL is set
# Run DB migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend exposes API under `/api/v1` (see `app/main.py` and the router prefixes).

### 2) Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` (or the port Vite prints). The frontend uses Firebase Auth for login and will call the backend API at `VITE_API_URL`.

---

## ☁️ Deployment notes

### Vercel (recommended for frontend; serverless FastAPI for backend via serverless adapter)

* Frontend: push to GitHub and connect to Vercel; set `VITE_API_URL` to the backend host.
* Backend: deploy to Render / Railway / Vercel Serverless (if using serverless adapter). Ensure environment variables are set in deployment UI.

### Render / Railway

* Create a new service; set build command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
* Add environment variables as in the `.env` section.
* Add a managed Postgres database and set `DATABASE_URL` accordingly.

### Important:

* Keep `FIREBASE_SERVICE_ACCOUNT_*` private and only set on server-side environment variables
* For production, use HTTPS and proper CORS configuration (add `FRONTEND_ORIGIN` to allowed origins)

---

## 🧩 Project structure (summary)

```
agnish07-ai-docs/
├─ backend/
│  ├─ app/
│  │  ├─ api/                # routes: projects, items, export, test
│  │  ├─ core/               # export_docx, export_pptx, llm & formatters
│  │  ├─ db/                 # init_db, session, users
│  │  ├─ schemas/            # pydantic schemas
│  │  ├─ services/           # llm client wrapper, doc assembler
│  │  └─ main.py
├─ frontend/
│  ├─ src/
│  │  ├─ pages/              # Dashboard, ProjectPage, Profile, CreateProject
│  │  ├─ components/         # OutlinePanel, ItemEditor, RefinementControls
│  │  └─ api.js
└─ tools/
   └─ test_db.py
```

---

## 🧭 Usage examples

### 1) Create project (curl example)

```bash
curl -X POST "http://localhost:8000/api/v1/projects" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Market analysis: EV industry 2025",
    "doc_type": "DOCX",
    "main_prompt": "A short market analysis for EV in 2025",
    "config": { "outline": ["Introduction","Market Overview","Trends","Conclusion"] }
  }'
```

### 2) Generate content for a section

```bash
curl -X POST "http://localhost:8000/api/v1/projects/{projectId}/items/{itemId}/generate" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

### 3) Refine a section

```bash
curl -X POST "http://localhost:8000/api/v1/projects/{projectId}/items/{itemId}/refine" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refinement_prompt":"Make this more formal and shorten to 120 words"}'
```

### 4) Export as DOCX

```bash
curl -X GET "http://localhost:8000/api/v1/projects/{projectId}/export/docx" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" --output project.docx
```

---

## 🧪 Tests & validation

* `tools/test_db.py` includes a small DB connectivity test — run it to validate your DB connection and credentials.
* Manual UI acceptance tests:

  * Register/login workflow
  * Create project → generate → refine → export

---

## 🔧 Troubleshooting

* **CORS errors**: ensure backend CORS allows `FRONTEND_ORIGIN`. Check `app/main.py` and verify allowed origins.
* **Firebase token errors**: make sure front-end Firebase config is correct and the backend has the service account for token verification.
* **LLM failures**: verify `LLM_API_KEY` and provider settings (openai/gemini) in env vars. Check `backend/app/core/llm_client.py` for provider-specific code.
* **Export issues**: verify `python-docx` and `python-pptx` are installed. Check exception logs in the export route.

---

## 📹 Demo video checklist (what to record)

* Intro + repo overview (30s)
* Login/registration (30s)
* Create DOCX project (1min)
* Generate sections (1.5min)
* Edit & refine (1.5min)
* Export DOCX & PPTX (1min)
* Quick code walkthrough (1min)
* Local run & env explanation (1min)
* Conclusion & repo link (30s)

---

## 📜 License & acknowledgements

This project uses open-source libraries: FastAPI, React, python-docx, python-pptx, and the LLM provider's SDK. Please follow their licenses. Replace or remove any publisher-provided API keys prior to publishing.

---

Tell me which you prefer next.
