# ADR 0001: Monorepo Foundation for SentientOps V1

## Status
Accepted

## Decision
Use a single monorepo with `apps/web`, `apps/api`, and `packages/contracts`.

## Rationale
- Reduces drift between API contracts and UI usage.
- Simplifies coding-agent coordination and handoffs.
- Keeps operational docs, memory, and infra scripts centralized.

## Consequences
- Requires workspace tooling discipline (`pnpm` workspaces).
- CI should validate backend and frontend independently.

