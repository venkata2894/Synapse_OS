"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { TaskContract, TaskStatus } from "@sentientops/contracts";

import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";

const PRIORITY_TONE: Record<
  TaskContract["priority"],
  "neutral" | "info" | "warn" | "danger"
> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

export type ListSortKey = "title" | "status" | "priority" | "assignee" | "age";
export type ListSortDir = "asc" | "desc";

export interface ListViewProps {
  tasks: TaskContract[];
  query: string;
  statusFilter: TaskStatus | null;
  reopenedFilterActive: boolean;
  sortKey: ListSortKey;
  sortDir: ListSortDir;
  onChangeSort: (key: ListSortKey) => void;
  onOpenTask: (taskId: string) => void;
}

function ageMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).valueOf();
  if (Number.isNaN(t)) return 0;
  return Date.now() - t;
}

function relativeAge(iso: string | null | undefined): string {
  const ms = ageMs(iso);
  if (ms <= 0) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const PRIORITY_RANK: Record<TaskContract["priority"], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Sortable, filterable table view of project tasks. */
export function ListView({
  tasks,
  query,
  statusFilter,
  reopenedFilterActive,
  sortKey,
  sortDir,
  onChangeSort,
  onOpenTask,
}: ListViewProps): React.ReactElement {
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (reopenedFilterActive && task.status !== "reopened") return false;
      if (!q) return true;
      const haystack = `${task.title} ${task.assigned_to ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, statusFilter, reopenedFilterActive, tasks]);

  const sorted = React.useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "priority":
          cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          break;
        case "assignee":
          cmp = (a.assigned_to ?? "~").localeCompare(b.assigned_to ?? "~");
          break;
        case "age":
          cmp = ageMs(a.created_at) - ageMs(b.created_at);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortDir, sortKey]);

  const SortHeader = ({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: ListSortKey;
    align?: "left" | "right";
  }) => (
    <th
      scope="col"
      className={cn(
        "select-none px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={() => onChangeSort(keyName)}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {label}
        {sortKey === keyName ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="surface overflow-hidden p-0">
      <div className="soft-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="border-b border-edge bg-canvas-inset/40">
            <tr>
              <SortHeader label="Title" keyName="title" />
              <SortHeader label="Status" keyName="status" />
              <SortHeader label="Priority" keyName="priority" />
              <SortHeader label="Assignee" keyName="assignee" />
              <SortHeader label="Age" keyName="age" />
              <th
                scope="col"
                className="px-3 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary"
              >
                Deps
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink-ghost">
                  No tasks match your filters.
                </td>
              </tr>
            ) : (
              sorted.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  className="cursor-pointer border-b border-edge/50 transition-colors hover:bg-canvas-inset/40"
                >
                  <td className="px-3 py-2 align-top">
                    <p className="line-clamp-1 text-ink">{task.title}</p>
                    <p className="font-mono text-[10px] text-ink-ghost">
                      {task.id}
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusPill status={task.status} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge tone={PRIORITY_TONE[task.priority]}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-ink-secondary">
                    {task.assigned_to ?? "unassigned"}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-ink-ghost">
                    {relativeAge(task.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-mono text-[11px] text-ink-ghost">
                    {task.dependencies.length}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
