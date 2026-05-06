# Frontend Dark Ops Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `apps/web` to a Dark Ops (Agent Control Room) theme with a shadcn primitive layer, deep-rebuild `/operations` and `/tasks`, polish the other four routes, and fix the failing `next build` plus related Node hygiene.

**Architecture:** Token-driven dark theme via CSS custom properties + Tailwind, headless Radix primitives copied into `src/components/ui/`, three-column workspace for Operations, board + side-inspector for Tasks. Five sequential PRs, each independently shippable with `next build` green at every checkpoint.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5.8 · Tailwind 3.4 · Radix UI · shadcn/ui copy-in · `@dnd-kit/core` · `lucide-react` · Clerk · pnpm 10.18.

**Reference spec:** `docs/superpowers/specs/2026-05-06-frontend-dark-ops-refactor-design.md` — re-read before starting any PR.

**Verification model:** Frontend has no unit-test infra; we use `pnpm --filter @sentientops/web build`, `pnpm typecheck`, `pnpm --filter @sentientops/web lint`, manual smoke in `pnpm dev:web`, and `pnpm qa:uat*` as integration safety net. Each PR ends with all four passing.

**Working directory baseline:** all paths are relative to repo root `D:/AI and ML/Synapse_OS`. Windows + PowerShell. Where a command says `pnpm`, it works equally on cmd/PowerShell because `pnpm` is on PATH. Backslash file paths in prose; forward slashes in code.

---

## PR 1 — Foundation: Node fixes, tokens, primitive layer

**Goal of this PR:** `next build` exits 0, ESLint warnings cleared on the two named files, all primitives exist in `src/components/ui/`, but no visible UI change yet.

**Branch:** `feat/dark-ops-foundation`

### Task 1.1: Add App Router error pages

**Files:**
- Create: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`
- Create: `apps/web/src/app/not-found.tsx`

- [ ] **Step 1: Create `apps/web/src/app/error.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tertiary">
        Something went wrong
      </p>
      <h1 className="font-display text-2xl font-bold text-ink">
        This view failed to load
      </h1>
      <p className="max-w-md text-sm text-ink-secondary">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
      >
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/app/global-error.tsx`**

`global-error.tsx` is a special App Router file: it must render its own `<html>` and `<body>` tags because it replaces the root layout when an error occurs there.

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090f",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          padding: "32px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          Fatal error
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "8px 0 16px" }}>
          The application stopped responding
        </h1>
        <p style={{ maxWidth: 480, textAlign: "center", color: "#94a3b8" }}>
          {error.message || "An unexpected error occurred at the root of the app."}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "8px 16px",
            background: "#22d3a8",
            color: "#07090f",
            border: 0,
            borderRadius: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tertiary">
        404
      </p>
      <h1 className="font-display text-2xl font-bold text-ink">
        Route not found
      </h1>
      <p className="max-w-md text-sm text-ink-secondary">
        The path you tried to open does not exist in this build.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Verify build no longer fails on prerender**

Run: `pnpm --filter @sentientops/web build`
Expected: `Error: <Html> should not be imported outside of pages/_document.` no longer appears. Build may still emit the NODE_ENV warning and the two ESLint warnings — those are fixed in tasks 1.2 and 1.3.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/error.tsx apps/web/src/app/global-error.tsx apps/web/src/app/not-found.tsx
git commit -m "fix(web): add App Router error/not-found pages to unblock next build"
```

### Task 1.2: Remove NODE_ENV from .env files

**Files:**
- Modify: `D:/AI and ML/Synapse_OS/.env` (line 2 currently `NODE_ENV=development`)
- Modify: `D:/AI and ML/Synapse_OS/.env.example` (line 2 currently `NODE_ENV=development`)
- Modify: `D:/AI and ML/Synapse_OS/ops/scripts/api-dev.ps1` (the script imports the .env into the shell environment, which then leaks into any pnpm command run in the same session)

- [ ] **Step 1: Remove `NODE_ENV=development` line from `.env`**

The line is at the top of the file under the `# Shared` heading. Remove the `NODE_ENV=development` line and the `# Shared` heading if it has nothing else under it. Leave a blank line where the heading was so subsequent lines stay aligned with `.env.example`.

- [ ] **Step 2: Remove `NODE_ENV=development` line from `.env.example`** with the same edit.

- [ ] **Step 3: Confirm `api-dev.ps1` does not need a guard**

`api-dev.ps1` uses `Import-RepoEnv` which iterates lines and calls `Set-Item -Path "Env:$name" -Value $value`. With `NODE_ENV` no longer in `.env`, no guard is needed. Reading-only confirmation step.

- [ ] **Step 4: Verify build is clean of the warning**

In a fresh PowerShell session (so any leaked NODE_ENV from a previous `dev:api` run is gone):

```powershell
$env:NODE_ENV = $null
pnpm --filter @sentientops/web build
```

Expected: `⚠ You are using a non-standard "NODE_ENV" value` is gone.

- [ ] **Step 5: Commit**

```bash
git add .env .env.example
git commit -m "fix: stop pinning NODE_ENV in .env files (Next sets it per command)"
```

### Task 1.3: Fix ESLint react-hooks warnings

**Files:**
- Modify: `apps/web/src/hooks/use-polling-query.ts` (replace `deps: unknown[]` API with `queryKey: string`)
- Modify: `apps/web/src/app/tasks/page.tsx` line 195 (use `selectedTask` not `selectedTask?.id` in dep array)
- Modify: every call site of `usePollingQuery` to pass a `queryKey` string

- [ ] **Step 1: Refactor `use-polling-query.ts` to use `queryKey: string`**

Replace the entire file with:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UsePollingQueryOptions<T> = {
  enabled?: boolean;
  intervalMs?: number;
  initialData?: T | null;
};

export function usePollingQuery<T>(
  fetcher: () => Promise<T>,
  queryKey: string,
  options: UsePollingQueryOptions<T> = {}
) {
  const { enabled = true, intervalMs = 10_000, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!enabled) return;
    if (!hasFetchedRef.current) setIsLoading(true);
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void run();
  }, [run, queryKey]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, run]);

  return useMemo(
    () => ({ data, error, isLoading, lastUpdatedAt, refresh: run }),
    [data, error, isLoading, lastUpdatedAt, run]
  );
}
```

The `// eslint-disable-next-line` comment is removed because the dependency is now a single string, statically verifiable.

- [ ] **Step 2: Update every call site to pass a string key**

Run a find for `usePollingQuery(` across `apps/web/src`:

```powershell
Get-ChildItem -Recurse apps/web/src -Include *.ts,*.tsx | Select-String -Pattern "usePollingQuery\("
```

For each call site, replace the second arg (an array of deps) with a single string built from the same identifying values, joined by `:`. Examples:

```ts
// before
const query = usePollingQuery(
  () => getDashboardSummary({ actorId: actor.actorId }),
  [actor.actorId],
  { enabled: actor.ready, initialData: emptySummary }
);

// after
const query = usePollingQuery(
  () => getDashboardSummary({ actorId: actor.actorId }),
  `dashboard:${actor.actorId}`,
  { enabled: actor.ready, initialData: emptySummary }
);
```

```ts
// before
const boardQuery = usePollingQuery(
  () => getBoard({ actorId: actor.actorId }, projectId),
  [actor.actorId, projectId],
  { enabled: actor.ready && Boolean(projectId), intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
);

// after
const boardQuery = usePollingQuery(
  () => getBoard({ actorId: actor.actorId }, projectId),
  `board:${actor.actorId}:${projectId}`,
  { enabled: actor.ready && Boolean(projectId), intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
);
```

