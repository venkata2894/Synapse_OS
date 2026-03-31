"use client";

import type { BoardCard, BoardLane, BoardSnapshot, TaskStatus } from "@sentientops/contracts";
import { TASK_STATUSES } from "@sentientops/contracts";
import { useEffect, useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { useResilientEventStream } from "@/hooks/use-resilient-event-stream";
import {
  getBoard,
  getDefaultProcessTemplate,
  getTaskTimeline,
  listAgents,
  listProjects,
  openProjectEventStream,
  transitionTask
} from "@/lib/api-client";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "@/lib/status";

const emptyBoard: BoardSnapshot = {
  project_id: "",
  project_name: "",
  generated_at: "",
  counters: { total_tasks: 0, blocked_tasks: 0, in_progress_tasks: 0 },
  lanes: []
};

const LANE_ORDER: TaskStatus[] = [
  "intake",
  "backlog",
  "ready",
  "assigned",
  "in_progress",
  "awaiting_handover",
  "under_review",
  "evaluation",
  "blocked",
  "reopened",
  "completed"
];

const FALLBACK_TRANSITION_MATRIX: Record<TaskStatus, TaskStatus[]> = {
  intake: ["ready", "blocked"],
  backlog: ["ready", "blocked"],
  ready: ["assigned", "blocked"],
  assigned: ["in_progress", "blocked"],
  in_progress: ["awaiting_handover", "under_review", "blocked"],
  awaiting_handover: ["under_review", "blocked"],
  under_review: ["evaluation", "reopened", "blocked"],
  evaluation: ["completed", "reopened"],
  blocked: ["ready", "assigned", "in_progress", "awaiting_handover", "under_review", "evaluation", "reopened"],
  reopened: ["ready", "assigned", "in_progress"],
  completed: ["reopened"]
};

type DragState = {
  taskId: string;
  fromStatus: TaskStatus;
} | null;

type TransitionOptions = {
  reason?: string;
  blockerReason?: string;
  assignedTo?: string;
};

function asTaskStatus(value: string): TaskStatus | null {
  if ((TASK_STATUSES as readonly string[]).includes(value)) {
    return value as TaskStatus;
  }
  return null;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "n/a";
  return date.toLocaleString();
}

function laneOrder(status: string): number {
  const normalized = asTaskStatus(status);
  if (!normalized) return 999;
  return LANE_ORDER.indexOf(normalized);
}

function sortLanes(lanes: BoardLane[]): BoardLane[] {
  return [...lanes].sort((a, b) => laneOrder(a.status) - laneOrder(b.status));
}

function cloneBoard(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    ...snapshot,
    counters: { ...snapshot.counters },
    lanes: snapshot.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => ({ ...card }))
    }))
  };
}

function recomputeBoardCounters(snapshot: BoardSnapshot): BoardSnapshot {
  const cards = snapshot.lanes.flatMap((lane) => lane.cards);
  for (const lane of snapshot.lanes) {
    lane.count = lane.cards.length;
    lane.blocked_count = lane.cards.filter((card) => card.status === "blocked" || Boolean(card.blocker_reason)).length;
  }
  snapshot.counters.total_tasks = cards.length;
  snapshot.counters.blocked_tasks = cards.filter((card) => card.status === "blocked").length;
  snapshot.counters.in_progress_tasks = cards.filter((card) => card.status === "in_progress").length;
  return snapshot;
}

