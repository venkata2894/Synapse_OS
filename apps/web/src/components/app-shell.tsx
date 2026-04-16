"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: React.ReactNode;
  headerActions: React.ReactNode;
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/operations", label: "Operations", icon: "sliders" },
  { href: "/tasks", label: "Tasks", icon: "kanban" },
  { href: "/agents", label: "Agents", icon: "cpu" },
  { href: "/evaluations", label: "Evaluations", icon: "chart" },
  { href: "/tools", label: "Tool Console", icon: "terminal" }
];

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const base = `w-4 h-4 ${className ?? ""}`;
  const style = { color: 'currentColor' };
  switch (icon) {
    case "grid":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
        </svg>
      );
    case "folder":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 4.5V12.5C1.5 13.05 1.95 13.5 2.5 13.5H13.5C14.05 13.5 14.5 13.05 14.5 12.5V5.5C14.5 4.95 14.05 4.5 13.5 4.5H8L6.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5V4.5Z" />
        </svg>
      );
    case "sliders":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="4" y1="2" x2="4" y2="14" />
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="12" y1="2" x2="12" y2="14" />
          <circle cx="4" cy="5" r="1.5" fill="currentColor" />
          <circle cx="8" cy="10" r="1.5" fill="currentColor" />
          <circle cx="12" cy="7" r="1.5" fill="currentColor" />
        </svg>
      );
    case "kanban":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="3.5" height="13" rx="1" />
          <rect x="6.25" y="1.5" width="3.5" height="9" rx="1" />
          <rect x="11" y="1.5" width="3.5" height="11" rx="1" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
          <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" />
          <line x1="6" y1="1" x2="6" y2="3.5" />
          <line x1="10" y1="1" x2="10" y2="3.5" />
          <line x1="6" y1="12.5" x2="6" y2="15" />
          <line x1="10" y1="12.5" x2="10" y2="15" />
          <line x1="1" y1="6" x2="3.5" y2="6" />
          <line x1="1" y1="10" x2="3.5" y2="10" />
          <line x1="12.5" y1="6" x2="15" y2="6" />
          <line x1="12.5" y1="10" x2="15" y2="10" />
        </svg>
      );
    case "chart":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="1.5,12 5,6 8.5,9 14.5,3" />
          <line x1="1.5" y1="14.5" x2="14.5" y2="14.5" />
        </svg>
      );
    case "terminal":
      return (
        <svg className={base} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <polyline points="4.5,6 7,8.5 4.5,11" />
          <line x1="9" y1="11" x2="12" y2="11" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppShell({ children, headerActions }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas-deep">
      <div className="mx-auto grid w-full max-w-[1680px] gap-4 px-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6">
        {/* Sidebar */}
        <aside className="surface animate-fade-up h-fit border-slate-200/60 p-5 lg:sticky lg:top-6">
          <div className="mb-6 border-b border-edge pb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-white">
                <svg className="h-5 w-5" style={{ display: 'block' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                  <path d="M2 17L12 22L22 17" />
                  <path d="M2 12L12 17L22 12" />
                </svg>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-tertiary">Synapse OS</p>
                <h1 className="font-display text-lg font-bold text-ink">
                  Control Room
                </h1>
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                    isActive
                      ? "bg-signal-dim text-signal font-semibold shadow-sm ring-1 ring-signal/20"
                      : "text-ink-secondary hover:bg-slate-50 hover:text-ink"
                  ].join(" ")}
                >
                  <NavIcon icon={item.icon} className={isActive ? "text-signal" : "text-ink-tertiary group-hover:text-ink-secondary"} />
                  <span>{item.label}</span>
                  {isActive && <span className="live-dot ml-auto shadow-[0_0_8px_rgba(0,181,142,0.4)]" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/60">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">System Status</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_6px_rgba(0,181,142,0.3)]" />
              <span className="text-xs font-medium text-ink-secondary">All Nodes Active</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-5">
          <header className="surface animate-fade-up flex flex-col gap-4 border-slate-200/60 p-5 md:flex-row md:items-center md:justify-between" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-4">
              <div className="hidden h-10 w-[1px] bg-edge md:block" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Operational View</p>
                <h2 className="mt-0.5 font-display text-xl font-bold text-ink">SentientOps V1</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="flex items-center gap-2 rounded-full border border-signal/20 bg-signal-dim px-3 py-1.5 font-mono text-[10px] font-medium text-signal">
                <span className="live-dot" />
                Live Polling
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[10px] font-medium text-ink-secondary">
                Region: us-east-1
              </span>
              {headerActions}
            </div>
          </header>

          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
