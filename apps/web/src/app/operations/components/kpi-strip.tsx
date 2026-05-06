"use client";

import * as React from "react";
import type { ProjectStaffingSummary, WorklogEntry } from "@sentientops/contracts";

type KpiStripProps = {
  staffing: ProjectStaffingSummary | null;
  evalsPending: number | null;
  lastHandover: WorklogEntry | null;
};

function relativeFromNow(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function KpiStrip({ staffing, evalsPending, lastHandover }: KpiStripProps) {
  const counters = staffing?.counters;
  const openTasks = counters?.tasks_in_progress ?? null;
  const blocked = counters?.blocked_tasks ?? null;

  return (
    <div className="surface grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
      <Kpi label="Open tasks" value={openTasks} />
      <Kpi label="Blocked" value={blocked} tone={blocked && blocked > 0 ? "danger" : "neutral"} />
      <Kpi label="Evals pending" value={evalsPending} />
      <Kpi
        label="Last handover"
        text={lastHandover ? relativeFromNow(lastHandover.timestamp) : "—"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value?: number | null;
  text?: string;
  tone?: "neutral" | "danger";
}) {
  const display = text ?? (value === null || value === undefined ? "—" : String(value));
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-edge bg-canvas-inset px-3 py-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        {label}
      </span>
      <span
        className={[
          "text-[14px] font-bold tabular-nums",
          tone === "danger" ? "text-danger" : "text-ink",
        ].join(" ")}
      >
        {display}
      </span>
    </div>
  );
}