function readString(value: unknown, fallback = "n/a"): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export default function TasksPage() {
  const actor = useActor();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [assignTarget, setAssignTarget] = useState("");
  const [transitionTarget, setTransitionTarget] = useState<TaskStatus | "">("");
  const [transitionReason, setTransitionReason] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);
  const [optimisticBoard, setOptimisticBoard] = useState<BoardSnapshot | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [streamPulse, setStreamPulse] = useState(0);

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready, intervalMs: 30_000 }
  );

  useEffect(() => {
    const first = projectsQuery.data?.items[0]?.id;
    if (!selectedProjectId && first) {
      setSelectedProjectId(first);
    }
  }, [projectsQuery.data?.items, selectedProjectId]);

  const processTemplateQuery = usePollingQuery(
    () => getDefaultProcessTemplate({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready, intervalMs: 120_000 }
  );

  const stream = useResilientEventStream({
    enabled: actor.ready && Boolean(selectedProjectId),
    connect: () => openProjectEventStream(selectedProjectId, actor.actorId || "owner-dev"),
    onEvent: (event) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "heartbeat") {
          return;
        }
      } catch {
        // Ignore parsing failures from non-JSON stream messages.
      }
      setStreamPulse((current) => current + 1);
    }
  });

  const boardQuery = usePollingQuery(
    () => (selectedProjectId ? getBoard({ actorId: actor.actorId }, selectedProjectId) : Promise.resolve(emptyBoard)),
    [actor.actorId, selectedProjectId],
    {
      enabled: actor.ready && Boolean(selectedProjectId),
      initialData: emptyBoard,
      intervalMs: stream.status === "connected" ? 60_000 : 10_000
    }
  );

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId }, { projectId: selectedProjectId, role: "worker", limit: 200 }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId), intervalMs: 30_000 }
  );

  const board = optimisticBoard ?? boardQuery.data ?? emptyBoard;
  const orderedLanes = useMemo(() => sortLanes(board.lanes), [board.lanes]);

  useEffect(() => {
    if (boardQuery.data) {
      setOptimisticBoard(boardQuery.data);
    }
  }, [boardQuery.data]);

  const selectedTask = useMemo(() => {
    for (const lane of orderedLanes) {
      const found = lane.cards.find((card) => card.id === selectedTaskId);
      if (found) {
        return found;
      }
    }
    return null;
  }, [orderedLanes, selectedTaskId]);

  const timelineQuery = usePollingQuery(
    () => (selectedTaskId ? getTaskTimeline({ actorId: actor.actorId }, selectedTaskId) : Promise.resolve(null as never)),
    [actor.actorId, selectedTaskId],
    {
      enabled: actor.ready && Boolean(selectedTaskId),
      intervalMs: stream.status === "connected" ? 45_000 : 10_000
    }
  );

  useEffect(() => {
    const firstTask = orderedLanes.flatMap((lane) => lane.cards)[0]?.id;
    if (!selectedTaskId && firstTask) {
      setSelectedTaskId(firstTask);
      return;
    }
    if (selectedTaskId) {
      const exists = orderedLanes.some((lane) => lane.cards.some((card) => card.id === selectedTaskId));
      if (!exists) {
        setSelectedTaskId(firstTask ?? "");
      }
    }
  }, [orderedLanes, selectedTaskId]);

  useEffect(() => {
    if (!selectedTask) {
      setAssignTarget("");
      return;
    }
    setAssignTarget(selectedTask.assigned_to ?? "");
  }, [selectedTask?.id]);

  useEffect(() => {
    if (!streamPulse) return;
    void boardQuery.refresh();
    if (selectedTaskId) {
      void timelineQuery.refresh();
    }
  }, [boardQuery, selectedTaskId, streamPulse, timelineQuery]);

  const transitionMatrix = useMemo(() => {
    const matrix = processTemplateQuery.data?.transition_matrix;
    if (!matrix || Object.keys(matrix).length === 0) {
      return FALLBACK_TRANSITION_MATRIX;
    }
    const normalized: Record<TaskStatus, TaskStatus[]> = { ...FALLBACK_TRANSITION_MATRIX };
    for (const [fromStatus, nextStatuses] of Object.entries(matrix)) {
      const from = asTaskStatus(fromStatus);
      if (!from) continue;
      normalized[from] = nextStatuses
        .map((item) => asTaskStatus(item))
        .filter((item): item is TaskStatus => Boolean(item));
    }
    return normalized;
  }, [processTemplateQuery.data?.transition_matrix]);

  const allowedTransitions = useMemo(() => {
    if (!selectedTask) return [];
    return transitionMatrix[selectedTask.status] ?? [];
  }, [selectedTask, transitionMatrix]);

  useEffect(() => {
    if (!selectedTask) {
      setTransitionTarget("");
      setTransitionReason("");
      setBlockerReason("");
      return;
    }
    if (!transitionTarget || !allowedTransitions.includes(transitionTarget)) {
      setTransitionTarget(allowedTransitions[0] ?? "");
    }
  }, [allowedTransitions, selectedTask, transitionTarget]);

  const boardCardsById = useMemo(() => {
    const map = new Map<string, BoardCard>();
    for (const lane of orderedLanes) {
      for (const card of lane.cards) {
        map.set(card.id, card);
      }
    }
    return map;
  }, [orderedLanes]);

  const taskDetails = timelineQuery.data?.task;
  const handovers = (timelineQuery.data?.handovers ?? []) as Array<Record<string, unknown>>;
  const transitions = timelineQuery.data?.transitions ?? [];
  const evaluations = timelineQuery.data?.evaluations ?? [];
  const memoryEntries = (timelineQuery.data?.memory ?? []) as Array<Record<string, unknown>>;
  const worklogs = (timelineQuery.data?.worklogs ?? []) as Array<Record<string, unknown>>;
  const latestEvaluation = evaluations[0] ?? null;

  const dependencyIds = useMemo(() => {
    if (!taskDetails?.dependencies) return [];
    return taskDetails.dependencies;
  }, [taskDetails?.dependencies]);

  const dependencyCards = useMemo(
    () => dependencyIds.map((id) => boardCardsById.get(id)).filter((item): item is BoardCard => Boolean(item)),
    [boardCardsById, dependencyIds]
  );

  const isTransitionAllowed = (fromStatus: TaskStatus, toStatus: TaskStatus): boolean =>
    (transitionMatrix[fromStatus] ?? []).includes(toStatus);

  const applyOptimisticMove = (taskId: string, toStatus: TaskStatus, options?: TransitionOptions) => {
    if (!board.lanes.length) return false;
    const draft = cloneBoard(board);

    let movedCard: BoardCard | null = null;
    for (const lane of draft.lanes) {
      const index = lane.cards.findIndex((card) => card.id === taskId);
      if (index >= 0) {
        movedCard = lane.cards[index];
        lane.cards.splice(index, 1);
        break;
      }
    }
    if (!movedCard) {
      return false;
    }

    const targetLane = draft.lanes.find((lane) => lane.status === toStatus);
    if (!targetLane) {
      return false;
    }

    targetLane.cards.unshift({
      ...movedCard,
      status: toStatus,
      assigned_to: options?.assignedTo ?? movedCard.assigned_to,
      blocker_reason: toStatus === "blocked" ? options?.blockerReason ?? movedCard.blocker_reason : null,
      updated_at: new Date().toISOString()
    });
    setOptimisticBoard(recomputeBoardCounters(draft));
    return true;
  };

  const runTransition = async (taskId: string, targetStatus: TaskStatus, options?: TransitionOptions) => {
    const activeTask = boardCardsById.get(taskId);
    if (!activeTask) return;

    if (!isTransitionAllowed(activeTask.status, targetStatus)) {
      setActionError(`Transition not allowed: ${TASK_STATUS_LABELS[activeTask.status]} -> ${TASK_STATUS_LABELS[targetStatus]}`);
      return;
    }

    setActionError(null);
    setIsMutating(true);
    const previousBoard = board;
    applyOptimisticMove(taskId, targetStatus, options);

    try {
      await transitionTask({ actorId: actor.actorId }, taskId, {
        target_status: targetStatus,
        reason: options?.reason,
        blocker_reason: options?.blockerReason,
        assigned_to: options?.assignedTo
      });
      await Promise.all([boardQuery.refresh(), timelineQuery.refresh()]);
    } catch (err) {
      setOptimisticBoard(previousBoard);
      setActionError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsMutating(false);
    }
  };

  const submitTransition = async () => {
    if (!selectedTask || !transitionTarget) return;
    if (transitionTarget === "assigned" && !assignTarget) {
      setActionError("Select a worker before assigning.");
      return;
    }
    if (transitionTarget === "blocked" && !blockerReason.trim()) {
      setActionError("Provide blocker reason before marking blocked.");
      return;
    }
    await runTransition(selectedTask.id, transitionTarget, {
      reason: transitionReason.trim() || undefined,
      blockerReason: transitionTarget === "blocked" ? blockerReason.trim() : undefined,
      assignedTo: transitionTarget === "assigned" ? assignTarget : undefined
    });
  };

  const onDropLane = async (laneStatus: string) => {
    if (!dragState) return;
    const destination = asTaskStatus(laneStatus);
    const source = dragState.fromStatus;
    const taskId = dragState.taskId;

    setDragState(null);
    setDragOverLane(null);

    if (!destination) {
      setActionError(`Unsupported lane: ${laneStatus}`);
      return;
    }
    if (!isTransitionAllowed(source, destination)) {
      setActionError(`Transition not allowed: ${TASK_STATUS_LABELS[source]} -> ${TASK_STATUS_LABELS[destination]}`);
      return;
    }

    setSelectedTaskId(taskId);
    await runTransition(taskId, destination);
  };

  const oneClickActions = allowedTransitions.filter((status) => !["assigned", "blocked"].includes(status)).slice(0, 5);
  const streamTone =
    stream.status === "connected"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : stream.status === "retrying"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-slate-300 bg-white text-slate-600";

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Execution Board</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Kanban Workflow Console</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Select Project</option>
              {(projectsQuery.data?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void boardQuery.refresh();
                if (selectedTaskId) {
                  void timelineQuery.refresh();
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-2">
          <QueryState isLoading={boardQuery.isLoading} error={boardQuery.error} lastUpdatedAt={boardQuery.lastUpdatedAt} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
            Total: {board.counters.total_tasks}
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
            Blocked: {board.counters.blocked_tasks}
          </span>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-700">
            In Progress: {board.counters.in_progress_tasks}
          </span>
          <span className={["rounded-full border px-3 py-1", streamTone].join(" ")}>
            Stream: {stream.status}
            {stream.status === "retrying" ? ` (${stream.reconnectCount})` : ""}
          </span>
          {stream.lastEventAt ? (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
              Last Event: {formatDate(stream.lastEventAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={stream.reconnect}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600"
          >
            Reconnect Stream
          </button>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="panel p-4">
          <div className="soft-scroll overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {orderedLanes.map((lane) => {
                const laneStatus = asTaskStatus(lane.status);
                const isDraggedOver = dragOverLane === lane.status;
                const canDropHere = Boolean(dragState && laneStatus && isTransitionAllowed(dragState.fromStatus, laneStatus));
                const wipExceeded = lane.count > lane.wip_limit;
                return (
                  <article
                    key={lane.status}
                    className={[
                      "w-[300px] shrink-0 rounded-xl border bg-slate-50/80 p-3 transition",
                      wipExceeded ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200",
                      isDraggedOver ? (canDropHere ? "ring-2 ring-teal-300" : "ring-2 ring-rose-300") : ""
                    ].join(" ")}
                    onDragOver={(event) => {
                      if (!dragState || !laneStatus) return;
                      if (!isTransitionAllowed(dragState.fromStatus, laneStatus)) {
                        event.dataTransfer.dropEffect = "none";
                        return;
                      }
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverLane(lane.status);
                    }}
                    onDrop={() => void onDropLane(lane.status)}
                    onDragLeave={() => setDragOverLane((current) => (current === lane.status ? null : current))}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{lane.label}</p>
                        <p className="text-[11px] text-slate-500">
                          WIP {lane.count}/{lane.wip_limit} | blocked {lane.blocked_count}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                        {lane.count}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                      <div
                        className={[
                          "h-1.5 rounded-full",
                          wipExceeded ? "bg-amber-500" : "bg-teal-400"
                        ].join(" ")}
                        style={{
                          width: `${Math.min(100, Math.round((lane.count / Math.max(1, lane.wip_limit)) * 100))}%`
                        }}
                      />
                    </div>

                    <div className="soft-scroll mt-3 max-h-[66vh] space-y-2 overflow-y-auto pr-1">
                      {lane.cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          draggable
                          onDragStart={() => {
                            if (!asTaskStatus(card.status)) return;
                            setDragState({ taskId: card.id, fromStatus: card.status });
                            setDragOverLane(null);
                          }}
                          onDragEnd={() => {
                            setDragState(null);
                            setDragOverLane(null);
                          }}
                          onClick={() => setSelectedTaskId(card.id)}
                          className={[
                            "w-full rounded-lg border px-3 py-2 text-left transition",
                            selectedTaskId === card.id
                              ? "border-teal-300 bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                              : `border-slate-200 bg-white text-slate-800 hover:shadow-sm ${TASK_STATUS_STYLES[card.status]}`
                          ].join(" ")}
                        >
                          <p className="text-sm font-medium">{card.title}</p>
                          <p className="mt-1 text-xs">
                            {card.priority.toUpperCase()} | {card.assigned_to ? card.assigned_to : "unassigned"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                            <span className="rounded-full border border-slate-300/70 bg-white px-2 py-0.5 text-slate-600">
                              deps {card.dependency_count}
                            </span>
                            {card.blocker_reason ? (
                              <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-700">
                                blocked
                              </span>
                            ) : null}
                          </div>
                          {card.blocker_reason ? <p className="mt-1 text-xs text-rose-700">{card.blocker_reason}</p> : null}
                        </button>
                      ))}
                      {lane.cards.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-4 text-center text-xs text-slate-500">
                          Drop a task here
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Task Inspector</p>
          {selectedTask ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{selectedTask.title}</p>
                    <p className="mt-1 text-xs text-slate-600">Task: {selectedTask.id}</p>
                  </div>
                  <span className={["rounded-full border px-2 py-1 text-xs", TASK_STATUS_STYLES[selectedTask.status]].join(" ")}>
                    {TASK_STATUS_LABELS[selectedTask.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Assignee: {selectedTask.assigned_to ?? "unassigned"} | Priority: {selectedTask.priority}
                </p>
                <p className="mt-1 text-xs text-slate-600">Updated: {formatDate(selectedTask.updated_at)}</p>
                {taskDetails?.description ? <p className="mt-2 text-xs text-slate-700">{taskDetails.description}</p> : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Transition Builder</p>
                <div className="mt-2 grid gap-2">
                  <select
                    value={transitionTarget}
                    onChange={(event) => setTransitionTarget((asTaskStatus(event.target.value) ?? "") as TaskStatus | "")}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                  >
                    <option value="">Select next status</option>
                    {allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {TASK_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>

                  {transitionTarget === "assigned" ? (
                    <select
                      value={assignTarget}
                      onChange={(event) => setAssignTarget(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                    >
                      <option value="">Select worker</option>
                      {(agentsQuery.data?.items ?? []).map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {transitionTarget === "blocked" ? (
                    <input
                      value={blockerReason}
                      onChange={(event) => setBlockerReason(event.target.value)}
                      placeholder="Blocker reason"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                    />
                  ) : null}

                  <input
                    value={transitionReason}
                    onChange={(event) => setTransitionReason(event.target.value)}
                    placeholder="Reason (optional)"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                  />

                  <button
                    type="button"
                    disabled={isMutating || !transitionTarget}
                    onClick={() => void submitTransition()}
                    className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isMutating ? "Applying..." : "Apply Transition"}
                  </button>
                </div>
                {oneClickActions.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {oneClickActions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={isMutating}
                        onClick={() => void runTransition(selectedTask.id, status)}
                        className={[
                          "rounded-full border px-3 py-1 text-[11px] disabled:opacity-60",
                          TASK_STATUS_STYLES[status]
                        ].join(" ")}
                      >
                        {TASK_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Dependencies Graph</p>
                {dependencyIds.length ? (
                  <div className="mt-2 space-y-2">
                    {dependencyIds.map((dependencyId) => {
                      const dependency = boardCardsById.get(dependencyId);
                      return (
                        <div key={dependencyId} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
                          <p className="font-medium text-slate-700">{dependency?.title ?? "Unresolved task dependency"}</p>
                          <p className="mt-0.5 text-slate-600">
                            {dependencyId}
                            {dependency ? ` - ${TASK_STATUS_LABELS[dependency.status]}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No dependency edges on this task.</p>
                )}
                {dependencyCards.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                    {dependencyCards.map((card, index) => (
                      <span key={card.id} className="rounded-full border border-slate-300 bg-white px-2 py-0.5">
                        {index > 0 ? "-> " : ""}
                        {card.title}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Blockers</p>
                {selectedTask.blocker_reason ? (
                  <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs text-rose-700">
                    {selectedTask.blocker_reason}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No active blocker reason recorded.</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Evaluation State</p>
                <p className="mt-2 text-xs text-slate-600">Evaluations: {evaluations.length}</p>
                {latestEvaluation ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
                    <p>Latest evaluator: {latestEvaluation.evaluator_agent_id}</p>
                    <p>
                      Average score:{" "}
                      {(
                        (latestEvaluation.score_completion +
                          latestEvaluation.score_quality +
                          latestEvaluation.score_reliability +
                          latestEvaluation.score_handover +
                          latestEvaluation.score_context +
                          latestEvaluation.score_clarity +
                          latestEvaluation.score_improvement) /
                        7
                      ).toFixed(2)}
                    </p>
                    <p>Timestamp: {formatDate(latestEvaluation.timestamp)}</p>
                    {latestEvaluation.override_reason ? (
                      <p className="mt-1 text-amber-700">Override: {latestEvaluation.override_reason}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No evaluation entries yet.</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Handover Timeline</p>
                {handovers.length ? (
                  <div className="soft-scroll mt-2 max-h-40 space-y-2 overflow-auto pr-1">
                    {handovers.map((handover, index) => (
                      <div key={readString(handover["id"], `handover-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                        <p className="font-medium text-slate-700">
                          {readString(handover["from_agent_id"])} {"->"} {readString(handover["to_agent_id"])}
                        </p>
                        <p className="mt-0.5 text-slate-600">{readString(handover["pending_work"])}</p>
                        <p className="mt-0.5 text-slate-500">{formatDate(readString(handover["timestamp"], ""))}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No handovers for this task.</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Transition History</p>
                {transitions.length ? (
                  <div className="soft-scroll mt-2 max-h-44 space-y-2 overflow-auto pr-1">
                    {transitions.map((transition, index) => {
                      const from = asTaskStatus(transition.from_status) ?? "ready";
                      const to = asTaskStatus(transition.to_status) ?? "ready";
                      return (
                        <div key={transition.id || `transition-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                          <p className="font-medium text-slate-700">
                            {TASK_STATUS_LABELS[from]} {"->"} {TASK_STATUS_LABELS[to]}
                          </p>
                          <p className="mt-0.5 text-slate-600">Actor: {transition.actor_id}</p>
                          {transition.reason ? (
                            <p className="mt-0.5 text-slate-600">Reason: {transition.reason}</p>
                          ) : null}
                          <p className="mt-0.5 text-slate-500">{formatDate(transition.timestamp)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No transition entries yet.</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Memory Context</p>
                {memoryEntries.length ? (
                  <div className="soft-scroll mt-2 max-h-32 space-y-2 overflow-auto pr-1">
                    {memoryEntries.map((memory, index) => (
                      <div key={readString(memory["id"], `memory-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                        <p className="font-medium text-slate-700">{readString(memory["title"])}</p>
                        <p className="mt-0.5 text-slate-600">{readString(memory["content"])}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No memory entries linked to this task.</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Worklog Activity</p>
                {worklogs.length ? (
                  <div className="soft-scroll mt-2 max-h-32 space-y-2 overflow-auto pr-1">
                    {worklogs.map((worklog, index) => (
                      <div key={readString(worklog["id"], `worklog-${index}`)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                        <p className="font-medium text-slate-700">{readString(worklog["action_type"])}</p>
                        <p className="mt-0.5 text-slate-600">{readString(worklog["summary"])}</p>
                        <p className="mt-0.5 text-slate-500">{formatDate(readString(worklog["timestamp"], ""))}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">No worklogs for this task.</p>
                )}
              </div>

              {actionError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</p>
              ) : null}

              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-slate-500">Raw Timeline Payload</summary>
                <pre className="soft-scroll mt-2 max-h-56 overflow-auto text-xs text-slate-700">
                  {timelineQuery.data ? JSON.stringify(timelineQuery.data, null, 2) : "No timeline data."}
                </pre>
              </details>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Select a task card to inspect details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
