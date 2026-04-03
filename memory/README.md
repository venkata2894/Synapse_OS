# Memory System

This folder is append-only operational memory for humans and coding agents.

## Structure
- `decisions/`: architecture and policy decisions.
- `handoffs/`: task handoff packets.
- `runbooks/`: repeatable operational procedures.
- `research/`: experimental notes and findings.
- `changelog/`: notable repository-level progress notes.

## Rules
- Never delete historical records.
- Add new entries with timestamps.
- Link decisions and handoffs to related PRs/issues/tasks where possible.
- Keep `NEXT.md` aligned with the latest implementation pass before closing a feature.
- Record architecture-shaping UX changes, not only backend infrastructure changes.
