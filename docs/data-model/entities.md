# Core Entities (V1 Scaffold)

- `Project`: project metadata and manager assignment.
- `Agent`: worker/manager/evaluator identities and capabilities.
- `Task`: status-driven work item with dependencies and ownership.
- `Worklog`: structured activity entries.
- `Handover`: required continuity payload between agents.
- `Evaluation`: evaluator scorecard and rationale.
- `MemoryEntry`: raw or curated memory artifacts.

## Critical Constraints
- Exactly one manager agent per project.
- Task claim allowed only by assigned worker.
- Completion transition triggers evaluation queue entry.
- Owner score overrides must include reason and immutable audit record.

## Current Read Models
- `BoardSnapshot`: project Kanban lane/counter view
- `TaskTimelineResponse`: task history across worklogs, handovers, transitions, evaluations, and memory
- `ProjectStaffingSummary`: project-scoped roster, manager slot, attachable agents, and staffing counters
- `WorklogListResponse`: filtered project/task/agent activity feed
