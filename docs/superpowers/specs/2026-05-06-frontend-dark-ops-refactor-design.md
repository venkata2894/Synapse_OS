# SentientOps Frontend Dark Ops Refactor — Design Spec

**Date:** 2026-05-06
**Author:** Venkata Sai Mekala (PM/AI Researcher) + Claude
**Status:** Approved for implementation planning
**Scope:** `apps/web` only — no backend changes

---

## 1. Context and intent

`apps/web` is the SentientOps operator surface. The repo has dark "Agent Control Room" redesign PNGs (`dashboard-redesign.png`, `tasks-redesign.png`, `agents-redesign.png`, `evaluations-redesign.png`) but the running code shifted to a light theme that does not match. The build also fails on `next build`, blocking production deploy.

The actual users — confirmed in brainstorming — are PMs, owners, and researchers reviewing agent runs, not 8-hour SOC operators. They want calm density and the operator/control-room aesthetic, not a Bloomberg terminal.

This spec covers a single coherent refactor: lock the visual direction, ship a primitive component layer, deep-rebuild the two operator surfaces (`/operations` and `/tasks`), polish the rest, and fix the Node build.

## 2. Decisions locked in brainstorming

| Decision | Choice | Rationale |
|---|---|---|
| Visual direction | **Dark Ops** | Matches existing redesign PNGs and the "Agent Control Room" framing. |
| Scope | **Theme everywhere + deep rebuild on `/operations` and `/tasks`** | Highest UX gain on operator surfaces; avoids a months-long full rebuild. |
| Density | **Spacious** (14–15px body, 12px+ gaps) | Calm scan-ability for review users; not Bloomberg. |
| Primitive layer | **shadcn/ui (Radix headless + copy-in)** | Accessibility and proven primitives without giving up styling control. |

## 3. Foundation — design tokens

CSS custom properties live in `apps/web/src/app/globals.css`. Tailwind config (`apps/web/tailwind.config.ts`) reads them so utility classes map to tokens. The hand-rolled `.surface` / `.surface-inset` / `.glow-*` classes are rebuilt around these tokens; existing usages keep working.

```
--bg-base       #07090f
--bg-surface    #0f172a
--bg-raised     #131c2e
--bg-inset      #0b1220
--edge          #1e293b
--edge-bright   #2a3957
--ink           #e2e8f0
--ink-secondary #94a3b8
--ink-tertiary  #64748b
--ink-ghost     #475569
--signal        #22d3a8
--signal-dim    rgba(34, 211, 168, 0.10)
--warn          #fbbf24
--danger        #f87171
--info          #60a5fa
--accent        #a78bfa
```

Typography (existing, unchanged): Bricolage Grotesque (display) / DM Sans (body) / DM Mono (mono). All loaded via `next/font/google` in `app/layout.tsx`.

Spacious-density baseline: 14px body, 1.55 line-height, 16px card padding, 12px gaps, 24px section gaps.

A future light-mode toggle is enabled by structuring tokens as variables now; no toggle UI ships in this refactor.

The `<html>` `className` flips from `light` to `dark` in `app/layout.tsx`.

## 4. Primitive component layer

New directory `apps/web/src/components/ui/` for shadcn-style primitives. Each file is a thin client component wrapping Radix headless logic with our tokens. Inventory:

```
button.tsx        card.tsx          badge.tsx         status-pill.tsx
input.tsx         textarea.tsx      select.tsx        checkbox.tsx
dialog.tsx        drawer.tsx        sheet.tsx         tooltip.tsx
dropdown-menu.tsx tabs.tsx          toast.tsx         skeleton.tsx
avatar.tsx        separator.tsx     scroll-area.tsx   command.tsx
```

`status-pill.tsx` is custom (not from shadcn) — encapsulates the `TaskStatus` enum → color mapping in one place. Imports from `@sentientops/contracts` for the union type.

