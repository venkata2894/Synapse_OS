# Next Actions

## Current Phase
Foundation scaffold complete (monorepo + API/UI skeleton + memory/docs structure).

## Recently Completed
1. Frontend pass moved to light visual system with responsive page alignment updates.
2. In-memory API demo dataset now auto-seeds on startup for manual product walkthroughs.

## Immediate Queue
1. Wire real persistence for endpoint handlers (service + repository implementations).
2. Add OpenAPI to TypeScript contract generation workflow.
3. Integrate Clerk token verification into backend auth dependency.
4. Implement evaluation queue worker and memory promotion pipeline jobs.
5. Add Playwright + pytest integration checks for core happy paths.

## Handoff Notes
- All V1 product invariants are captured in `apps/api/src/app/services/policies.py`.
- API namespace is `/api/v1`.
- Kanban status set follows PRD statuses.
