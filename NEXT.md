# Next Actions

## Current Phase
Production-grade foundation and Wave 2 UX hardening are complete; OpenAI tester-agent UAT harness foundation is now added.

## Recently Completed
1. Replaced scaffold in-memory behavior with SQLAlchemy-backed repositories and expanded domain entities.
2. Added workflow transition engine with `intake -> ... -> evaluation -> completed` stages and transition history.
3. Added outbox tables + polling worker foundation for evaluation and memory suggestion background processing.
4. Added board/timeline/process/events endpoints and migrated tool idempotency to persistent storage.
5. Added strict-auth configuration path for Clerk JWT verification and retained dev-gated header fallback.
6. Upgraded frontend task board and tool console toward agent-first operations with transition actions and guided presets.
7. Added/updated backend tests for strict auth, production flow, read endpoints, and tooling (`14 passed`).
8. Hardened Tasks UX with Kanban lane ordering, WIP pressure indicators, transition-safe drag/drop, and richer task inspector panels.
9. Added resilient SSE client behavior (reconnect + heartbeat-aware fallback) and wired task mutation endpoints to emit project stream events.
10. Revalidated current pass with `pytest` (`14 passed`) and `next build` (web build successful).
11. Added `apps/tester` OpenAI Agents SDK UAT harness with Playwright browser tools, agent-tool/MCP checks, JSON+Markdown report output, and root `pnpm qa:uat*` runners.
12. Enabled true local tester auth path across Next.js layout and middleware so browser UAT can run without live Clerk sign-in.
13. Added a new project-scoped `Operations` console with staffing flows, project agent attach/detach/create, contextual controls, and structured worklog capture.
14. Extended backend with project staffing read models, nested project-agent endpoints, filtered worklog listing, and SSE emission for agent/worklog mutations.
15. Reused a shared quick-log composer in both `/operations` and `/tasks`, and expanded Tool Console presets for `register_agent`, `append_worklog`, and `fetch_task_context`.

## Immediate Queue
1. Run the updated tester harness against a live local stack and capture first-pass findings for the new `/operations` workflow.
2. Complete the outbox worker follow-through for evaluator and memory jobs so UAT findings stop flagging queue-only behavior.
3. Expand the operations console with direct handover creation and richer task-context actions if agent feedback shows the current flow still drops to raw tools.
4. Complete remaining Kanban ergonomics (multi-select bulk transitions, keyboard shortcuts, and lane-level filtering/search).
5. Add OpenAPI-to-TypeScript contract generation and CI checks (`pytest`, contracts build, web build).
6. Add end-to-end happy-path flow tests with real auth/session wiring and feed tester artifacts into CI.

## Handoff Notes
- Policy guardrails remain enforced in `apps/api/src/app/services/policies.py` and transition requirements in `apps/api/src/app/services/workflow.py`.
- API namespace remains `/api/v1`; new production reads include boards, timeline, process template/bootstrap, and SSE events.
- Test harness now forces SQLite in `apps/api/tests/conftest.py` to avoid local `.env` Postgres coupling.
- OpenAI tester harness writes to `reports/uat/` and is designed to mutate only run-scoped QA-tagged projects in the main local dataset.
