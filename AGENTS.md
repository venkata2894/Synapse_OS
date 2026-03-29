# SentientOps Agent Operating Guide

This repository uses `AGENTS.md` as the canonical instruction source for coding agents.

## Read Order (Mandatory)
1. `PRIMER.md`
2. `NEXT.md`
3. `memory/decisions`
4. `memory/handoffs`

## Non-Negotiable Product Rules (V1)
- One manager agent per project.
- Task claiming is assigned-worker only.
- Every completed task enters evaluator workflow.
- Owner score overrides are allowed only with reason and audit history.
- Memory promotion is hybrid: system suggestion + manager/owner confirmation.
- Manager-created subtasks are allowed with configured limits.
- Alerts are in-app only for V1.

## Working Agreements
- Keep changes scoped and atomic.
- Update `NEXT.md` for any priority or sequencing change.
- Log architecture changes in `memory/decisions`.
- Log handoff context in `memory/handoffs`.
- Do not remove historical records from memory folders.

## Folder Intent
- `apps/api`: FastAPI backend.
- `apps/web`: Next.js + Tailwind frontend.
- `packages/contracts`: shared TypeScript contracts.
- `docs`: architecture and ADRs.
- `memory`: durable operating context for human and agent continuity.

