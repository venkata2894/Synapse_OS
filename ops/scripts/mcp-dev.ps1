$ErrorActionPreference = "Stop"

if (-not (Test-Path ".venv")) {
  throw ".venv not found. Run python -m venv .venv first."
}

.\.venv\Scripts\python.exe -m app.mcp.server

