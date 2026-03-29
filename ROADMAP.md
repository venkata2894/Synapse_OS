# Synapse_OS Public Roadmap

## Phase 1: Foundation (Completed)
- Monorepo scaffold with backend, frontend, contracts, ops, docs, and memory system.
- Core API groups defined and policy guardrails implemented.
- Baseline tests for V1 invariants.

## Phase 2: Vertical Slice (Next)
- Project -> Task -> Worklog end-to-end flow with real PostgreSQL persistence.
- Basic dashboard data wiring (replace placeholders with live API reads).
- Auth token verification from Clerk into backend.

## Phase 3: Memory + Continuity
- Raw log ingestion strategy.
- Curated memory promotion approvals.
- Qdrant retrieval path with relevance scoring.

## Phase 4: Evaluation Engine
- Evaluation queue worker.
- Scorecard persistence and trend snapshots.
- Owner override audit timeline UI.

## Phase 5: Analytics + Pilot
- Global control room metrics.
- Agent profile and recurring weakness analysis.
- Controlled pilot: 1 manager, 3-5 workers, 1 evaluator.

