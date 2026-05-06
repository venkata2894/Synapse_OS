# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Canonical Agent Docs (read first)

For this repo, the authoritative agent contract lives in three sibling files. Read them in this order before making non-trivial changes:
1. `PRIMER.md` — product intent, stack defaults, V1 scope constraints, data pillars.
2. `NEXT.md` — current phase, recent completions, immediate queue, handoff notes. Update this when priorities shift.
3. `AGENTS.md` — non-negotiable product rules and working agreements.

Plus durable context:
- `memory/decisions/` — architecture decisions (append-only, do not remove).
- `memory/handoffs/` — handoff context between sessions/agents (append-only).
- `memory/runbooks/`, `memory/research/`, `memory/changelog/` — supporting context.
- `docs/architecture/` and `docs/adr/` — deeper architecture and ADRs.

## Common Commands

All commands assume Windows + PowerShell. The repo is a pnpm monorepo; many `pnpm` scripts wrap PowerShell shims under `ops/scripts/`.

### First-time setup
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .\apps\api[dev]
.\.venv\Scripts\python.exe -m pip install -e .\apps\tester
npm install -g pnpm@10.18.0
pnpm install
```

For a Docker-less run, set `DATABASE_URL=sqlite:///./sentientops.db` in `.env`. `ops/scripts/api-dev.ps1` reads that `.env` and launches uvicorn against `apps/api/src` with `app.main:app`.

### Dev servers
- `pnpm dev:api` — FastAPI on `http://localhost:8000` (uvicorn `--reload`, `--app-dir apps/api/src`).
- `pnpm dev:web` — Next.js on `http://localhost:3000`.
- `pnpm dev:worker` — outbox poller for evaluation/memory background jobs.
- `pnpm dev:mcp` — stdio MCP server (also auto-mounted at `/mcp` on the API when `sentientops_enable_mcp=True`).
- `pnpm dev` — runs all package `dev` scripts in parallel.

### Build / lint / test
- `pnpm build` / `pnpm lint` / `pnpm test` — recursive across the workspace.
- Backend tests: `.\.venv\Scripts\python.exe -m pytest apps\api\tests` (or `pytest -k <name>` for a single test). `apps/api/tests/conftest.py` forces `DATABASE_URL=sqlite:///./sentientops_test.db` and disables demo seeding, so tests do not honor the local `.env` Postgres URL.
- Web build: `pnpm --filter @sentientops/web build`.
- Contracts: `pnpm --filter @sentientops/contracts build`. Regenerate types from a running API with `pnpm --filter @sentientops/contracts generate:openapi` (requires the API up at `localhost:8000`).

### UAT (OpenAI tester agents in `apps/tester`)
- `pnpm qa:uat` — full UAT scenario.
- `pnpm qa:uat:blocked`, `pnpm qa:uat:agent`, `pnpm qa:uat:ux` — targeted scenarios.
- Outputs land in `reports/uat/` as JSON + Markdown (with optional screenshots). Browser UAT expects `SENTIENTOPS_TESTER_AUTH_MODE=local_bypass` in `apps/web/.env.local`.

## Architecture

Monorepo (`pnpm-workspace.yaml`):
- `apps/api` — FastAPI backend, SQLAlchemy models, Alembic migrations, MCP server.
- `apps/web` — Next.js 15 + React 19 + Tailwind, Clerk auth, app-router under `src/app`.
- `apps/tester` — OpenAI Agents SDK + Playwright UAT harness.
- `packages/contracts` — shared TS types (handwritten in `src/`, generated OpenAPI types under `src/generated/`).
- `ops/scripts` — PowerShell wrappers for dev/UAT.