The composition rule: include every variable the array used to include, in the same order, separated by `:`. If a value can be empty, use `?? "_"` to keep the string stable.

- [ ] **Step 3: Fix `tasks/page.tsx:195` selected-task effect**

The current effect at lines 192–195:

```tsx
useEffect(() => {
  if (!selectedTask) { setAssignTarget(""); return; }
  setAssignTarget(selectedTask.assigned_to ?? "");
}, [selectedTask?.id]);
```

Replace with:

```tsx
useEffect(() => {
  if (!selectedTask) {
    setAssignTarget("");
    return;
  }
  setAssignTarget(selectedTask.assigned_to ?? "");
}, [selectedTask]);
```

The dep is the whole `selectedTask` object reference. Because `selectedTask` is computed from `boardQuery.data` (which only changes on poll), the reference is stable across renders that don't change the underlying data — no infinite loop.

- [ ] **Step 4: Verify lint and build**

```powershell
pnpm --filter @sentientops/web lint
pnpm --filter @sentientops/web build
```

Expected: zero ESLint warnings. Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-polling-query.ts apps/web/src/app/tasks/page.tsx apps/web/src
git commit -m "fix(web): clear react-hooks/exhaustive-deps warnings in polling and tasks"
```

### Task 1.4: Add typecheck script, engines, .nvmrc, typedRoutes

**Files:**
- Modify: `package.json` (root) — add `typecheck` script and `engines`
- Modify: `apps/web/next.config.ts` — enable `experimental.typedRoutes`
- Create: `apps/web/.nvmrc`

- [ ] **Step 1: Update root `package.json`**

Add `typecheck` to `scripts` and an `engines` field:

```json
{
  "name": "sentientops-v1",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.18.0",
  "engines": {
    "node": ">=20.11",
    "pnpm": ">=10.18"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:web": "pnpm --filter @sentientops/web dev",
    "dev:api": "powershell -ExecutionPolicy Bypass -File ops/scripts/api-dev.ps1",
    "dev:worker": "powershell -ExecutionPolicy Bypass -File ops/scripts/outbox-worker-dev.ps1",
    "dev:mcp": "powershell -ExecutionPolicy Bypass -File ops/scripts/mcp-dev.ps1",
    "qa:uat": "powershell -ExecutionPolicy Bypass -File ops/scripts/uat-run.ps1 --scenario full_uat",
    "qa:uat:blocked": "powershell -ExecutionPolicy Bypass -File ops/scripts/uat-run.ps1 --scenario blocked_recovery",
    "qa:uat:agent": "powershell -ExecutionPolicy Bypass -File ops/scripts/uat-run.ps1 --scenario agent_surface",
    "qa:uat:ux": "powershell -ExecutionPolicy Bypass -File ops/scripts/uat-run.ps1 --scenario ux_friction",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm --filter @sentientops/web exec tsc --noEmit -p tsconfig.json"
  }
}
```

- [ ] **Step 2: Enable typedRoutes in `apps/web/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Create `apps/web/.nvmrc`**

File contents (no trailing newline matters, but include one):

```
20.11.1
```

- [ ] **Step 4: Verify typecheck and build**

```powershell
pnpm typecheck
pnpm --filter @sentientops/web build
```

Expected: typecheck passes, build succeeds. If `typedRoutes` flags any `<Link href>` issues, fix them inline (most likely none in current code since all `href`s are static).

- [ ] **Step 5: Commit**

```bash
git add package.json apps/web/next.config.ts apps/web/.nvmrc
git commit -m "chore: add typecheck script, pin engines, enable typedRoutes"
```

### Task 1.5: Install primitive-layer dependencies

**Files:**
- Modify: `apps/web/package.json` (deps and devDeps)

- [ ] **Step 1: Install runtime deps**

```powershell
pnpm --filter @sentientops/web add `
  @radix-ui/react-avatar `
  @radix-ui/react-checkbox `
  @radix-ui/react-dialog `
  @radix-ui/react-dropdown-menu `
  @radix-ui/react-popover `
  @radix-ui/react-scroll-area `
  @radix-ui/react-select `
  @radix-ui/react-separator `
  @radix-ui/react-slot `
  @radix-ui/react-tabs `
  @radix-ui/react-toast `
  @radix-ui/react-tooltip `
  class-variance-authority `
  clsx `
  cmdk `
  lucide-react `
  tailwind-merge `
  vaul `
  @dnd-kit/core `
  @dnd-kit/sortable `
  @dnd-kit/utilities