New runtime dependencies:
- `@radix-ui/react-*` (dialog, dropdown-menu, popover, scroll-area, tabs, toast, tooltip, avatar, checkbox, select, separator, slot)
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react` (icon set; replaces all inline SVGs across the app)
- `@dnd-kit/core` and `@dnd-kit/sortable` (for the new Tasks board)
- `framer-motion` (used sparingly — `LayoutGroup` for SSE-driven additions, optional)

Existing shared components — `app-shell.tsx`, `metric-card.tsx`, `kanban-board.tsx`, `worklog-composer.tsx`, `query-state.tsx`, `alert-panel.tsx`, `actor-provider.tsx`, `agent-key-panel.tsx` — are rewritten on top of the primitives. File paths stay identical so route imports do not shift.

## 5. Theme-only route polish

These four routes get the dark token skin and a one-pass cleanup. No structural rebuild.

### 5.1 `/` Dashboard
- Keep the 5-metric strip + project table + alerts panel layout.
- Replace inline SVGs with `lucide-react` icons.
- Merge alerts into a single chronological feed (drop the dual blocked / low-score visual styles).
- Drop ornamental labels: "Operational Overview", "Global Pulse", "Real-time".
- Add a per-panel empty state with help text and one CTA.

### 5.2 `/projects`
- Convert the card grid to a sortable table — name · status · manager · agents · tasks · last activity.
- `+ New project` button top-right.
- Row click opens a project drawer (`Sheet`) with manager slot, agent count, and recent activity.

### 5.3 `/agents`
- Dense table — name · type · role · status · projects · last active.
- Filter chips above the table for type / status / role.
- Replaces today's card grid which does not scale past ~12 agents.

### 5.4 `/evaluations`
- Keep the score-card layout from `evaluations-redesign.png`.
- Replace bar lists with a small radar chart per card so seven score axes are visible at a glance.
- Top filter strip: agent · time range · score floor.

### 5.5 `/tools`
- Functional polish only.
- Tighten request/response panels.
- Syntax-highlight JSON output (CSS classes — no `shiki` to keep deps small).
- Auto-generate the `Idempotency-Key` field on submit; show the value with a copy button.

### 5.6 Shared shell (`app-shell.tsx`)
- Sidebar gets section grouping with two labels: `PRODUCTION` (Dashboard, Projects) and `OPS` (Operations, Tasks, Agents, Evaluations, Tools).
- Topbar gets a `⌘K` command palette (`command.tsx`) for jumping to any route, project, task, or agent. Uses existing `/api/v1` read endpoints for search; a thin additive read endpoint is permitted if no current endpoint suffices (see §11 carve-out).

## 6. `/operations` deep rebuild

Replaces today's vertical-scroll layout (project picker → manager card → agent list → activity feed → quick-log).

### 6.1 Layout — three-column workspace

```
┌──────────────┬─────────────────────────────────┬──────────────────────┐
│              │                                 │                      │
│  PROJECT     │     STAFFING + AGENTS           │     RIGHT RAIL       │
│  RAIL        │     (primary work area)         │     (tabbed)         │
│  240px       │                                 │     320px            │
│              │  Manager slot panel             │                      │
│  search      │  Agents-attached grid           │  Tabs:               │
│  list        │  Compact KPI strip              │   Activity           │
│  + New       │                                 │   Quick log          │
│              │                                 │   Handovers          │
│              │                                 │   Health             │
└──────────────┴─────────────────────────────────┴──────────────────────┘
```

Below 1280px the right rail collapses into a Sheet trigger; below 1024px the project rail collapses into a top dropdown. No mobile breakpoint targeted in this refactor.

### 6.2 Project rail (240px)
- Search at top.
- List items: name · manager initial avatar · WIP count · pulse dot when SSE has had activity in the last 60s.
- `+ New project` pinned to bottom.
- Replaces today's `<select>` project picker.

### 6.3 Manager slot panel
- First panel in the work area when a project loads.
- Vacant: prominent "Assign manager" CTA opening a Dialog with the eligible-agents list.
- Filled: avatar · name · role · time-in-role · `Reassign` (opens a confirm Dialog because of the V1 "one manager per project" rule from `AGENTS.md`).

### 6.4 Agents-attached grid
- Cards (3 per row at typical width).
- Each card: avatar · name · type badge (`project_side` / `platform_side`) · status pill · last-active relative time · `⋯` menu (Detach / View profile / Change role).
- `+ Attach agent` opens a Dialog with search + filter.
- `+ Create new` opens a Sheet with the registration form.

### 6.5 Compact KPI strip
- One row, four stats: open tasks · blocked · evals pending · last handover age.
- 14px values, 11px labels.
- Sits between agents grid and the right rail; not a hero element.

### 6.6 Right rail (320px) — tabs
- **Activity** (default) — current activity feed inside a `ScrollArea`, with proper item-type icons and absolute timestamps on hover.
- **Quick log** — reuses `worklog-composer` exactly as today.
- **Handovers** — lists recent handovers for the project; `+ Create handover` button. Closes `NEXT.md` Immediate Queue item #3.
- **Health** — SSE connection status · last poll age · idempotency-key cache size · outbox depth. Useful when realtime feels stale.

### 6.7 Realtime
- Existing `useResilientEventStream` continues to drive live updates.
- Mutations animate in via `framer-motion` `LayoutGroup` (optional; can be omitted if bundle size is a concern).
- Project rail pulse dot is the global "something happened" indicator.

### 6.8 Empty states
Every panel has an explicit empty state with one CTA. No "No items" filler text.

## 7. `/tasks` deep rebuild

Replaces today's full-width board + below-board inspector (two scroll axes) with a board + side inspector (Linear-style).

### 7.1 Layout

```
┌──────────────────────────────────────────────────────┬────────────────┐
│ TOP CONTROL BAR                                      │  INSPECTOR     │
│  project ▾ · filters · view: board/list/timeline     │  (Sheet)       │
│  · blocked banner · + New task                       │  480px wide    │
├──────────────────────────────────────────────────────┤  opens on      │
│                                                      │  card click;   │
│  KANBAN BOARD                                        │  pushes board  │
│  4 stage groups, 8 status lanes                      │  left          │
│                                                      │                │
│  INTAKE  ·  ACTIVE  ·  HANDOFF  ·  DONE              │                │
│                                                      │                │
└──────────────────────────────────────────────────────┴────────────────┘
```

### 7.2 Stage groups
The 8 statuses (`intake`, `ready`, `assigned`, `in_progress`, `awaiting_handover`, `under_review`, `evaluation`, `completed`) stay as discrete lanes (workflow integrity rule, `PRIMER.md`). They are visually clustered under four caption labels:

- `INTAKE` — intake, ready
- `ACTIVE` — assigned, in_progress
- `HANDOFF` — awaiting_handover, under_review, evaluation
- `DONE` — completed (collapsed by default; chevron expands)

`blocked` and `reopened` are not lanes. They surface as:
- A red banner across the top control bar when count > 0 ("3 tasks blocked · review →").
- A filter chip in the top control bar to focus the board.

### 7.3 Card content (spacious)
- Title (14px, 2-line clamp).
- Assignee avatar + initial.
- Priority pill.
- Age (relative).
- Dependency count if any.
- Hover reveals: drag handle and keyboard hint `J/K to move`.
- No inline status pill — column position is the status.

### 7.4 Drag-and-drop with transition validation
- `@dnd-kit/core` (chosen over `react-beautiful-dnd` for Windows reliability and React 19 support).
- Drop targets compute from allowed transitions in `services/workflow.py`. The implementation plan must verify that the tasks read endpoint already returns the allowed-next set; if not, an additive read endpoint (e.g., `GET /api/v1/tasks/:id/transitions`) is permitted under §11's read-only carve-out.
- Invalid lanes dim and refuse drop, with a tooltip explaining the missing transition requirement.
- Replaces today's pattern where the API rejects the transition post-hoc.

### 7.5 Bulk select + transition
- Shift-click to multi-select cards.
- Bottom action bar slides up showing available bulk transitions.
- Closes `NEXT.md` Immediate Queue item #4.

### 7.6 Inspector (`Sheet`)
- Opens on card click; slides from the right; 480px wide.
- Sections are `Tabs`:
  - **Overview** — transition builder, dependencies, blockers.
  - **Activity** — worklogs + handovers timeline. Includes the shared `worklog-composer` with a one-click "log this transition" preset that auto-fills `action_type=PROGRESS`.
  - **Evaluation** — score display and request flow.
  - **Memory** — promotion suggestions and context.
- Each section is one viewport tall; no nested scroll-past.
- `Esc` or click-outside dismisses.
- Deep link `?task=<id>` opens the inspector on page load.

### 7.7 Views beyond Kanban
- Three view tabs in the top control bar: `Board` (default) · `List` (sortable, filterable table) · `Timeline` (Gantt-ish; uses existing `/api/v1/timeline`).

### 7.8 Empty state
A single centered prompt — "No tasks yet · Create the first one →" — instead of empty lanes.

## 8. Node and build fixes

### 8.1 Hard build failure
`next build` fails with:
```
Error: <Html> should not be imported outside of pages/_document.
Error occurred prerendering page "/500".
```

Fix: add three App Router pages so Next never falls back to the Pages-router `_error` stub.
- `apps/web/src/app/error.tsx` — segment error boundary, client component.
- `apps/web/src/app/global-error.tsx` — root error boundary (must render its own `<html>` and `<body>`).
- `apps/web/src/app/not-found.tsx` — App Router 404 with sidebar context preserved.

All three use the new dark theme and primitives.

### 8.2 `NODE_ENV` non-standard warning
`apps/web/.env.local` does not currently contain `NODE_ENV` — the warning likely originates from the parent shell environment or a `.env` higher in the tree. Implementation step:
1. Run `printenv NODE_ENV` and check `apps/web/.env*`, repo `.env`, and `package.json` `scripts` for any explicit `NODE_ENV=...` setting.
2. Remove or correct the offending source.
3. If the intent was a build-time flag, replace with a `NEXT_PUBLIC_*` variable read at runtime.

### 8.3 ESLint react-hooks warnings
- `apps/web/src/app/tasks/page.tsx:195` — missing `selectedTask` dep. Add it; verify no infinite-loop introduced by the change. If hoisting required, derive via `useMemo`.
- `apps/web/src/hooks/use-polling-query.ts:53` — spread element in dep array. Refactor to take a single `queryKey: string` and use it as the dep. This is the same surface area the polling-flicker bug commit (`d2b34fc`) was chasing; fixing the deps array is a stronger fix.

### 8.4 Build hardening
- Enable `experimental.typedRoutes: true` in `next.config.ts`.
- Add `pnpm typecheck` script in root `package.json` (`tsc --noEmit -p apps/web/tsconfig.json`); document in `CLAUDE.md`.
- Pin `engines` in root `package.json`: `node >= 20.11`, `pnpm = 10.18.0`.
- Add `apps/web/.nvmrc` with `20.11.1`.

## 9. Migration and rollout

Five sequential PRs. PR 4 and PR 5 may run in parallel after PR 3 lands. Each PR is independently shippable.

| PR | Title | Visible change | Build state |
|---|---|---|---|
| 1 | Foundation | None to user; tokens + primitives + Node fixes | `next build` goes green |
| 2 | Theme flip + shared shell | Whole app turns dark in one commit | Green |
| 3 | Theme-only route polish | Dashboard, Projects, Agents, Evaluations, Tools cleaned up | Green |
| 4 | `/operations` deep rebuild | Three-column workspace, manager slot, right rail | Green |
| 5 | `/tasks` deep rebuild | Board + side inspector, dnd-kit, list/timeline views | Green |

Each PR ends with a UAT pass:
- `pnpm qa:uat` for full coverage.
- `pnpm qa:uat:ux` after PR 3.
- `pnpm qa:uat` and `pnpm qa:uat:agent` after PR 4 and PR 5.

## 10. Testing strategy

- Backend `pytest` suite stays green throughout — no API changes in this refactor.
- The OpenAI tester harness in `apps/tester` is the integration safety net.
- Manual smoke checklist per route (added to the implementation plan, not this spec).
- No visual-regression infrastructure introduced — too noisy for a token-driven theme migration.

## 11. Out of scope

These are explicit non-goals for this refactor. None can be added without re-opening the spec.

- Light-mode toggle UI.
- Density toggle UI.
- Mobile-responsive design below tablet width.
- Visual-regression test infrastructure.
- Auth provider changes (Clerk stays).
- Backend behavior or schema changes. **Carve-out:** additive read-only endpoints are permitted *only* when a frontend feature in this spec genuinely needs data the existing API does not expose (e.g., allowed transitions for a task, global search). Such endpoints must not change persistence or business logic; they wrap existing services.
- Replacement of `useResilientEventStream` or polling fallback logic.
- Migration to a different rendering mode (RSC boundaries are kept as-is).

## 12. Repo hygiene

- Add `.superpowers/` to `.gitignore` to keep brainstorm session files out of git.

## 13. Acceptance criteria

The refactor is complete when all of the following are true:

1. `pnpm build` exits 0 with no errors. ESLint warnings cleared on the two named files.
2. Every route renders in Dark Ops with no light-theme remnants.
3. `/operations` and `/tasks` match the IA described in §6 and §7.
4. The four theme-only routes match the polish pass described in §5.
5. The `apps/tester` UAT harness passes after each of PR 3, PR 4, and PR 5.
6. No backend test (`pytest apps/api/tests`) regresses.
