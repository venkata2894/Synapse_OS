$ErrorActionPreference = "Stop"

function Import-RepoEnv {
  param (
    [string]$EnvFile
  )

  if (-not (Test-Path $EnvFile)) {
    return
  }

  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1]
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
Set-Location $repoRoot
Import-RepoEnv -EnvFile (Join-Path $repoRoot ".env")

if (-not (Test-Path ".venv")) {
  throw ".venv not found. Run python -m venv .venv first."
}

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir apps/api/src