```

`vaul` is the drawer primitive used by shadcn's `drawer.tsx`. `cmdk` is the command palette primitive used by `command.tsx`. `@dnd-kit/*` lands now even though it's used in PR 5, because installing once now keeps the lockfile churn to a single PR.

- [ ] **Step 2: Verify install + build**

```powershell
pnpm install
pnpm --filter @sentientops/web build
```

Expected: lockfile updates, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add Radix, shadcn deps, lucide, dnd-kit for primitive layer"
```

### Task 1.6: Create `cn` utility and tokens layer

**Files:**
- Create: `apps/web/src/lib/cn.ts`
- Modify: `apps/web/src/app/globals.css` — replace existing token-driven classes with the dark-ops token set
- Modify: `apps/web/tailwind.config.ts` — wire colors and shadows to CSS variables

- [ ] **Step 1: Create `apps/web/src/lib/cn.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Replace `apps/web/src/app/globals.css` with dark-ops tokens**

The full new file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: dark;

    --bg-base: #07090f;
    --bg-surface: #0f172a;
    --bg-raised: #131c2e;
    --bg-inset: #0b1220;

    --edge: #1e293b;
    --edge-bright: #2a3957;
    --edge-muted: #131c2e;

    --ink: #e2e8f0;
    --ink-secondary: #94a3b8;
    --ink-tertiary: #64748b;
    --ink-ghost: #475569;

    --signal: #22d3a8;
    --signal-dim: rgba(34, 211, 168, 0.10);
    --signal-glow: rgba(34, 211, 168, 0.18);

    --warn: #fbbf24;
    --warn-dim: rgba(251, 191, 36, 0.10);

    --danger: #f87171;
    --danger-dim: rgba(248, 113, 113, 0.10);

    --info: #60a5fa;
    --info-dim: rgba(96, 165, 250, 0.10);

    --accent: #a78bfa;
    --accent-dim: rgba(167, 139, 250, 0.10);
  }

  html, body {
    width: 100%;
    max-width: 100%;
  }

  body {
    min-height: 100vh;
    overflow-x: hidden;
    background-color: var(--bg-base);
    background-image:
      radial-gradient(ellipse at 15% 8%, rgba(34, 211, 168, 0.04), transparent 50%),
      radial-gradient(ellipse at 85% 12%, rgba(96, 165, 250, 0.03), transparent 40%),
      radial-gradient(ellipse at 50% 95%, rgba(167, 139, 250, 0.02), transparent 50%);
    color: var(--ink);
    font-family: var(--font-body), sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  * {
    box-sizing: border-box;
    border-color: var(--edge);
  }

  ::selection {
    background: var(--signal-dim);
    color: var(--ink);
  }
}

@layer components {
  .surface {
    border: 1px solid var(--edge);
    border-radius: 16px;
    background: var(--bg-surface);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  }

  .surface-raised {
    border: 1px solid var(--edge-bright);
    border-radius: 16px;
    background: var(--bg-raised);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.30);
  }

  .surface-inset {
    border: 1px solid var(--edge-muted);
    border-radius: 12px;
    background: var(--bg-inset);
  }

  .glow-signal { border-color: rgba(34, 211, 168, 0.30); box-shadow: 0 0 16px var(--signal-glow); }
  .glow-warn   { border-color: rgba(251, 191, 36, 0.30); box-shadow: 0 0 16px rgba(251, 191, 36, 0.15); }
  .glow-danger { border-color: rgba(248, 113, 113, 0.30); box-shadow: 0 0 16px rgba(248, 113, 113, 0.15); }
  .glow-info   { border-color: rgba(96, 165, 250, 0.30); box-shadow: 0 0 16px rgba(96, 165, 250, 0.15); }

  .title-gradient {
    background: linear-gradient(115deg, #94a3b8, #22d3a8 50%, #a78bfa);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .soft-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .soft-scroll::-webkit-scrollbar-track { background: transparent; border-radius: 999px; }
  .soft-scroll::-webkit-scrollbar-thumb { background: var(--edge); border-radius: 999px; }
  .soft-scroll::-webkit-scrollbar-thumb:hover { background: var(--edge-bright); }

  select, input[type="text"], input[type="search"], textarea {
    background-color: var(--bg-inset);
    border: 1px solid var(--edge);
    color: var(--ink);
  }

  select:focus, input:focus, textarea:focus {
    outline: none;
    border-color: rgba(34, 211, 168, 0.45);
    box-shadow: 0 0 0 2px var(--signal-dim);
  }

  .live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--signal);
    box-shadow: 0 0 8px var(--signal-glow);
    animation: pulse-live 2s ease-in-out infinite;
  }
  .live-dot-warn { background-color: var(--warn); box-shadow: 0 0 8px rgba(251, 191, 36, 0.30); }
  .live-dot-danger { background-color: var(--danger); box-shadow: 0 0 8px rgba(248, 113, 113, 0.30); }
}

@layer utilities {
  .text-balance { text-wrap: balance; }
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes fade-up {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 3: Replace `apps/web/tailwind.config.ts` with token-bound colors**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        canvas: {
          deep: "var(--bg-base)",
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          raised: "var(--bg-raised)",
          inset: "var(--bg-inset)",
        },
        edge: {
          DEFAULT: "var(--edge)",
          bright: "var(--edge-bright)",
          muted: "var(--edge-muted)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          tertiary: "var(--ink-tertiary)",
          ghost: "var(--ink-ghost)",
        },
        signal: {
          DEFAULT: "var(--signal)",
          dim: "var(--signal-dim)",
          glow: "var(--signal-glow)",
        },
        warn: { DEFAULT: "var(--warn)", dim: "var(--warn-dim)" },
        danger: { DEFAULT: "var(--danger)", dim: "var(--danger-dim)" },
        info: { DEFAULT: "var(--info)", dim: "var(--info-dim)" },
        accent: { DEFAULT: "var(--accent)", dim: "var(--accent-dim)" },
      },
      boxShadow: {
        glow: "0 0 16px var(--signal-glow)",
        "glow-warn": "0 0 16px rgba(251, 191, 36, 0.15)",
        "glow-danger": "0 0 16px rgba(248, 113, 113, 0.15)",
        depth: "0 4px 12px rgba(0, 0, 0, 0.20)",
        "depth-lg": "0 10px 25px rgba(0, 0, 0, 0.30)",
      },
      animation: {
        "fade-up": "fade-up 500ms ease-out both",
        "pulse-live": "pulse-live 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Verify build still succeeds**

The existing pages still use class names like `bg-canvas-deep`, `text-ink`, `border-edge` — all still resolved via tokens. The visual rendering will be wrong (light pages on a dark body) but build/typecheck must succeed.

```powershell
pnpm typecheck
pnpm --filter @sentientops/web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cn.ts apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(web): introduce dark-ops CSS token layer + tailwind binding"
```

### Task 1.7: Create primitive components

**Files:** Create the following under `apps/web/src/components/ui/`:
- `button.tsx` · `card.tsx` · `badge.tsx` · `status-pill.tsx` · `input.tsx` · `textarea.tsx` · `select.tsx` · `checkbox.tsx` · `dialog.tsx` · `drawer.tsx` · `sheet.tsx` · `tooltip.tsx` · `dropdown-menu.tsx` · `tabs.tsx` · `toast.tsx` · `skeleton.tsx` · `avatar.tsx` · `separator.tsx` · `scroll-area.tsx` · `command.tsx`

Each primitive is a thin client component on top of Radix (or `cmdk`/`vaul` for command/drawer) styled with our dark-ops tokens. Following are the canonical implementations for the primitives that the rest of the plan references. Implementations not shown here are 1:1 with shadcn defaults but using our tokens — the engineer can copy from `https://ui.shadcn.com/docs/components/<name>` and replace any `bg-background`/`text-foreground` with our token-aligned utilities (`bg-canvas-surface`/`text-ink` etc.).

- [ ] **Step 1: `button.tsx`**

```tsx
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-signal text-canvas-base hover:bg-signal/90 shadow-glow",
        secondary: "bg-canvas-raised text-ink hover:bg-canvas-raised/80 border border-edge",
        ghost: "text-ink-secondary hover:bg-canvas-raised hover:text-ink",
        danger: "bg-danger text-canvas-base hover:bg-danger/90",
        outline: "border border-edge text-ink-secondary hover:border-edge-bright hover:text-ink",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
export { buttonVariants };
```

- [ ] **Step 2: `card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("surface p-5", className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-between gap-4 pb-4", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("font-display text-lg font-bold text-ink", className)} {...props} />
);

export const CardSubtitle = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary", className)} {...props} />
);

export const CardBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-3", className)} {...props} />
);
```

- [ ] **Step 3: `badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
  {
    variants: {
      tone: {
        signal: "bg-signal-dim text-signal",
        warn: "bg-warn-dim text-warn",
        danger: "bg-danger-dim text-danger",
        info: "bg-info-dim text-info",
        accent: "bg-accent-dim text-accent",
        neutral: "bg-canvas-raised text-ink-secondary border border-edge",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone, className }))} {...props} />
);
```

- [ ] **Step 4: `status-pill.tsx`**

```tsx
import * as React from "react";
import type { TaskStatus } from "@sentientops/contracts";
import { Badge } from "./badge";

const STATUS_TONE: Record<string, "signal" | "warn" | "danger" | "info" | "accent" | "neutral"> = {
  intake: "neutral",
  backlog: "neutral",
  ready: "info",
  assigned: "info",
  in_progress: "warn",
  awaiting_handover: "accent",
  under_review: "accent",
  evaluation: "accent",
  blocked: "danger",
  completed: "signal",
  reopened: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  intake: "Intake",
  backlog: "Backlog",
  ready: "Ready",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_handover: "Awaiting handover",
  under_review: "Under review",
  evaluation: "Evaluation",
  blocked: "Blocked",
  completed: "Completed",
  reopened: "Reopened",
};

export function StatusPill({ status }: { status: TaskStatus | string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status] ?? status}</Badge>;
}
```

- [ ] **Step 5: `input.tsx` and `textarea.tsx`**

```tsx
// input.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-edge bg-canvas-inset px-3 text-sm text-ink placeholder:text-ink-ghost focus:border-signal/50 focus:outline-none focus:ring-2 focus:ring-signal/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

```tsx
// textarea.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[80px] w-full rounded-xl border border-edge bg-canvas-inset px-3 py-2 text-sm text-ink placeholder:text-ink-ghost focus:border-signal/50 focus:outline-none focus:ring-2 focus:ring-signal/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 6: Copy in remaining shadcn primitives**

For the remaining primitives — `select`, `checkbox`, `dialog`, `drawer`, `sheet`, `tooltip`, `dropdown-menu`, `tabs`, `toast`, `skeleton`, `avatar`, `separator`, `scroll-area`, `command` — copy the latest shadcn implementation verbatim (from `https://ui.shadcn.com/docs/components/<name>`), then in each file:

1. Change `import { cn } from "@/lib/utils"` to `import { cn } from "@/lib/cn"`.
2. Replace any color utility from the shadcn defaults with our tokens:
   - `bg-background` → `bg-canvas-base`
   - `bg-popover` / `bg-card` → `bg-canvas-surface`
   - `bg-muted` → `bg-canvas-raised`
   - `text-foreground` → `text-ink`
   - `text-muted-foreground` → `text-ink-secondary`
   - `border` (when used as a color) → `border-edge`
   - `ring-ring` → `ring-signal/40`
   - Any `bg-primary` → `bg-signal`, `text-primary-foreground` → `text-canvas-base`
   - Any `bg-destructive` → `bg-danger`, `text-destructive-foreground` → `text-canvas-base`
3. Where shadcn components rely on a `tailwindcss-animate` plugin we don't have, remove the plugin-specific classes (`data-[state=open]:animate-in` etc.) and rely on Radix's default animation classes or omit. The components remain functional without the entrance animation.

- [ ] **Step 7: Add an index re-export**

`apps/web/src/components/ui/index.ts`:

```ts
export * from "./avatar";
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./checkbox";
export * from "./command";
export * from "./dialog";
export * from "./drawer";
export * from "./dropdown-menu";
export * from "./input";
export * from "./scroll-area";
export * from "./select";
export * from "./separator";
export * from "./sheet";
export * from "./skeleton";
export * from "./status-pill";
export * from "./tabs";
export * from "./textarea";
export * from "./toast";
export * from "./tooltip";
```

- [ ] **Step 8: Verify build, typecheck, lint**

```powershell
pnpm --filter @sentientops/web build
pnpm typecheck
pnpm --filter @sentientops/web lint
```

Expected: all green. None of the existing pages import the new primitives yet, so this is purely additive.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui apps/web/src/lib/cn.ts
git commit -m "feat(web): add shadcn-derived primitive layer themed for dark ops"
```

### Task 1.8: Add `.superpowers/` to `.gitignore` (housekeeping)

Already added in the spec commit. Confirm by inspecting `.gitignore` — if absent, add the line. Otherwise no commit needed.

### Task 1.9: PR 1 verification gate

- [ ] Run all four checks and confirm green:

```powershell
pnpm --filter @sentientops/web build
pnpm typecheck
pnpm --filter @sentientops/web lint
pnpm dev:web
```

Open `http://localhost:3000` in a browser. The page renders broken (light components on a dark body) — this is expected. The point of this checkpoint is the build and lint pipeline, not visual correctness. Visual flip happens in PR 2.

---

## PR 2 — Theme flip + shared shell rewrite

**Goal of this PR:** Every route turns dark in one commit. `app-shell` and the header are rebuilt on the new primitives. No structural layout change yet to individual route bodies.

**Branch:** `feat/dark-ops-theme-flip`

### Task 2.1: Flip root layout to dark

**Files:** `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Change `<html className="light">` to `<html className="dark">`**

Two occurrences in the file (one in the localTesterAuth branch, one in the Clerk branch). Both update.

- [ ] **Step 2: Update the local-dev badge styling**

The `headerActions` for local mode currently uses `border-signal/30 bg-signal-dim text-signal`. Those classes already resolve to dark-ops tokens, so no change needed. Confirm visually after PR 2 lands.

- [ ] **Step 3: Update Clerk `UserButton` appearance**

```tsx
<UserButton
  appearance={{
    baseTheme: undefined,
    variables: {
      colorBackground: "var(--bg-surface)",
      colorText: "var(--ink)",
      colorPrimary: "var(--signal)",
      colorInputBackground: "var(--bg-inset)",
      colorInputText: "var(--ink)",
    },
    elements: { userButtonAvatarBox: "ring-2 ring-signal/40" },
  }}
/>
```

- [ ] **Step 4: Build and visual smoke**

```powershell
pnpm --filter @sentientops/web build
pnpm dev:web
```

Open `http://localhost:3000`. The background is dark; the existing pages still render their own light surfaces. Sidebar still shows old layout. That's expected — Task 2.2 fixes that.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): flip root layout className to dark + Clerk dark vars"
```

### Task 2.2: Rewrite `app-shell.tsx` on primitives

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx`

- [ ] **Step 1: Replace inline SVG nav icons with `lucide-react`**

Replace the entire file with this implementation. The shell uses lucide icons, sidebar section labels (`PRODUCTION` / `OPS`), a `⌘K` button placeholder (the `command.tsx` palette wires up in Task 2.3), and a system-status block.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FolderKanban,
  SlidersHorizontal,
  KanbanSquare,
  Cpu,
  LineChart,
  Terminal,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string; icon: LucideIcon };

const PRODUCTION: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

const OPS: NavItem[] = [
  { href: "/operations", label: "Operations", icon: SlidersHorizontal },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
  { href: "/agents", label: "Agents", icon: Cpu },
  { href: "/evaluations", label: "Evaluations", icon: LineChart },
  { href: "/tools", label: "Tool Console", icon: Terminal },
];

type AppShellProps = {
  children: React.ReactNode;
  headerActions: React.ReactNode;
  onOpenCommand?: () => void;
};

export function AppShell({ children, headerActions, onOpenCommand }: AppShellProps) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const isActive =
      item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-signal-dim text-signal font-semibold ring-1 ring-signal/30"
            : "text-ink-secondary hover:bg-canvas-raised hover:text-ink"
        )}
      >
        <Icon className={cn("h-4 w-4", isActive ? "text-signal" : "text-ink-tertiary group-hover:text-ink-secondary")} />
        <span>{item.label}</span>
        {isActive && <span className="live-dot ml-auto" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-canvas-base">
      <div className="mx-auto grid w-full max-w-[1680px] gap-4 px-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6">
        <aside className="surface h-fit p-5 lg:sticky lg:top-6">
          <div className="mb-6 border-b border-edge pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal text-canvas-base">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                  <path d="M2 17L12 22L22 17" />
                  <path d="M2 12L12 17L22 12" />
                </svg>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-tertiary">Synapse OS</p>
                <h1 className="font-display text-lg font-bold text-ink">Control Room</h1>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenCommand}
            className="mb-5 w-full justify-between"
          >
            <span className="flex items-center gap-2 text-ink-secondary">
              <Search className="h-4 w-4" /> Search…
            </span>
            <kbd className="rounded bg-canvas-inset px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">⌘K</kbd>
          </Button>

          <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.25em] text-ink-tertiary">Production</p>
          <nav className="mb-5 space-y-1">{PRODUCTION.map(renderItem)}</nav>

          <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.25em] text-ink-tertiary">Ops</p>
          <nav className="space-y-1">{OPS.map(renderItem)}</nav>

          <div className="mt-8 surface-inset p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">System Status</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="live-dot" />
              <span className="text-xs font-medium text-ink-secondary">All Nodes Active</span>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <header className="surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Operational View</p>
              <h2 className="mt-0.5 font-display text-xl font-bold text-ink">SentientOps V1</h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="flex items-center gap-2 rounded-full border border-signal/20 bg-signal-dim px-3 py-1.5 font-mono text-[10px] font-medium text-signal">
                <span className="live-dot" />
                Live
              </span>
              {headerActions}
            </div>
          </header>

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build, typecheck, lint**

```powershell
pnpm --filter @sentientops/web build
pnpm typecheck
pnpm --filter @sentientops/web lint
```

- [ ] **Step 3: Visual smoke**

`pnpm dev:web`. Sidebar now shows section labels and lucide icons; header simplified; routes still render their own (now mismatched) bodies. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app-shell.tsx
git commit -m "feat(web): rebuild AppShell on primitives with section labels and lucide icons"
```

### Task 2.3: Wire ⌘K command palette

**Files:**
- Create: `apps/web/src/components/command-palette.tsx`
- Modify: `apps/web/src/app/layout.tsx` to render the palette and pass `onOpenCommand` to `AppShell`

The palette uses existing list endpoints client-side (no new API). On open, it lazily fetches projects/tasks/agents in parallel (one-shot, not polling) and merges results with a fuzzy match.

- [ ] **Step 1: Create `apps/web/src/components/command-palette.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useActor } from "@/hooks/use-actor";
import { listProjects, listTasks, listAgents } from "@/lib/api-client";
import type { ProjectContract, TaskContract, AgentContract } from "@sentientops/contracts";

type Hit = { kind: "route" | "project" | "task" | "agent"; id: string; label: string; href: string };

const ROUTES: Hit[] = [
  { kind: "route", id: "dashboard", label: "Dashboard", href: "/" },
  { kind: "route", id: "projects", label: "Projects", href: "/projects" },
  { kind: "route", id: "operations", label: "Operations", href: "/operations" },
  { kind: "route", id: "tasks", label: "Tasks", href: "/tasks" },
  { kind: "route", id: "agents", label: "Agents", href: "/agents" },
  { kind: "route", id: "evaluations", label: "Evaluations", href: "/evaluations" },
  { kind: "route", id: "tools", label: "Tool Console", href: "/tools" },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const actor = useActor();
  const [projects, setProjects] = React.useState<ProjectContract[]>([]);
  const [tasks, setTasks] = React.useState<TaskContract[]>([]);
  const [agents, setAgents] = React.useState<AgentContract[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open || loaded || !actor.ready) return;
    Promise.all([
      listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
      listTasks({ actorId: actor.actorId, actorRole: actor.actorRole }, { limit: 200 }),
      listAgents({ actorId: actor.actorId, actorRole: actor.actorRole }, { limit: 200 }),
    ])
      .then(([p, t, a]) => {
        setProjects(p.items);
        setTasks(t.items);
        setAgents(a.items);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, actor.ready, actor.actorId, actor.actorRole]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href as never);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search routes, projects, tasks, agents…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Routes">
          {ROUTES.map((r) => (
            <CommandItem key={r.id} onSelect={() => go(r.href)}>{r.label}</CommandItem>
          ))}
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem key={p.id} onSelect={() => go(`/operations?project=${p.id}`)}>
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.slice(0, 30).map((t) => (
              <CommandItem key={t.id} onSelect={() => go(`/tasks?project=${t.project_id}&task=${t.id}`)}>
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {agents.length > 0 && (
          <CommandGroup heading="Agents">
            {agents.slice(0, 30).map((a) => (
              <CommandItem key={a.id} onSelect={() => go(`/agents?id=${a.id}`)}>
                {a.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Wire palette into both branches of `layout.tsx`**

In the existing layout, both branches (`localTesterAuth` and Clerk) render `<AppShell>`. Wrap each branch's content in a `useState`-bearing client wrapper, or extract a small client component that owns the palette state. Recommended: extract.

Create `apps/web/src/components/shell-with-palette.tsx`:

```tsx
"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";

export function ShellWithPalette({ children, headerActions }: { children: React.ReactNode; headerActions: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  return (
    <>
      <AppShell headerActions={headerActions} onOpenCommand={() => setPaletteOpen(true)}>
        {children}
      </AppShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
```

In `apps/web/src/app/layout.tsx`, replace `<AppShell …>{children}</AppShell>` in both branches with `<ShellWithPalette …>{children}</ShellWithPalette>`. The import changes accordingly.

- [ ] **Step 3: Verify build + manual test**

```powershell
pnpm --filter @sentientops/web build
pnpm dev:web
```

Press `⌘K` (or Ctrl+K on Windows) — palette opens, search filters across routes/projects/tasks/agents, selecting an item navigates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/command-palette.tsx apps/web/src/components/shell-with-palette.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): add ⌘K command palette across routes/projects/tasks/agents"
```

### Task 2.4: PR 2 verification gate

- [ ] Build, typecheck, lint, dev smoke. Confirm:
  - All routes render on a dark body.
  - Sidebar uses lucide icons and section labels.
  - `⌘K` opens the palette.
  - No console errors on any route.

---

## PR 3 — Theme-only route polish

**Goal:** Each of `/`, `/projects`, `/agents`, `/evaluations`, `/tools` rebuilt on primitives with the cleanups described in spec §5. No route gets a structural overhaul; `/operations` and `/tasks` stay untouched (those are PR 4 and PR 5).

**Branch:** `feat/dark-ops-route-polish`

### Task 3.1: Dashboard polish

**Files:** `apps/web/src/app/page.tsx`

- [ ] **Step 1: Replace the page with a primitive-driven version**

Goals from spec §5.1:
- Drop ornamental labels ("Operational Overview", "Global Pulse", "Real-time").
- Merge the dual-styled alerts into a single chronological feed.
- Replace inline SVGs with lucide.
- Add empty states with help text and one CTA per panel.

Full file:

```tsx
"use client";

import type { DashboardSummary } from "@sentientops/contracts";
import Link from "next/link";
import { FolderKanban, KanbanSquare, Terminal, AlertTriangle, ShieldCheck } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { QueryState } from "@/components/query-state";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { getDashboardSummary } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

const empty: DashboardSummary = {
  totals: { active_projects: 0, tasks_in_progress: 0, blocked_tasks: 0, recent_handovers: 0, low_score_alerts: 0 },
  alerts: { blocked_tasks: [], low_scores: [] },
  projects: [],
  recent_handovers: [],
  recent_evaluations: [],
};

export default function HomePage() {
  const actor = useActor();
  const query = usePollingQuery(
    () => getDashboardSummary({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `dashboard:${actor.actorId}`,
    { enabled: actor.ready, initialData: empty }
  );
  const summary = query.data ?? empty;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Operations</CardSubtitle>
            <CardTitle>Daily overview</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button asChild variant="outline" size="sm"><Link href="/projects"><FolderKanban className="h-4 w-4" /> Projects</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/tasks"><KanbanSquare className="h-4 w-4" /> Tasks</Link></Button>
            <Button asChild size="sm"><Link href="/tools"><Terminal className="h-4 w-4" /> Open console</Link></Button>
          </div>
        </CardHeader>
        <QueryState isLoading={query.isLoading} error={query.error} lastUpdatedAt={query.lastUpdatedAt} />
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Active projects" value={summary.totals.active_projects} tone="signal" />
        <MetricCard label="In progress" value={summary.totals.tasks_in_progress} />
        <MetricCard label="Blocked" value={summary.totals.blocked_tasks} tone="danger" />
        <MetricCard label="Handovers (7d)" value={summary.totals.recent_handovers} tone="accent" />
        <MetricCard label="Low scores" value={summary.totals.low_score_alerts} tone="warn" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Active clusters</CardTitle><Badge tone="signal">Live</Badge></CardHeader>
          {summary.projects.length === 0 ? (
            <EmptyState
              title="No active projects"
              hint="Create your first project to begin staffing agents."
              ctaLabel="Create project"
              ctaHref="/projects"
            />
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4 text-center">Tasks</th>
                  <th className="pb-3 pr-4 text-center">Blocked</th>
                  <th className="pb-3 text-center">Evals</th>
                </tr>
              </thead>
              <tbody className="text-ink-secondary">
                {summary.projects.map((p) => (
                  <tr key={p.project_id} className="border-t border-edge transition hover:bg-canvas-raised/40">
                    <td className="py-3.5 pr-4 font-semibold text-ink">{p.name}</td>
                    <td className="py-3.5 pr-4"><Badge tone="signal">{p.status}</Badge></td>
                    <td className="py-3.5 pr-4 text-center font-mono">{p.task_count}</td>
                    <td className="py-3.5 pr-4 text-center font-mono">{p.blocked_count > 0 ? <span className="text-danger font-bold">{p.blocked_count}</span> : <span className="text-ink-tertiary">0</span>}</td>
                    <td className="py-3.5 text-center font-mono">{p.evaluation_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <AlertsFeed summary={summary} />
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Recent evaluations</CardTitle></CardHeader>
        {summary.recent_evaluations.length === 0 ? (
          <EmptyState
            title="No evaluations yet"
            hint="Evaluations appear here once tasks complete the evaluator workflow."
            ctaLabel="View workflow"
            ctaHref="/tasks"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.recent_evaluations.slice(0, 6).map((e) => (
              <div key={e.id} className="surface-inset p-3">
                <p className="font-mono text-[10px] text-ink-tertiary">{shortDate(e.timestamp)}</p>
                <p className="mt-1 text-sm text-ink">Task {e.task_id}</p>
                <p className="mt-1 text-xs text-ink-secondary">Agent {e.agent_id}</p>
                <p className="mt-1.5 font-mono text-xs">
                  Quality <span className="text-signal">{e.score_quality}</span> · Reliability <span className="text-signal">{e.score_reliability}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AlertsFeed({ summary }: { summary: DashboardSummary }) {
  const items = [
    ...summary.alerts.blocked_tasks.map((t) => ({ kind: "blocked" as const, id: t.id, title: t.title })),
    ...summary.alerts.low_scores.map((s) => ({ kind: "low_score" as const, id: s.evaluation_id, title: `Agent ${s.agent_id} avg ${s.avg.toFixed(1)}` })),
  ];
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-signal/20 bg-signal-dim p-4 text-sm text-signal">
        <ShieldCheck className="h-5 w-5" />
        <p className="font-medium">System performance is within optimal range.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div key={`${item.kind}:${item.id}`} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${item.kind === "blocked" ? "border-danger/20 bg-danger-dim text-danger" : "border-warn/20 bg-warn-dim text-warn"}`}>
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{item.title}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, hint, ctaLabel, ctaHref }: { title: string; hint: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="font-display text-base font-bold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-secondary">{hint}</p>
      <Button asChild variant="outline" size="sm" className="mt-2"><Link href={ctaHref}>{ctaLabel}</Link></Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `metric-card.tsx` to take `tone` prop using new palette**

Open `apps/web/src/components/metric-card.tsx`. Replace its tone palette so `signal | warn | danger | accent | info | neutral` map to the dark-ops Badge tones. Implementation:

```tsx
import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Tone = "signal" | "warn" | "danger" | "accent" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  signal: "text-signal",
  warn: "text-warn",
  danger: "text-danger",
  accent: "text-accent",
  info: "text-info",
  neutral: "text-ink",
};

export function MetricCard({ label, value, tone = "neutral", className }: { label: string; value: number | string; tone?: Tone; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-bold", TONE[tone])}>{value}</p>
    </Card>
  );
}
```

- [ ] **Step 3: Build, typecheck, lint, smoke, commit**

```powershell
pnpm --filter @sentientops/web build && pnpm typecheck && pnpm --filter @sentientops/web lint
```

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/metric-card.tsx
git commit -m "feat(web): polish dashboard on primitives + merged alerts feed"
```

### Task 3.2: Projects table + drawer

**Files:** `apps/web/src/app/projects/page.tsx`

- [ ] **Step 1: Replace card grid with sortable table** that calls `listProjects`. Each row click opens a `Sheet` showing manager slot, agent count, recent activity (call `getProjectStaffing`).
- [ ] **Step 2: Add `+ New project` button top-right opening a `Dialog` with the project create form (calls existing create endpoint via `api-client`).**

The reference shape mirrors Dashboard's Card+Header pattern. Uses primitives `Card`, `Button`, `Input`, `Sheet`, `Dialog`, `Skeleton`, `Badge`. No new endpoints; `api-client.ts` already exposes `listProjects` and `getProjectStaffing`.

If `apps/web/src/lib/api-client.ts` does not yet have `createProject`, add it:

```ts
export async function createProject(
  actor: ActorContext,
  payload: { name: string; description?: string; objective?: string; owner: string; status?: string; tags?: string[] }
): Promise<ProjectContract> {
  return requestJson<ProjectContract>("/projects", {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Build, smoke, commit.**

```bash
git add apps/web/src/app/projects/page.tsx apps/web/src/lib/api-client.ts
git commit -m "feat(web): /projects table + drawer + create dialog"
```

### Task 3.3: Agents dense table

**Files:** `apps/web/src/app/agents/page.tsx`

- [ ] **Step 1: Replace card grid with a dense table.** Columns: name · type · role · status · projects · last active. Filter chips above (type / status / role) using `Button` variant `outline` with `aria-pressed`.
- [ ] **Step 2: Add row click → opens an agent profile `Sheet`** showing capabilities, recent activity, and the V1-allowed status transitions via existing `updateAgentStatus`.
- [ ] **Step 3: Build, smoke, commit.**

```bash
git add apps/web/src/app/agents/page.tsx
git commit -m "feat(web): /agents dense table + profile sheet"
```

### Task 3.4: Evaluations cards + radar

**Files:** `apps/web/src/app/evaluations/page.tsx`, possibly create `apps/web/src/components/score-radar.tsx`.

- [ ] **Step 1: Create `score-radar.tsx` — a small SVG radar chart** taking 7 numeric scores and rendering a polygon. Self-contained, no new deps. Reference implementation:

```tsx
import * as React from "react";

type Score = { label: string; value: number };

export function ScoreRadar({ scores, max = 10, size = 140 }: { scores: Score[]; max?: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const n = scores.length;
  const points = scores.map((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = Math.max(0, Math.min(max, s.value)) / max;
    return [cx + Math.cos(angle) * r * v, cy + Math.sin(angle) * r * v];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <circle key={i} cx={cx} cy={cy} r={r * t} fill="none" stroke="var(--edge)" strokeOpacity={0.4} />
      ))}
      {scores.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="var(--edge)" strokeOpacity={0.4} />;
      })}
      <path d={path} fill="var(--signal-dim)" stroke="var(--signal)" strokeWidth={1.5} />
    </svg>
  );
}
```

- [ ] **Step 2: Replace the bar lists in evaluation cards** with `ScoreRadar` rendering the 7 axes (`completion`, `quality`, `reliability`, `handover`, `context`, `clarity`, `improvement`). Keep the numeric average as a large value next to the radar.
- [ ] **Step 3: Add a top filter strip** with agent select, time range select, and minimum-score input. Filters drive `listEvaluations` query args and the polling key.
- [ ] **Step 4: Build, smoke, commit.**

```bash
git add apps/web/src/components/score-radar.tsx apps/web/src/app/evaluations/page.tsx
git commit -m "feat(web): /evaluations dark cards with score radar + filters"
```

### Task 3.5: Tool console polish

**Files:** `apps/web/src/app/tools/page.tsx`

- [ ] **Step 1: Wrap the tool selector + request panel + response panel in `Card`s.**
- [ ] **Step 2: Replace plain `<pre>` JSON output** with a styled mono panel that uses `surface-inset` background, has a copy-to-clipboard button (using `lucide-react` `Clipboard` icon), and pretty-prints with `JSON.stringify(value, null, 2)`. No syntax-highlight dependency.
- [ ] **Step 3: Add an idempotency-key field** that auto-fills with `crypto.randomUUID()` on mount and on each successful submission. Render with `Input` + a refresh button beside it.
- [ ] **Step 4: Build, smoke, commit.**

```bash
git add apps/web/src/app/tools/page.tsx
git commit -m "feat(web): /tools polished panels + idempotency-key auto-fill"
```

### Task 3.6: PR 3 verification gate

- [ ] Build, typecheck, lint, dev smoke each polished route.
- [ ] Run UAT UX scenario:

```powershell
pnpm qa:uat:ux
```

Inspect the report under `reports/uat/`. No regression on dashboard / projects / agents / evaluations / tools surfaces.

---

## PR 4 — `/operations` deep rebuild

**Goal:** Implement the three-column workspace from spec §6 — project rail (240px), staffing/agents work area, right rail with tabs.

**Branch:** `feat/dark-ops-operations`

### Task 4.1: Decompose existing operations page

**Files:**
- Create: `apps/web/src/app/operations/components/project-rail.tsx`
- Create: `apps/web/src/app/operations/components/manager-slot-panel.tsx`
- Create: `apps/web/src/app/operations/components/agents-grid.tsx`
- Create: `apps/web/src/app/operations/components/kpi-strip.tsx`
- Create: `apps/web/src/app/operations/components/right-rail.tsx`
- Create: `apps/web/src/app/operations/components/handovers-tab.tsx`
- Create: `apps/web/src/app/operations/components/health-tab.tsx`
- Modify: `apps/web/src/app/operations/page.tsx` to compose them in the three-column shell

- [ ] **Step 1: `project-rail.tsx`** — list (`ScrollArea`) of projects fetched via `listProjects`. Each row: name, manager initial avatar, WIP count (use `getProjectStaffing.kpi.tasks_in_progress` if available, otherwise omit), pulse dot when SSE has had activity in the last 60s. `+ New project` `Button` pinned at the bottom opening the same `Dialog` from PR 3 Task 3.2. Search at the top using `Input`. Pulse-dot logic uses a small in-memory map of `projectId → lastEventAt` updated by the parent page's SSE subscription.

- [ ] **Step 2: `manager-slot-panel.tsx`** — renders either `Vacant` (one big CTA `Assign manager` opening a `Dialog` listing eligible agents and calling `assignProjectManager`) or `Filled` (avatar + name + role badge + time-in-role + `Reassign` button opening a confirm `Dialog` because of the V1 one-manager rule). Eligible-agents list comes from `listAgents({ projectId })` filtered to `role: manager`-capable.

- [ ] **Step 3: `agents-grid.tsx`** — `Card` grid of attached agents (3 across at typical width). Each card: `Avatar` initial, name, type `Badge`, status `StatusPill`, last-active relative time, `DropdownMenu` (Detach / View profile / Change role). `+ Attach agent` `Button` opens a `Dialog` with search and result list (calls `attachAgentToProject`). `+ Create new` opens a `Sheet` with the registration form (calls `createProjectAgent`).

- [ ] **Step 4: `kpi-strip.tsx`** — single row, four stats: open tasks · blocked · evals pending · last handover age. Values pulled from `getProjectStaffing.kpi` already returned by the API. 14px values, 11px labels.

- [ ] **Step 5: `right-rail.tsx`** — `Tabs` with four panels: Activity (existing activity feed inside `ScrollArea`), Quick log (reuses the existing `worklog-composer.tsx`), Handovers (`handovers-tab.tsx`), Health (`health-tab.tsx`). Sticky on `lg+` breakpoint with `position: sticky; top: 24px;`.

- [ ] **Step 6: `handovers-tab.tsx`** — `listHandovers({ projectId })` (add to api-client if missing — the API exposes `/api/v1/handovers?project_id=…`). For each handover: kind, from-agent → to-agent, summary, timestamp. `+ Create handover` `Button` opens a `Dialog` with form fields driven by existing `POST /api/v1/handovers`.

- [ ] **Step 7: `health-tab.tsx`** — four readouts:
  - SSE connection status (use `useResilientEventStream` exposed `status`)
  - Last poll age (delta of `Date.now()` and the relevant query's `lastUpdatedAt`)
  - Idempotency-key cache size (call a new `GET /api/v1/health/idempotency` — see §11 carve-out; if not added, drop this readout silently)
  - Outbox depth (call `GET /api/v1/health/outbox` similarly; same fallback)

- [ ] **Step 8: Compose `operations/page.tsx`** as the three-column grid:

```tsx
"use client";

// imports …

export default function OperationsPage() {
  // state: selectedProjectId from URL ?project=…, agent SSE pulse, etc.
  // existing data hooks: useActor, getProjectStaffing, useResilientEventStream
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      <ProjectRail … />
      <div className="space-y-5">
        <ManagerSlotPanel … />
        <AgentsGrid … />
        <KpiStrip … />
      </div>
      <RightRail … />
    </div>
  );
}
```

Below 1280px the right rail collapses to a `Sheet` triggered by a button in the top of the work area; below 1024px the project rail collapses to a top `Select`. Both fallbacks already exist in the primitive layer.

- [ ] **Step 9: Build, typecheck, lint, smoke, commit per sub-step.**

```bash
git add apps/web/src/app/operations
git commit -m "feat(web): /operations three-column workspace + manager slot + right rail"
```

### Task 4.2: PR 4 verification gate

- [ ] Build / typecheck / lint green.
- [ ] Manual smoke checklist:
  - Switch projects via rail, URL updates, work area refreshes.
  - Assign / reassign manager — confirm dialog appears, action succeeds.
  - Attach an agent via dialog; detach via dropdown.
  - Create a worklog via Quick log tab.
  - Create a handover via Handovers tab.
  - SSE pulse dot lights up on the active project after a worklog mutation.
- [ ] `pnpm qa:uat` and `pnpm qa:uat:agent` pass without regression.

---

## PR 5 — `/tasks` deep rebuild

**Goal:** Implement spec §7. Board + side inspector. Stage groups. dnd-kit drag-and-drop with workflow validation. Bulk select + bulk transition. List and Timeline views. Inspector deep-link via `?task=…`.

**Branch:** `feat/dark-ops-tasks`

### Task 5.1: Carve out the page

**Files:**
- Create: `apps/web/src/app/tasks/components/control-bar.tsx` (project switcher, view tabs, blocked banner, filters, `+ New task`)
- Create: `apps/web/src/app/tasks/components/board-view.tsx`
- Create: `apps/web/src/app/tasks/components/list-view.tsx`
- Create: `apps/web/src/app/tasks/components/timeline-view.tsx`
- Create: `apps/web/src/app/tasks/components/task-card.tsx`
- Create: `apps/web/src/app/tasks/components/task-inspector.tsx`
- Create: `apps/web/src/app/tasks/components/bulk-action-bar.tsx`
- Create: `apps/web/src/app/tasks/components/stage-group.tsx`
- Modify: `apps/web/src/app/tasks/page.tsx` to compose them and own URL state

### Task 5.2: Stage groups + lanes

- [ ] **Step 1: Define the static stage map.**

```ts
// apps/web/src/app/tasks/components/stages.ts
import type { TaskStatus } from "@sentientops/contracts";

export const STAGE_GROUPS = [
  { id: "intake", label: "Intake", lanes: ["intake", "ready"] as TaskStatus[] },
  { id: "active", label: "Active", lanes: ["assigned", "in_progress"] as TaskStatus[] },
  { id: "handoff", label: "Handoff", lanes: ["awaiting_handover", "under_review", "evaluation"] as TaskStatus[] },
  { id: "done", label: "Done", lanes: ["completed"] as TaskStatus[] },
];
```

`blocked` and `reopened` are intentionally absent — they surface as a banner and a filter chip.

- [ ] **Step 2: `stage-group.tsx`** renders a stage caption and its lanes as `surface-inset` columns side by side. Lane header: status name, count badge, WIP pressure dot if count exceeds the project's WIP limit (config in `getProjectStaffing.workflow_limits` or a default 5).

### Task 5.3: dnd-kit drag-and-drop with transition validation

- [ ] **Step 1: Compute allowed transitions client-side** from the existing `getDefaultProcessTemplate()` response which already returns `transition_matrix: Record<TaskStatus, TaskStatus[]>`. The current `tasks/page.tsx` already uses this; reuse the same hook.

- [ ] **Step 2: Wrap the board in `DndContext` from `@dnd-kit/core`.** Each lane is a `SortableContext`; each card is a `useSortable` item. On drag-start, dim lanes whose status is not in the source task's allowed-next list and refuse drop.

```tsx
import { DndContext, DragOverlay, useSensors, useSensor, PointerSensor, KeyboardSensor, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// inside BoardView:
const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
const onDragStart = (e: DragStartEvent) => setActiveTaskId(String(e.active.id));
const onDragEnd = async (e: DragEndEvent) => {
  setActiveTaskId(null);
  const taskId = String(e.active.id);
  const targetStatus = e.over?.data.current?.status as TaskStatus | undefined;
  if (!targetStatus) return;
  const task = boardQuery.data?.cards.find((c) => c.id === taskId);
  if (!task) return;
  if (!transitionMatrix[task.status].includes(targetStatus)) return;
  await transitionTask({ actorId: actor.actorId }, taskId, { target_status: targetStatus });
  void boardQuery.refresh();
};
```

- [ ] **Step 3: When `activeTaskId` is set, dim disallowed lanes** with `aria-disabled="true"` and `data-disabled="true"`, render a tooltip on hover explaining the missing transition (e.g., "Needs handover before review" — wording derived from the current vs target status).

- [ ] **Step 4: Add keyboard shortcuts** — `j`/`k` for prev/next card within selection, `Enter` to open inspector, `Esc` to close.

### Task 5.4: Inspector + deep link

- [ ] **Step 1: `task-inspector.tsx`** is a `Sheet` triggered by `openTaskId !== null`. Header: title, status pill, priority. `Tabs`: Overview (transition builder + dependency list), Activity (worklog + handovers timeline), Evaluation (scores + request flow), Memory (promotion suggestions and context).

- [ ] **Step 2: Deep link** — on mount, read `?task=…` from `useSearchParams()`. When a task is opened, call `router.replace(`/tasks?project=${pid}&task=${tid}`)`. When closed, strip `task` from URL with the same replace.

- [ ] **Step 3: Quick-log composer in Activity tab** — the existing `worklog-composer.tsx` rendered with a `presetActionType="progress"` prop. If the prop doesn't exist on `worklog-composer`, add it with a default of `undefined` and have the form pre-select that value when present.

### Task 5.5: Bulk select + bulk transition

- [ ] **Step 1: Multi-select state** in board view: `selectedIds: Set<string>`. Shift-click extends; plain click clears.

- [ ] **Step 2: `bulk-action-bar.tsx`** appears at the bottom when `selectedIds.size > 0`. Shows a count and a `DropdownMenu` of valid bulk transitions — the intersection of allowed-next sets for all selected tasks.

- [ ] **Step 3: Submit** issues `transitionTask` calls in parallel; on completion, refresh the board query and clear selection.

### Task 5.6: List and Timeline views

- [ ] **Step 1: `list-view.tsx`** — sortable, filterable table of all tasks for the current project. Columns: title · status · priority · assignee · age · dependencies. Sort and filter state in URL (`?view=list&sort=age:desc&status=blocked`).

- [ ] **Step 2: `timeline-view.tsx`** — a horizontal Gantt-ish strip. For each task, draw a row with a bar from `created_at` to `completed_at` (or `now` if open). Use existing `getTaskTimeline` / list-tasks data. Lightweight SVG; no chart library.

- [ ] **Step 3: View tabs in `control-bar.tsx`** — `Board` / `List` / `Timeline` using the `Tabs` primitive; selected tab persisted in URL `?view=`.

### Task 5.7: Blocked banner and reopened filter

- [ ] **Step 1: When `boardQuery.data.blocked_count > 0`** render a banner above the board: "{n} tasks blocked · review →" linking to `?view=list&status=blocked`.

- [ ] **Step 2: Filter chips in control bar** include a `Reopened` chip that toggles a status filter.

### Task 5.8: Empty state

- [ ] When the board has zero cards across all lanes for the selected project, render a single centered prompt with a `+ New task` `Button`.

### Task 5.9: PR 5 verification gate

- [ ] Build / typecheck / lint green.
- [ ] Manual smoke:
  - Drag a card across allowed lane: succeeds, toast confirms transition.
  - Drag across disallowed lane: lane dims, drop refused, tooltip explains.
  - Bulk select + bulk transition: parallel transitions, board refreshes.
  - Inspector deep-link `/tasks?project=…&task=…` opens directly.
  - List view sort/filter persists in URL.
  - Timeline view renders bars proportional to task age.
- [ ] `pnpm qa:uat` and `pnpm qa:uat:agent` pass without regression.

```bash
git add apps/web/src/app/tasks
git commit -m "feat(web): /tasks board + inspector + dnd validation + list/timeline"
```

---

## Final acceptance gate

After PR 5 merges, run end-to-end:

```powershell
pnpm install
pnpm --filter @sentientops/web build
pnpm typecheck
pnpm --filter @sentientops/web lint
pnpm dev:web
pnpm qa:uat
```

All must be green and the UAT report should not flag regressions in any of the six routes. The acceptance criteria from spec §13 must hold:

1. `pnpm build` exits 0 with no errors. ESLint warnings cleared.
2. Every route renders in Dark Ops with no light-theme remnants.
3. `/operations` and `/tasks` match the IA in §6 and §7 of the spec.
4. The four theme-only routes match the polish pass in §5.
5. UAT passes after PR 3, PR 4, and PR 5.
6. No backend test regression.
