"use client";

import type { TaskStatus } from "@sentientops/contracts";
import { TASK_STATUSES } from "@sentientops/contracts";
import { useEffect, useMemo, useState } from "react";

import { AgentKeyPanel } from "@/components/agent-key-panel";
import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { useAgentKey } from "@/hooks/use-agent-key";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { callAgentTool, fetchTaskContext, listProjects, listTasks } from "@/lib/api-client";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "@/lib/status";

export default function TasksPage() {
  const actor = useActor();
  const { agentKey, saveAgentKey } = useAgentKey();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTaskContext, setSelectedTaskContext] = useState<Record<string, unknown> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<"idle" | "running">("idle");

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  useEffect(() => {
    const first = projectsQuery.data?.items[0]?.id;
    if (!selectedProjectId && first) {
      setSelectedProjectId(first);
    }
  }, [projectsQuery.data?.items, selectedProjectId]);

  const tasksQuery = usePollingQuery(
    () =>
      listTasks({ actorId: actor.actorId }, { projectId: selectedProjectId || undefined }).then((response) => response.items),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready }
  );

  useEffect(() => {
    const firstTask = tasksQuery.data?.[0]?.id;
    if (!selectedTaskId && firstTask) {
      setSelectedTaskId(firstTask);
    }
  }, [tasksQuery.data, selectedTaskId]);

  const selectedTask = useMemo(
    () => tasksQuery.data?.find((task) => task.id === selectedTaskId) ?? null,
    [tasksQuery.data, selectedTaskId]
  );

  const lanes = useMemo(() => {
    const byStatus = new Map<TaskStatus, typeof tasksQuery.data>();
    for (const status of TASK_STATUSES) {
      byStatus.set(status, []);
    }
    for (const task of tasksQuery.data ?? []) {
      const current = byStatus.get(task.status as TaskStatus) ?? [];
      current.push(task);
      byStatus.set(task.status as TaskStatus, current);
    }
    return byStatus;
  }, [tasksQuery.data]);

  const loadTaskContext = async (taskId: string) => {
    if (!agentKey.trim()) {
      setActionError("Agent API key is required to load task context.");
      return;
    }
    setActionError(null);
    try {
      const response = await fetchTaskContext(agentKey.trim(), taskId);
      setSelectedTaskContext(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch context";
      setActionError(message);
    }
  };

  const updateTaskStatus = async (nextStatus: TaskStatus) => {
    if (!selectedTaskId) return;
    if (!agentKey.trim()) {
      setActionError("Agent API key is required for mutation actions.");
      return;
    }
    setActionError(null);
    setActionState("running");
    try {
      if (nextStatus === "completed") {
        await callAgentTool(agentKey.trim(), "submit_completion", { task_id: selectedTaskId });
      } else {
        const payload: Record<string, unknown> = {
          task_id: selectedTaskId,
          status: nextStatus
        };
        if (nextStatus === "blocked") {
          const reason = window.prompt("Provide blocker reason", "Dependency unavailable");
          payload.blocker_reason = reason || "Blocked";
        }
        await callAgentTool(agentKey.trim(), "update_task_status", payload);
      }
      await tasksQuery.refresh();
      await loadTaskContext(selectedTaskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task";
      setActionError(message);
    } finally {
      setActionState("idle");
    }
  };

  return (
    <div className="space-y-4">
      <AgentKeyPanel value={agentKey} onChange={saveAgentKey} />

      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Kanban Operations</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-100">Task Workflow Board</h3>
          </div>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="rounded-lg border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All Projects</option>
            {(projectsQuery.data?.items ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <QueryState isLoading={tasksQuery.isLoading} error={tasksQuery.error} lastUpdatedAt={tasksQuery.lastUpdatedAt} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="panel p-4">
          <div className="soft-scroll overflow-x-auto">
            <div className="grid min-w-[1200px] grid-cols-9 gap-3">
              {TASK_STATUSES.map((status) => (
                <article key={status} className="rounded-xl border border-slate-300/20 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{TASK_STATUS_LABELS[status]}</p>
                    <span className="rounded-full border border-slate-300/30 px-2 py-0.5 text-xs text-slate-300">
                      {lanes.get(status)?.length ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(lanes.get(status) ?? []).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          void loadTaskContext(task.id);
                        }}
                        className={[
                          "w-full rounded-lg border px-3 py-2 text-left transition",
                          task.id === selectedTaskId
                            ? "border-teal-300/45 bg-teal-500/15 text-teal-100"
                            : `border-slate-300/20 bg-slate-800/45 text-slate-100 ${TASK_STATUS_STYLES[task.status as TaskStatus]}`
                        ].join(" ")}
                      >
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-300">{task.priority.toUpperCase()}</p>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Task Inspector</p>
          {selectedTask ? (
            <div className="mt-2 space-y-3 text-sm">
              <div className="rounded-lg border border-slate-300/20 bg-white/5 p-3">
                <p className="text-base font-semibold text-slate-100">{selectedTask.title}</p>
                <p className="mt-1 text-slate-300">{selectedTask.description}</p>
                <p className="mt-2 text-xs text-slate-400">Assigned: {selectedTask.assigned_to ?? "Unassigned"}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-teal-300/40 bg-teal-500/12 px-2 py-2 text-teal-100 disabled:opacity-50"
                  disabled={actionState === "running"}
                  onClick={() => void updateTaskStatus("in_progress")}
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300/40 bg-amber-500/12 px-2 py-2 text-amber-100 disabled:opacity-50"
                  disabled={actionState === "running"}
                  onClick={() => void updateTaskStatus("under_review")}
                >
                  Mark Review
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-300/40 bg-rose-500/12 px-2 py-2 text-rose-100 disabled:opacity-50"
                  disabled={actionState === "running"}
                  onClick={() => void updateTaskStatus("blocked")}
                >
                  Mark Blocked
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-emerald-300/40 bg-emerald-500/12 px-2 py-2 text-emerald-100 disabled:opacity-50"
                  disabled={actionState === "running"}
                  onClick={() => void updateTaskStatus("completed")}
                >
                  Complete
                </button>
              </div>

              <button
                type="button"
                onClick={() => void loadTaskContext(selectedTask.id)}
                className="w-full rounded-lg border border-slate-300/30 bg-white/5 px-3 py-2 text-xs text-slate-200"
              >
                Refresh task context
              </button>

              {actionError ? (
                <p className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{actionError}</p>
              ) : null}

              <div className="rounded-lg border border-slate-300/20 bg-slate-900/40 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Context</p>
                <pre className="soft-scroll mt-2 max-h-60 overflow-auto text-xs text-slate-200">
                  {selectedTaskContext ? JSON.stringify(selectedTaskContext, null, 2) : "Select a task and load context."}
                </pre>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-300">Select a task card to inspect details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