### Backend layering (`apps/api/src/app`)
- `main.py` — FastAPI app factory, CORS, request-id middleware, `Base.metadata.create_all` on startup, optional MCP mount at `/mcp`, demo seeding gated on `sentientops_seed_demo_data` and not running under pytest.
- `core/config.py` — `pydantic-settings` `Settings` reads `<repo>/.env`. Key flags: `sentientops_enforce_clerk_jwt`, `sentientops_allow_header_auth_dev`, `sentientops_agent_api_keys` (`agent_id:api_key:role` CSV), `sentientops_enable_mcp`, `sentientops_max_subtask_depth`, `sentientops_max_subtasks_per_parent`.
- `core/auth.py` — auth resolution: strict Clerk JWT path, dev header fallback, and agent-API-key path used by `/agent-tools`.
- `api/v1/router.py` + `api/v1/endpoints/` — REST surface mounted at `/api/v1`. Endpoint modules: `projects`, `agents`, `tasks`, `worklogs`, `handovers`, `evaluations`, `memory`, `boards`, `events` (SSE), `process`, `dashboard`, `agent_tools`, `health`.
- `services/` — business logic. Critical files:
  - `workflow.py` — task lifecycle transition engine (`intake → ready → assigned → in_progress → awaiting_handover → under_review → evaluation → completed`, with side states `blocked`/`reopened`). Authoritative TaskStatus enum lives in `models/enums.py`.
  - `policies.py` — V1 guardrails (one manager per project, assigned-worker-only claiming, owner override audit, subtask limits).
  - `repository.py` — SQLAlchemy persistence + `clear_all` used by tests + `seed_demo_data`.
  - `evaluation.py`, `memory.py`, `event_stream.py` (SSE), `idempotency.py` (persistent idempotency keys), `agent_toolkit.py` (manifest + `call_tool`).
- `workers/outbox_worker.py` — polls outbox tables for evaluation and memory-suggestion jobs.
- `mcp/` — MCP server exposing the same tools as `/api/v1/agent-tools`.
- `models/` — SQLAlchemy entities (`entities.py`), enums (`enums.py`), declarative base.
- `db/` — engine/session.

### Frontend layering (`apps/web/src`)
- `app/` — route segments: `projects`, `operations` (project-scoped staffing console — canonical staffing surface), `tasks` (Kanban + inspector), `agents`, `evaluations`, `tools` (Tool Console).
- `components/` — `app-shell`, `kanban-board`, `worklog-composer` (shared between operations and tasks), `actor-provider`, `agent-key-panel`, `alert-panel`, `metric-card`, `query-state`.
- `lib/api-client.ts` — typed fetch helpers; `lib/status.ts`, `lib/format.ts`, `lib/constants.ts`.
- `middleware.ts` — Clerk middleware; supports a local-bypass mode for tester runs.

### Cross-cutting
- API namespace: `/api/v1`. Agent tooling: `/api/v1/agent-tools/{manifest,call,<tool>}` authenticated via `Authorization: Bearer <agent_api_key>` (default dev key `soa_dev_agent_key`).
- Realtime: SSE on `/api/v1/events` with reconnect + heartbeat-aware client fallback. Mutations on tasks, worklogs, agents, and project staffing emit project-scoped events.
- Memory model: raw worklogs are kept separate from curated memory entries; promotion is hybrid (system suggestion + manager/owner confirmation, see `MemoryPromotionStatus`).
- Evaluator independence: completion routes through evaluator workflow; owner score overrides are allowed only with reason + immutable audit.

## V1 Non-Negotiables (from AGENTS.md)
- One manager agent per project. Assigned-worker-only task claiming.
- Every completed task enters evaluator workflow.
- Owner score overrides require reason + audit history.
- Memory promotion is system-suggest + human-confirm.
- Manager-created subtasks allowed within configured depth/count limits.
- Alerts are in-app only for V1.

## Working Agreements
- Keep changes scoped and atomic.
- Update `NEXT.md` when priorities or sequencing change.
- Append architecture decisions to `memory/decisions/`; never delete historical records.
- Append session/agent handoff context to `memory/handoffs/`.
- The Operations console is the canonical project staffing surface; Tasks is the deep execution/inspection surface. Reuse `worklog-composer` rather than building parallel quick-log UIs.
