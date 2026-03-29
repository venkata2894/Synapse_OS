$ErrorActionPreference = "Stop"

if (-not (Test-Path ".venv")) {
  throw ".venv not found. Run python -m venv .venv first."
}

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir apps/api/src

