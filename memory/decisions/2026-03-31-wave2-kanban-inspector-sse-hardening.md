# Decision Record

- Date: 2026-03-31
- Owner: Codex
- Context: Wave 2 required agent-first usability gains in Kanban execution, deeper task inspector clarity, and live-update resilience without waiting for full realtime infrastructure.
- Decision: Implemented transition-safe drag/drop with optimistic rollback, lane WIP pressure signals, structured inspector panels (dependencies, blocker, handover, evaluations, transitions, memory, worklogs), and a resilient SSE client with reconnect/backoff plus polling fallback.
- Alternatives Considered: Keeping JSON-only inspector and simple one-shot EventSource usage with no reconnect behavior.
- Consequences: Operator ergonomics improved immediately and transition mistakes are surfaced earlier; UI complexity increased and SSE scope is still limited to currently emitted server events.
- Follow-up Actions: Extend event emission to more mutation surfaces, add keyboard/command interactions for power users, and add dedicated interaction tests for drag/drop + stream failover.
