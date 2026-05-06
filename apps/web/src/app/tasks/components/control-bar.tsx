"use client";

import * as React from "react";
import { AlertTriangle, Filter, KanbanSquare, List, Plus, Timer } from "lucide-react";
import type { ProjectContract } from "@sentientops/contracts";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";

export type TasksView = "board" | "list" | "timeline";

export interface ControlBarProps {
  projects: ProjectContract[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;

  view: TasksView;
  onChangeView: (view: TasksView) => void;

  blockedCount: number;
  reopenedCount: number;
  reopenedFilterActive: boolean;
  onToggleReopenedFilter: () => void;
  onShowBlocked: () => void;

  query: string;
  onQueryChange: (value: string) => void;

  streamLabel: string;
  streamTone: "ok" | "warn" | "danger" | "neutral";

  onCreateTask?: () => void;
}

/**
 * Top control bar: project picker, view tabs, blocked banner, filters,
 * and the new-task action.
 */
export function ControlBar({
  projects,
  selectedProjectId,
  onSelectProject,
  view,
  onChangeView,
  blockedCount,
  reopenedCount,
  reopenedFilterActive,
  onToggleReopenedFilter,
  onShowBlocked,
  query,
  onQueryChange,
  streamLabel,
  streamTone,
  onCreateTask,
}: ControlBarProps): React.ReactElement {
  return (
    <section className="surface flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-dim text-signal">
            <KanbanSquare className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
              Execution Board
            </p>
            <h2 className="font-display text-lg font-bold text-ink">Tasks</h2>
          </div>

          <div className="ml-3 min-w-[200px]">
            <Select
              value={selectedProjectId || undefined}
              onValueChange={onSelectProject}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(value) => onChangeView(value as TasksView)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="board">
                <KanbanSquare className="mr-1.5 h-3.5 w-3.5" /> Board
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="mr-1.5 h-3.5 w-3.5" /> List
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Timer className="mr-1.5 h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => onCreateTask?.()}
            disabled={!onCreateTask}
          >
            <Plus className="h-3.5 w-3.5" /> New task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-edge bg-canvas-inset px-3 py-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-ghost" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter title or assignee"
            className="w-48 bg-transparent text-xs text-ink outline-none placeholder:text-ink-ghost"
          />
        </div>

        <button
          type="button"
          onClick={onToggleReopenedFilter}
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition",
            reopenedFilterActive
              ? "border-orange-400/40 bg-orange-400/10 text-orange-300"
              : "border-edge bg-canvas-inset text-ink-secondary hover:border-edge-bright"
          )}
        >
          Reopened {reopenedCount ? `· ${reopenedCount}` : ""}
        </button>

        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]",
            streamTone === "ok"
              ? "border-ok/30 bg-ok-dim text-ok"
              : streamTone === "warn"
              ? "border-warn/30 bg-warn-dim text-warn"
              : streamTone === "danger"
              ? "border-danger/30 bg-danger-dim text-danger"
              : "border-edge bg-canvas-inset text-ink-tertiary"
          )}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          Stream: {streamLabel}
        </span>
      </div>

      {blockedCount > 0 ? (
        <button
          type="button"
          onClick={onShowBlocked}
          className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger-dim px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">
            {blockedCount} task{blockedCount === 1 ? "" : "s"} blocked
          </span>
          <span className="font-mono text-[11px] underline-offset-2 hover:underline">
            review →
          </span>
        </button>
      ) : null}
    </section>
  );
}
