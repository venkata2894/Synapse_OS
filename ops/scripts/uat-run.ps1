$ErrorActionPreference = "Stop"

if (-not (Test-Path ".venv")) {
  throw ".venv not found. Run python -m venv .venv first."
}

$python = (Resolve-Path ".\.venv\Scripts\python.exe").Path
$paths = @("apps/tester/src", "apps/api/src")
if ($env:PYTHONPATH) {
  $paths += $env:PYTHONPATH
}
$env:PYTHONPATH = ($paths -join [IO.Path]::PathSeparator)

& $python -c "import agents, playwright, tester" *> $null
if ($LASTEXITCODE -ne 0) {
  & $python -m pip install -e .\apps\tester
}

& $python -m tester.run @args
exit $LASTEXITCODE
