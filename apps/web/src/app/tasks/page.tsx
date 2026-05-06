"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  BoardCard,
  BoardSnapshot,
  TaskStatus,
} from "@sentientops/contracts";
import { TASK_STATUSES } from "@sentientops/contracts";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { useResilientEventStream } from "@/hooks/use-resilient-event-stream";
import {
  appendWorklog,
  getBoard,
  getDefaultProcessTemplate,
  getTaskTimeline,
  listAgents,
  listProjects,
  listTasks,
  openProjectEventStream,
  transitionTask,
} from "@/lib/api-client";

import { BoardView } from "./components/board-view";
import { BulkActionBar } from "./components/bulk-action-bar";
import { ControlBar, type TasksView } from "./components/control-bar";
import { ListView, type ListSortDir, type ListSortKey } from "./components/list-view";
import { FALLBACK_TRANSITION_MATRIX } from "./components/stages";
import { TaskInspector } from "./components/task-inspector";
import { TimelineView } from "./components/timeline-view";

const EMPTY_BOARD: BoardSnapshot = {
  project_id: "",
  project_name: "",
  generated_at: "",
  counters: { total_tasks: 0, blocked_tasks: 0, in_progress_tasks: 0 },
  lanes: [],
};

function asTaskStatus(value: string | null | undefined): TaskStatus | null {
  if (!value) return null;
  if ((TASK_STATUSES as readonly string[]).includes(value)) {
    return value as TaskStatus;
  }
  return null;
}

function asView(value: string | null | undefined): TasksView {
  if (value === "list" || value === "timeline") return value;
  return "board";
}

