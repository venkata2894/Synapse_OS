# Decision Record

- Date: 2026-03-31
- Owner: Codex
- Context: SentientOps needed to move from scaffold-grade behavior to a production-grade baseline while preserving V1 policy invariants and agent-first workflows.
- Decision: Adopt SQLAlchemy persistence as the source of truth for core entities, introduce an explicit workflow transition engine with transition history, add outbox-backed background job processing primitives, and expose board/timeline/process/SSE read surfaces for the frontend.
- Alternatives Considered: Keeping in-memory repositories for speed of iteration and deferring transition/outbox modeling until later UX phases.
- Consequences: Runtime behavior is now deterministic and auditable with persisted idempotency, transitions, and override history; operational complexity increased due to DB migration and worker lifecycle management.
- Follow-up Actions: Complete strict Clerk production rollout (JWKS/issuer/audience), improve SSE resilience and Kanban UX polish, and add CI-level contract generation + end-to-end flow tests.
