# SentientOps V1 Primer

## Product Intent
SentientOps V1 is a project-centric operating layer for multi-agent execution across task orchestration, structured memory, handovers, evaluation, owner analytics, and project-scoped agent operations.

## Stack Defaults
- Backend: Python + FastAPI + SQLAlchemy + Alembic
- Frontend: Next.js + Tailwind
- Auth: Clerk
- Relational store: PostgreSQL
- Vector store: Qdrant
- Workspace: pnpm monorepo

## V1 Scope Constraints
- Build foundation scaffold and contracts, not full feature-complete delivery.
- Keep schemas explicit and attributable (agent identity + timestamps).
- Keep raw logs separate from curated memory.
- Preserve evaluator independence while allowing owner score overrides with audit.
- Keep project staffing explicit: one manager slot, project-scoped agents, and visible attach/detach flows.
- Optimize agent work capture for structured speed rather than free-form chat-first interaction.

## Data Pillars
- Project, Agent, Task
- Worklog, Handover
- Evaluation
- MemoryEntry (raw + curated promotion state)

## Current UX Defaults
- `Operations` is the canonical page for project staffing and agent interaction.
- `Tasks` remains the deep execution and inspection surface.
- Structured quick logs are available in both project and task context.
