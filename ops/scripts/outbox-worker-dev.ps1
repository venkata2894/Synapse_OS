$ErrorActionPreference = "Stop"

if (-not (Test-Path ".venv")) {
  throw ".venv not found. Run python -m venv .venv first."
}

$env:PYTHONPATH = "apps/api/src"

@'
from app.workers.outbox_worker import run_forever

run_forever()
'@ | .\.venv\Scripts\python.exe -
