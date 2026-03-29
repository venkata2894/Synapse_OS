# SentientOps V1 Primer

## Product Intent
SentientOps V1 is a project-centric operating layer for multi-agent execution across task orchestration, structured memory, handovers, evaluation, and owner analytics.

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

## Data Pillars
- Project, Agent, Task
- Worklog, Handover
- Evaluation
- MemoryEntry (raw + curated promotion state)

