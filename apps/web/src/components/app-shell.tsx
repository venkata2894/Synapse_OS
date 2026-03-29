"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: React.ReactNode;
  headerActions: React.ReactNode;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agents", label: "Agents" },
  { href: "/evaluations", label: "Evaluations" },
  { href: "/tools", label: "Tool Console" }
];

export function AppShell({ children, headerActions }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-5 lg:grid-cols-[250px_1fr] lg:px-8">
        <aside className="panel fade-up h-fit p-4 lg:sticky lg:top-5">
          <div className="border-b border-slate-500/30 pb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Synapse OS</p>
            <h1 className="mt-2 text-2xl font-semibold title-gradient">Agent Control Room</h1>
            <p className="mt-2 text-xs text-slate-300/85">Project orchestration for AI agents</p>
          </div>
          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/40"
                      : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-400">{isActive ? "live" : ""}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-5">
          <header className="panel fade-up flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Operational View</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-100">SentientOps V1 Frontend</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-teal-300/40 bg-teal-500/15 px-3 py-1 text-xs text-teal-200">
                Polling: 10s
              </span>
              <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-xs text-amber-100">
                Agent-first mode
              </span>
              {headerActions}
            </div>
          </header>

          <div className="fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}

