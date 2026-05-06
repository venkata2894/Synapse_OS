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
  const pathname = usePathname() ?? "/";

  const renderItem = (item: NavItem) => {
    const isActive =
      item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href as never}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-signal-dim text-signal font-semibold ring-1 ring-signal/30"
            : "text-ink-secondary hover:bg-canvas-raised hover:text-ink"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            isActive ? "text-signal" : "text-ink-tertiary group-hover:text-ink-secondary"
          )}
        />
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
