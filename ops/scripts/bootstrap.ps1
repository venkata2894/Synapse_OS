param(
  [switch]$InstallNodeDeps,
  [switch]$InstallPythonDeps
)

$ErrorActionPreference = "Stop"

Write-Host "Creating virtual environment (.venv) if missing..."
if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

if ($InstallPythonDeps) {
  Write-Host "Installing API dependencies..."
  .\.venv\Scripts\python.exe -m pip install --upgrade pip
  .\.venv\Scripts\python.exe -m pip install -e .\apps\api[dev]
}

if ($InstallNodeDeps) {
  Write-Host "Installing pnpm workspace dependencies..."
  pnpm install
}

Write-Host "Bootstrap complete."

