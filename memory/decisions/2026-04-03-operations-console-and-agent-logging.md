# 2026-04-03 Operations Console + Agent Logging

## Decision
SentientOps now uses a dedicated `/operations` route as the canonical project-scoped staffing and interaction surface.

## Why
The existing `Projects` and `Agents` pages exposed registry information but did not provide a seamless project-manager workflow for attaching agents, assigning the manager slot, or capturing structured worklogs in context. That forced both humans and agents toward lower-level tools.

## What Changed
- Added project staffing read model plus nested project-agent create/attach/detach APIs.
- Added filtered worklog listing for project activity feeds.
- Added SSE emissions for agent lifecycle mutations and worklog append events.
- Added shared quick-log UX reused by `/operations` and `/tasks`.
- Extended tester browser walkthrough to include the new operations page.

## Consequences
- Project managers now have one page for staffing, control, and activity.
- Agents can log work without leaving task or project context.
- UAT now covers the new route automatically.

## Follow-Up
- Add direct handover creation to the operations console if tester friction remains.
- Consider bulk staffing actions only after real usage shows need.
