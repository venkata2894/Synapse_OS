# Architecture Overview

SentientOps V1 uses a monorepo with:
- `apps/api`: FastAPI REST backend (`/api/v1`)
- `apps/web`: Next.js dashboard
- `packages/contracts`: shared TypeScript contracts
- `ops`: local infrastructure and helper scripts

## Runtime Dependencies
- PostgreSQL for transactional records
- Qdrant for curated memory retrieval
- Clerk for web authentication

## Design Boundaries
- Raw execution logs and curated memory are separated.
- Evaluator scoring is independent from worker execution.
- Owner score overrides are append-only audited events.

