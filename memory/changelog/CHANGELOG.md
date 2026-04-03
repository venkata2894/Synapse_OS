# Memory Changelog

## 2026-03-28
- Initialized SentientOps V1 foundation scaffold.
- Added monorepo structure, API/UI skeletons, docs, and memory templates.

## 2026-03-31
- Hardened the production foundation with SQLAlchemy persistence, workflow transitions, outbox worker foundation, board/timeline/events APIs, and stricter auth behavior.
- Shipped Wave 2 task UX improvements including richer Kanban interactions, deeper inspector panels, and SSE resilience.
- Added the OpenAI Agents SDK tester harness with Playwright-driven browser UAT and agent-tool/MCP coverage.

## 2026-04-03
- Added the project-scoped Operations console for staffing, manager assignment, project agent lifecycle, and contextual activity.
- Added project staffing APIs, filtered worklog listing, and live event emissions for agent/worklog mutations.
- Reused a shared structured worklog composer in both `/operations` and `/tasks`.
