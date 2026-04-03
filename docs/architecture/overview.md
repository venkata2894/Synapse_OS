# Architecture Overview

SentientOps V1 uses a monorepo with:
- `apps/api`: FastAPI REST backend (`/api/v1`)
- `apps/web`: Next.js operator UI (`dashboard`, `projects`, `operations`, `tasks`, `agents`, `evaluations`, `tools`)
- `packages/contracts`: shared TypeScript contracts
- `ops`: local infrastructure and helper scripts
- `apps/tester`: OpenAI Agents SDK UAT harness with Playwright support

## Runtime Dependencies
- PostgreSQL for transactional records
- Qdrant for curated memory retrieval
- Clerk for web authentication

## Design Boundaries
- Raw execution logs and curated memory are separated.
- Evaluator scoring is independent from worker execution.
- Owner score overrides are append-only audited events.
- Project staffing is explicit and project-scoped; the manager slot is singular.
- Agent interaction is action-first and structured, not chat-first by default.

## Current Interaction Surfaces
- `Projects`: portfolio and project overview
- `Operations`: project staffing, agent controls, and worklog activity
- `Tasks`: Kanban execution flow and deep task inspection
- `Tools`: machine-oriented fallback and advanced agent-tool access
