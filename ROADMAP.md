# Synapse_OS Public Roadmap

## Phase 1: Foundation (Completed)
- Monorepo scaffold with backend, frontend, contracts, ops, docs, and memory system.
- Core API groups defined and policy guardrails implemented.
- Baseline tests for V1 invariants.

## Phase 2: Production Foundation (Completed)
- SQLAlchemy-backed persistence replaced scaffold-only in-memory behavior.
- Workflow transition engine, outbox foundation, board/timeline/event APIs, and strict-auth path landed.
- Kanban-first tasks UX reached production-shaped status with inspector depth and SSE fallback behavior.

## Phase 3: Agent Operations (Current)
- Dedicated `/operations` console for project staffing and project-scoped agent interaction.
- Project agent create/attach/detach, manager-slot assignment, and status management.
- Shared structured quick-log flow reused across operations and task inspection.
- Tester harness coverage expanded to include the operations workflow.

## Phase 4: Reliability + Background Processing
- Complete the evaluator queue worker and memory suggestion follow-through.
- Expand SSE coverage for more mutation classes and tighten degraded-mode UX.
- Add stronger end-to-end verification around auth, outbox, and cross-surface consistency.

## Phase 5: Memory + Evaluation Depth
- Curated memory promotion approvals and Qdrant retrieval relevance scoring.
- Richer evaluator workflow, audit timelines, and recurring weakness trends.
- Direct handover creation and more contextual operator actions in the operations console.

## Phase 6: Pilot Readiness
- Global control room metrics and multi-project operational views.
- CI quality gates for tests, contracts, and builds.
- Controlled pilot with one manager, multiple workers, one evaluator, and tester-agent regression coverage.
