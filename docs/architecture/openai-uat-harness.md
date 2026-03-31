# OpenAI Tester Harness

## Purpose
The tester harness turns OpenAI Agents SDK specialists into UAT operators for SentientOps.
It creates a QA-tagged project in the main local dataset, simulates realistic project work, walks the UI with Playwright, exercises `/api/v1/agent-tools`, and smoke-tests MCP.

## Agent Topology
- `UAT Director`: owns the run and returns the final assessment.
- `Environment Auditor`: validates API, web, auth mode, and manifest readiness.
- `Project Lead Simulator`: creates QA data and drives workflow execution.
- `Browser UAT Agent`: navigates the UI with Playwright tools.
- `Agent Integration Agent`: validates `/agent-tools` and MCP behavior.
- `Report Synthesizer`: available to the director as a synthesis specialist.

## Scenarios
- `full_uat`: happy path from bootstrap through handover, evaluation, completion, and read-model checks.
- `blocked_recovery`: illegal claim rejection, blocked transition, reopen, reassignment, and resume.
- `agent_surface`: manifest, idempotency, batch calls, and MCP smoke.
- `ux_friction`: browser-heavy walkthrough of the operator experience using realistic QA data.

## Environment
Root `.env` should include:

```env
OPENAI_API_KEY=
OPENAI_TESTER_MODEL=gpt-5
SENTIENTOPS_UAT_BASE_URL=http://localhost:3000
SENTIENTOPS_API_BASE_URL=http://localhost:8000/api/v1
SENTIENTOPS_AGENT_API_KEY=soa_dev_agent_key
SENTIENTOPS_QA_PROJECT_PREFIX=qa
```

`apps/web/.env.local` should allow local tester auth for browser UAT:

```env
SENTIENTOPS_TESTER_AUTH_MODE=local_bypass
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_ACTOR_ID=owner-local-dev
```

## Installation
Install the tester package into the repo venv:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .\apps\tester
.\.venv\Scripts\python.exe -m playwright install chromium
```

The root runner `ops/scripts/uat-run.ps1` will auto-install `apps/tester` if the package is missing, but browser installation is still a one-time Playwright step.

## Commands
From the repo root:

```powershell
pnpm qa:uat
pnpm qa:uat:blocked
pnpm qa:uat:agent
pnpm qa:uat:ux
```

Direct Python invocation also works:

```powershell
$env:PYTHONPATH = "apps/tester/src;apps/api/src"
.\.venv\Scripts\python.exe -m tester.run --scenario full_uat
```

Add `--headed` to watch the browser run locally.

## Output
Every run writes:
- `reports/uat/<timestamp>-<run_id>.json`
- `reports/uat/<timestamp>-<run_id>.md`
- `reports/uat/artifacts/<run_id>/...` for screenshots

## Safety Rules
- The harness only mutates QA-tagged projects it creates for the current `qa_run_id`.
- Non-QA projects are not modified.
- Setup defects are separated from application defects in the final report.