export default function TasksPage(): React.ReactElement {
  const actor = useActor();
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectParam = searchParams?.get("project") ?? null;
  const viewParam = asView(searchParams?.get("view") ?? null);
  const taskParam = searchParams?.get("task") ?? null;
  const sortParam = searchParams?.get("sort") ?? null;
  const statusParam = searchParams?.get("status") ?? null;

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    projectParam ?? ""
  );
  const [view, setView] = React.useState<TasksView>(viewParam);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(taskParam);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);
  const [refreshSignal, setRefreshSignal] = React.useState(0);
  const [filterQuery, setFilterQuery] = React.useState("");
  const [reopenedFilterActive, setReopenedFilterActive] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | null>(
    asTaskStatus(statusParam)
  );

  const initialSortKey = (sortParam?.split(":")[0] as ListSortKey) ?? "age";
  const initialSortDir = (sortParam?.split(":")[1] as ListSortDir) ?? "desc";
  const [sortKey, setSortKey] = React.useState<ListSortKey>(
    ["title", "status", "priority", "assignee", "age"].includes(initialSortKey)
      ? initialSortKey
      : "age"
  );
  const [sortDir, setSortDir] = React.useState<ListSortDir>(
    initialSortDir === "asc" ? "asc" : "desc"
  );

  // ---------------------------------------------------------------- queries
  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `projects:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 30_000 }
  );

  React.useEffect(() => {
    if (selectedProjectId) return;
    const first = projectsQuery.data?.items[0]?.id;
    if (first) setSelectedProjectId(first);
  }, [projectsQuery.data?.items, selectedProjectId]);

  const processTemplateQuery = usePollingQuery(
    () => getDefaultProcessTemplate({ actorId: actor.actorId }),
    `process-template:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 120_000 }
  );

  const enabled = actor.ready && Boolean(selectedProjectId);

  const stream = useResilientEventStream({
    enabled,
    connect: () =>
      openProjectEventStream(selectedProjectId, actor.actorId || "owner-dev"),
    onEvent: (event) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "heartbeat") return;
      } catch {
        // ignore non-JSON
      }
      setRefreshSignal((value) => value + 1);
    },
  });

  const boardQuery = usePollingQuery(
    () =>
      selectedProjectId
        ? getBoard({ actorId: actor.actorId }, selectedProjectId)
        : Promise.resolve(EMPTY_BOARD),
    `board:${actor.actorId}:${selectedProjectId || "_"}`,
    {
      enabled,
      initialData: EMPTY_BOARD,
      intervalMs: stream.status === "connected" ? 60_000 : 10_000,
    }
  );

  const tasksQuery = usePollingQuery(
    () =>
      listTasks(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: selectedProjectId, limit: 500 }
      ),
    `tasks:${actor.actorId}:${selectedProjectId || "_"}`,
    {
      enabled,
      intervalMs: stream.status === "connected" ? 60_000 : 10_000,
    }
  );

  const projectAgentsQuery = usePollingQuery(
    () =>
      listAgents(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: selectedProjectId, limit: 200 }
      ),
    `agents-all:${actor.actorId}:${selectedProjectId || "_"}`,
    { enabled, intervalMs: 60_000 }
  );

  const timelineQuery = usePollingQuery(
    () =>
      openTaskId
        ? getTaskTimeline({ actorId: actor.actorId }, openTaskId)
        : Promise.resolve(null as never),
    `timeline:${actor.actorId}:${openTaskId ?? "_"}`,
    {
      enabled: actor.ready && Boolean(openTaskId),
      intervalMs: stream.status === "connected" ? 45_000 : 10_000,
    }
  );

  // ---------------------------------------------------------------- SSE fan-out
  React.useEffect(() => {
    if (!refreshSignal || !selectedProjectId) return;
    void boardQuery.refresh();
    void tasksQuery.refresh();
    if (openTaskId) void timelineQuery.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // ---------------------------------------------------------------- URL sync
  const writeUrl = React.useCallback(
    (
      patch: Partial<{
        project: string | null;
        view: TasksView;
        task: string | null;
        sort: string | null;
        status: string | null;
      }>
    ) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (patch.project !== undefined) {
        if (patch.project) params.set("project", patch.project);
        else params.delete("project");
      }
      if (patch.view !== undefined) {
        if (patch.view === "board") params.delete("view");
        else params.set("view", patch.view);
      }
      if (patch.task !== undefined) {
        if (patch.task) params.set("task", patch.task);
        else params.delete("task");
      }
      if (patch.sort !== undefined) {
        if (patch.sort) params.set("sort", patch.sort);
        else params.delete("sort");
      }
      if (patch.status !== undefined) {
        if (patch.status) params.set("status", patch.status);
        else params.delete("status");
      }
      const qs = params.toString();
      router.replace(qs ? `/tasks?${qs}` : "/tasks");
    },
    [router, searchParams]
  );

  React.useEffect(() => {
    if (!selectedProjectId) return;
    if (projectParam === selectedProjectId) return;
    writeUrl({ project: selectedProjectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  React.useEffect(() => {
    if (viewParam === view) return;
    writeUrl({ view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  React.useEffect(() => {
    if ((taskParam ?? null) === (openTaskId ?? null)) return;
    writeUrl({ task: openTaskId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTaskId]);

  // ---------------------------------------------------------------- derived
  const board = boardQuery.data ?? EMPTY_BOARD;
  const tasks = tasksQuery.data?.items ?? [];

  const cardsById = React.useMemo(() => {
    const map = new Map<string, BoardCard>();
    for (const lane of board.lanes) {
      for (const card of lane.cards) map.set(card.id, card);
    }
    return map;
  }, [board.lanes]);

  const transitionMatrix = React.useMemo(() => {
    const matrix = processTemplateQuery.data?.transition_matrix;
    if (!matrix || Object.keys(matrix).length === 0) {
      return FALLBACK_TRANSITION_MATRIX;
    }
    const normalized: Record<TaskStatus, TaskStatus[]> = {
      ...FALLBACK_TRANSITION_MATRIX,
    };
    for (const [from, next] of Object.entries(matrix)) {
      const f = asTaskStatus(from);
      if (!f) continue;
      normalized[f] = next
        .map((value) => asTaskStatus(value))
        .filter((value): value is TaskStatus => Boolean(value));
    }
    return normalized;
  }, [processTemplateQuery.data?.transition_matrix]);

  const isTransitionAllowed = React.useCallback(
    (from: TaskStatus, to: TaskStatus): boolean =>
      (transitionMatrix[from] ?? []).includes(to),
    [transitionMatrix]
  );

  const openCard = openTaskId ? cardsById.get(openTaskId) ?? null : null;
  const allowedTransitionsForOpen = React.useMemo(() => {
    if (!openCard) return [] as TaskStatus[];
    return transitionMatrix[openCard.status] ?? [];
  }, [openCard, transitionMatrix]);

  const validBulkTransitions = React.useMemo<TaskStatus[]>(() => {
    if (selectedIds.size === 0) return [];
    let intersection: Set<TaskStatus> | null = null;
    for (const id of selectedIds) {
      const card = cardsById.get(id);
      if (!card) continue;
      const next: Set<TaskStatus> = new Set<TaskStatus>(
        transitionMatrix[card.status] ?? []
      );
      if (intersection === null) {
        intersection = next;
      } else {
        const filtered = new Set<TaskStatus>();
        for (const value of intersection) {
          if (next.has(value)) filtered.add(value);
        }
        intersection = filtered;
      }
    }
    if (!intersection) return [];
    return Array.from(intersection).filter(
      (status): status is TaskStatus =>
        status !== "assigned" && status !== "blocked"
    );
  }, [cardsById, selectedIds, transitionMatrix]);

  // ---------------------------------------------------------------- mutations
  const runTransition = async (
    cardId: string,
    target: TaskStatus,
    options: { reason?: string; blockerReason?: string; assignedTo?: string } = {}
  ) => {
    setActionError(null);
    setIsMutating(true);
    try {
      await transitionTask({ actorId: actor.actorId }, cardId, {
        target_status: target,
        reason: options.reason,
        blocker_reason: options.blockerReason,
        assigned_to: options.assignedTo,
      });
      await Promise.all([boardQuery.refresh(), tasksQuery.refresh()]);
      if (openTaskId === cardId) {
        await timelineQuery.refresh();
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Transition failed."
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleBoardTransition = async (cardId: string, target: TaskStatus) => {
    const card = cardsById.get(cardId);
    if (!card) return;
    if (!isTransitionAllowed(card.status, target)) {
      setActionError(
        `Transition not allowed: ${card.status} → ${target}.`
      );
      return;
    }
    await runTransition(cardId, target);
  };

  const handleBulkApply = async (target: TaskStatus) => {
    setActionError(null);
    setIsMutating(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          transitionTask({ actorId: actor.actorId }, id, {
            target_status: target,
          })
        )
      );
      setSelectedIds(new Set());
      await Promise.all([boardQuery.refresh(), tasksQuery.refresh()]);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Bulk transition failed."
      );
    } finally {
      setIsMutating(false);
    }
  };

  // ---------------------------------------------------------------- card click / select
  const orderedCardIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const lane of board.lanes) {
      for (const card of lane.cards) ids.push(card.id);
    }
    return ids;
  }, [board.lanes]);

  const handleCardClick = (
    cardId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      handleToggleSelect(cardId, event);
      return;
    }
    setSelectedIds(new Set());
    setOpenTaskId(cardId);
    setLastSelectedId(cardId);
  };

  const handleToggleSelect = (
    cardId: string,
    event: React.MouseEvent | React.ChangeEvent
  ) => {
    const isShift =
      "shiftKey" in event ? Boolean((event as React.MouseEvent).shiftKey) : false;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isShift && lastSelectedId && lastSelectedId !== cardId) {
        const a = orderedCardIds.indexOf(lastSelectedId);
        const b = orderedCardIds.indexOf(cardId);
        if (a >= 0 && b >= 0) {
          const [start, end] = a < b ? [a, b] : [b, a];
          for (let i = start; i <= end; i++) next.add(orderedCardIds[i]);
          return next;
        }
      }
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
    setLastSelectedId(cardId);
  };

  const handleAppendWorklog = async (payload: {
    task_id: string;
    agent_id: string;
    action_type: string;
    summary: string;
    detailed_log: string;
    artifacts: string[];
    confidence: number;
  }) => {
    await appendWorklog({ actorId: actor.actorId }, payload);
    await timelineQuery.refresh();
  };

  // ---------------------------------------------------------------- empty state
  const totalCards = board.lanes.reduce(
    (sum, lane) => sum + lane.cards.length,
    0
  );
  const showEmptyState =
    enabled && view === "board" && !boardQuery.isLoading && totalCards === 0;

  // ---------------------------------------------------------------- view switching
  const onChangeView = (next: TasksView) => setView(next);

  const onOpenTask = (taskId: string) => setOpenTaskId(taskId);

  const onChangeListSort = (key: ListSortKey) => {
    let nextDir: ListSortDir;
    if (sortKey === key) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      nextDir = key === "age" ? "desc" : "asc";
    }
    setSortKey(key);
    setSortDir(nextDir);
    writeUrl({ sort: `${key}:${nextDir}` });
  };

  const onShowBlocked = () => {
    setStatusFilter("blocked");
    writeUrl({ status: "blocked" });
    setView("list");
  };

  const onToggleReopened = () => {
    setReopenedFilterActive((value) => !value);
  };

  const streamLabel =
    stream.status === "connected"
      ? "live"
      : stream.status === "retrying"
      ? `retry ${stream.reconnectCount}`
      : "offline";
  const streamTone =
    stream.status === "connected"
      ? ("ok" as const)
      : stream.status === "retrying"
      ? ("warn" as const)
      : ("danger" as const);

  return (
    <div className="space-y-4 pb-24">
      <ControlBar
        projects={projectsQuery.data?.items ?? []}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setOpenTaskId(null);
          setSelectedIds(new Set());
        }}
        view={view}
        onChangeView={onChangeView}
        blockedCount={board.counters.blocked_tasks}
        reopenedCount={tasks.filter((task) => task.status === "reopened").length}
        reopenedFilterActive={reopenedFilterActive}
        onToggleReopenedFilter={onToggleReopened}
        onShowBlocked={onShowBlocked}
        query={filterQuery}
        onQueryChange={setFilterQuery}
        streamLabel={streamLabel}
        streamTone={streamTone}
      />

      {actionError ? (
        <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {showEmptyState ? (
        <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
            Empty board
          </p>
          <p className="font-display text-lg font-semibold text-ink">
            No tasks yet
          </p>
          <p className="max-w-md text-sm text-ink-tertiary">
            Tasks created on this project will appear here. Create the first
            one to begin.
          </p>
          <Button type="button" variant="primary" size="sm" disabled>
            <Plus className="h-3.5 w-3.5" /> New task
          </Button>
        </div>
      ) : view === "board" ? (
        <section className="surface p-3">
          <BoardView
            board={board}
            selectedIds={selectedIds}
            openTaskId={openTaskId}
            isTransitionAllowed={isTransitionAllowed}
            onTransition={handleBoardTransition}
            onCardClick={handleCardClick}
            onToggleSelect={handleToggleSelect}
          />
        </section>
      ) : view === "list" ? (
        <ListView
          tasks={tasks}
          query={filterQuery}
          statusFilter={statusFilter}
          reopenedFilterActive={reopenedFilterActive}
          sortKey={sortKey}
          sortDir={sortDir}
          onChangeSort={onChangeListSort}
          onOpenTask={onOpenTask}
        />
      ) : (
        <TimelineView tasks={tasks} onOpenTask={onOpenTask} />
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        validBulkTransitions={validBulkTransitions}
        isMutating={isMutating}
        onClear={() => setSelectedIds(new Set())}
        onApply={handleBulkApply}
      />

      <TaskInspector
        open={Boolean(openTaskId)}
        onOpenChange={(next) => {
          if (!next) setOpenTaskId(null);
        }}
        card={openCard}
        timeline={timelineQuery.data ?? null}
        timelineLoading={timelineQuery.isLoading}
        agents={projectAgentsQuery.data?.items ?? []}
        allowedTransitions={allowedTransitionsForOpen}
        isMutating={isMutating}
        actionError={actionError}
        onTransition={async (target, options) => {
          if (!openCard) return;
          await runTransition(openCard.id, target, options);
        }}
        onAppendWorklog={handleAppendWorklog}
        cardsById={cardsById}
      />
    </div>
  );
}
