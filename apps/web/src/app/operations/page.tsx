"use client";

import type { ProjectStaffingAgent, TaskContract, WorklogEntry } from "@sentientops/contracts";
import { useEffect, useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { WorklogComposer } from "@/components/worklog-composer";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { useResilientEventStream } from "@/hooks/use-resilient-event-stream";
import {
  appendWorklog,
  assignProjectManager,
  attachAgentToProject,
  createProjectAgent,
  detachAgentFromProject,
  getProjectStaffing,
  getTaskTimeline,
  listEvaluations,
  listProjects,
  listTasks,
  listWorklogs,
  openProjectEventStream,
  requestEvaluation,
  updateAgentStatus
} from "@/lib/api-client";
import { TASK_STATUS_LABELS } from "@/lib/status";

function formatDate(iso?: string | null): string {
  if (!iso) return "n/a";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.valueOf())) return "n/a";
  return parsed.toLocaleString();
}

function contributionLabel(agent: ProjectStaffingAgent): string {
  const parts = [
    `${agent.worklog_count} logs`,
    `${agent.assigned_task_count} assigned`,
    `${agent.completed_task_count} completed`
  ];
  if (typeof agent.average_score === "number") {
    parts.push(`avg ${agent.average_score.toFixed(1)}`);
  }
  return parts.join(" | ");
}

function roleTone(role: string): string {
  switch (role) {
    case "manager":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "evaluator":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-teal-200 bg-teal-50 text-teal-700";
  }
}

export default function OperationsPage() {
  const actor = useActor();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedAttachAgentId, setSelectedAttachAgentId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<"manager" | "worker" | "evaluator">("worker");
  const [createType, setCreateType] = useState<"project_side" | "platform_side">("project_side");
  const [createCapabilities, setCreateCapabilities] = useState("");
  const [createStatus, setCreateStatus] = useState<"active" | "inactive" | "paused">("active");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const stream = useResilientEventStream({
    enabled: actor.ready && Boolean(selectedProjectId),
    connect: () => openProjectEventStream(selectedProjectId, actor.actorId || "owner-dev"),
    onEvent: (event) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "heartbeat") return;
      } catch {
        // Ignore non-JSON stream noise.
      }
      setStreamPulse((value) => value + 1);
    }
  });

  const staffingQuery = usePollingQuery(
    () => getProjectStaffing({ actorId: actor.actorId }, selectedProjectId),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId), intervalMs: stream.status === "connected" ? 60_000 : 10_000 }
  );

  const tasksQuery = usePollingQuery(
    () => listTasks({ actorId: actor.actorId }, { projectId: selectedProjectId, limit: 200 }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId), intervalMs: stream.status === "connected" ? 60_000 : 10_000 }
  );

  const worklogsQuery = usePollingQuery(
    () => listWorklogs({ actorId: actor.actorId }, { projectId: selectedProjectId, limit: 18 }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId), intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
  );

  const evaluationsQuery = usePollingQuery(
    () => listEvaluations({ actorId: actor.actorId }, { projectId: selectedProjectId, limit: 8 }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId), intervalMs: 30_000 }
  );

  useEffect(() => {
    const firstTask = tasksQuery.data?.items[0]?.id;
    if (!selectedTaskId && firstTask) {
      setSelectedTaskId(firstTask);
      return;
    }
    if (selectedTaskId && !(tasksQuery.data?.items ?? []).some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(firstTask ?? "");
    }
  }, [selectedTaskId, tasksQuery.data?.items]);

  const timelineQuery = usePollingQuery(
    () => getTaskTimeline({ actorId: actor.actorId }, selectedTaskId),
    [actor.actorId, selectedTaskId],
    { enabled: actor.ready && Boolean(selectedTaskId), intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
  );

  useEffect(() => {
    if (!streamPulse) return;
    void staffingQuery.refresh();
    void tasksQuery.refresh();
    void worklogsQuery.refresh();
    void evaluationsQuery.refresh();
    if (selectedTaskId) {
      void timelineQuery.refresh();
    }
  }, [evaluationsQuery, selectedTaskId, staffingQuery, streamPulse, tasksQuery, timelineQuery, worklogsQuery]);

  const selectedTask = useMemo(
    () => (tasksQuery.data?.items ?? []).find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasksQuery.data?.items]
  );

  const rosterAgents = useMemo(() => {
    const summary = staffingQuery.data;
    if (!summary) return [] as ProjectStaffingAgent[];
    const items = [
      ...(summary.manager ? [summary.manager] : []),
      ...summary.workers,
      ...summary.evaluators,
      ...summary.other_agents
    ];
    const unique = new Map<string, ProjectStaffingAgent>();
    for (const agent of items) {
      unique.set(agent.id, agent);
    }
    return Array.from(unique.values());
  }, [staffingQuery.data]);

  useEffect(() => {
    if (!selectedManagerId) {
      const firstManager = rosterAgents.find((agent) => agent.role === "manager");
      if (firstManager) {
        setSelectedManagerId(firstManager.id);
      }
    }
  }, [rosterAgents, selectedManagerId]);

  const disabledReasonForLog = useMemo(() => {
    if (!selectedProjectId) return "Select a project before writing logs.";
    if (!tasksQuery.data?.items.length) return "Create or load a task before writing logs.";
    if (!rosterAgents.length) return "Attach at least one agent to the project first.";
    return null;
  }, [rosterAgents.length, selectedProjectId, tasksQuery.data?.items.length]);

  const guardrails = [
    "One manager per project",
    "Only assigned workers can claim tasks",
    "Completed tasks enter evaluation",
    "Overrides require owner reason and audit"
  ];

  const refreshAll = async () => {
    await Promise.all([
      staffingQuery.refresh(),
      tasksQuery.refresh(),
      worklogsQuery.refresh(),
      evaluationsQuery.refresh(),
      selectedTaskId ? timelineQuery.refresh() : Promise.resolve()
    ]);
  };

  const setFeedback = (message: string) => {
    setActionError(null);
    setActionMessage(message);
  };

  const handleAction = async (runner: () => Promise<void>, success: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      await runner();
      await refreshAll();
      setFeedback(success);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed");
    }
  };

  const selectedTaskMemory = (timelineQuery.data?.memory ?? []) as Array<Record<string, unknown>>;
  const selectedTaskWorklogs = (timelineQuery.data?.worklogs ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Project Operations</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Manager and Agent Control Surface</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Staff a project, keep agents attached to the correct workspace, and capture execution logs without forcing people or agents
              through raw JSON.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Select project</option>
              {(projectsQuery.data?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <span
              className={[
                "rounded-full border px-3 py-1 text-xs",
                stream.status === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              ].join(" ")}
            >
              Stream {stream.status}
            </span>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3">
          <QueryState isLoading={staffingQuery.isLoading} error={staffingQuery.error} lastUpdatedAt={staffingQuery.lastUpdatedAt} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Project Roster</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              Total {staffingQuery.data?.counters.total_agents ?? 0}
            </span>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-700">
              Active {staffingQuery.data?.counters.active_agents ?? 0}
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
              Blocked Tasks {staffingQuery.data?.counters.blocked_tasks ?? 0}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Manager Slot</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {staffingQuery.data?.manager?.name ?? "No manager assigned"}
                  </p>
                </div>
                {staffingQuery.data?.manager ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">live</span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">empty</span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {staffingQuery.data?.manager
                  ? contributionLabel(staffingQuery.data.manager)
                  : "Create or attach a manager-role agent, then assign the slot."}
              </p>
              {!staffingQuery.data?.manager ? (
                <div className="mt-3 flex gap-2">
                  <select
                    value={selectedManagerId}
                    onChange={(event) => setSelectedManagerId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="">Select manager agent</option>
                    {rosterAgents
                      .filter((agent) => agent.role === "manager")
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedManagerId}
                    onClick={() =>
                      void handleAction(
                        () => assignProjectManager({ actorId: actor.actorId }, selectedProjectId, selectedManagerId).then(() => undefined),
                        "Manager assigned."
                      )
                    }
                    className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              ) : null}
            </div>

            {[
              { title: "Workers", items: staffingQuery.data?.workers ?? [] },
              { title: "Evaluators", items: staffingQuery.data?.evaluators ?? [] },
              { title: "Other Agents", items: staffingQuery.data?.other_agents ?? [] }
            ].map((group) => (
              <div key={group.title}>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
                <div className="mt-2 space-y-2">
                  {group.items.length ? (
                    group.items.map((agent) => (
                      <div key={agent.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{contributionLabel(agent)}</p>
                          </div>
                          <span className={["rounded-full border px-2 py-1 text-[11px]", roleTone(agent.role)].join(" ")}>
                            {agent.role}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-600">
                          {(agent.capabilities ?? []).map((capability) => (
                            <span key={capability} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                              {capability}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <select
                            value={agent.status}
                            onChange={(event) =>
                              void handleAction(
                                () =>
                                  updateAgentStatus(
                                    { actorId: actor.actorId },
                                    agent.id,
                                    event.target.value as "active" | "inactive" | "paused"
                                  ).then(() => undefined),
                                `${agent.name} status updated.`
                              )
                            }
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-800"
                          >
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="inactive">inactive</option>
                          </select>
                          {!agent.is_project_manager ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleAction(
                                  () => detachAgentFromProject({ actorId: actor.actorId }, selectedProjectId, agent.id).then(() => undefined),
                                  `${agent.name} detached from the project.`
                                )
                              }
                              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] text-rose-700"
                            >
                              Detach
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      No {group.title.toLowerCase()} attached.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <article className="panel p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Create Project Agent</p>
                <div className="mt-3 grid gap-2">
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="Agent name"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={createRole}
                      onChange={(event) => setCreateRole(event.target.value as "manager" | "worker" | "evaluator")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="worker">worker</option>
                      <option value="manager">manager</option>
                      <option value="evaluator">evaluator</option>
                    </select>
                    <select
                      value={createType}
                      onChange={(event) => setCreateType(event.target.value as "project_side" | "platform_side")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="project_side">project_side</option>
                      <option value="platform_side">platform_side</option>
                    </select>
                  </div>
                  <input
                    value={createCapabilities}
                    onChange={(event) => setCreateCapabilities(event.target.value)}
                    placeholder="Capabilities, comma separated"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                  <select
                    value={createStatus}
                    onChange={(event) => setCreateStatus(event.target.value as "active" | "inactive" | "paused")}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <button
                    type="button"
                    disabled={!selectedProjectId || !createName.trim()}
                    onClick={() =>
                      void handleAction(
                        () =>
                          createProjectAgent({ actorId: actor.actorId }, selectedProjectId, {
                            name: createName.trim(),
                            role: createRole,
                            type: createType,
                            capabilities: createCapabilities
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                            status: createStatus
                          }).then(() => {
                            setCreateName("");
                            setCreateCapabilities("");
                            if (createRole === "manager") {
                              setSelectedManagerId("");
                            }
                          }),
                        `${createName.trim()} created for the project.`
                      )
                    }
                    className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-700 disabled:opacity-50"
                  >
                    Create Agent
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Attach Existing Agent</p>
                <p className="mt-2 text-sm text-slate-600">
                  Attach from the global registry without moving agents away from another active project.
                </p>
                <div className="mt-3 grid gap-2">
                  <select
                    value={selectedAttachAgentId}
                    onChange={(event) => setSelectedAttachAgentId(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Select unattached agent</option>
                    {(staffingQuery.data?.attachable_agents ?? []).map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.role})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedProjectId || !selectedAttachAgentId}
                    onClick={() =>
                      void handleAction(
                        () => attachAgentToProject({ actorId: actor.actorId }, selectedProjectId, selectedAttachAgentId).then(() => {
                          setSelectedAttachAgentId("");
                        }),
                        "Agent attached to the project."
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                  >
                    Attach Agent
                  </button>
                </div>
              </div>
            </div>

            {actionError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
            ) : null}
            {actionMessage ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionMessage}</p>
            ) : null}
          </article>

          <article className="panel p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Interaction Console</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <select
                      value={selectedTaskId}
                      onChange={(event) => setSelectedTaskId(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="">Select task context</option>
                      {(tasksQuery.data?.items ?? []).map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedTask || !selectedTask.assigned_to}
                      onClick={() =>
                        selectedTask
                          ? void handleAction(
                              () =>
                                requestEvaluation({ actorId: actor.actorId }, {
                                  project_id: selectedTask.project_id,
                                  task_id: selectedTask.id,
                                  agent_id: selectedTask.assigned_to ?? actor.actorId,
                                  requested_by: actor.actorId
                                }).then(() => undefined),
                              "Evaluation requested."
                            )
                          : undefined
                      }
                      className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-700 disabled:opacity-50"
                    >
                      Request Evaluation
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-slate-500">Task Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedTask ? TASK_STATUS_LABELS[selectedTask.status] : "No task selected"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-slate-500">Assigned Agent</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedTask?.assigned_to ?? "Unassigned"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-slate-500">Recent Activity</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{worklogsQuery.data?.count ?? 0} logs</p>
                    </div>
                  </div>
                </div>

                <WorklogComposer
                  title="Agent Worklog"
                  tasks={(tasksQuery.data?.items ?? []) as TaskContract[]}
                  agents={rosterAgents}
                  initialTaskId={selectedTaskId}
                  initialAgentId={selectedTask?.assigned_to ?? rosterAgents[0]?.id}
                  disabledReason={disabledReasonForLog}
                  submitLabel="Append Worklog"
                  onSubmit={async (payload) => {
                    await appendWorklog({ actorId: actor.actorId }, payload);
                    await Promise.all([worklogsQuery.refresh(), timelineQuery.refresh()]);
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Recent Project Activity</p>
                <div className="mt-3 space-y-2">
                  {(worklogsQuery.data?.items ?? []).map((entry: WorklogEntry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedTaskId(entry.task_id)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.summary}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {entry.agent_name} | {entry.action_type} | {entry.task_title}
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-500">{formatDate(entry.timestamp)}</span>
                      </div>
                    </button>
                  ))}
                  {!worklogsQuery.data?.items.length ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                      No worklogs yet for this project.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside className="panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Context Rail</p>
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{selectedTask?.title ?? "Select a task"}</p>
              <p className="mt-1 text-xs text-slate-600">{selectedTask?.description ?? "Task context will appear here."}</p>
              {selectedTask ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                    {TASK_STATUS_LABELS[selectedTask.status]}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                    {selectedTask.priority}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                    assignee {selectedTask.assigned_to ?? "none"}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Policy Guardrails</p>
              <div className="mt-2 space-y-2">
                {guardrails.map((rule) => (
                  <div key={rule} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Why Actions Disable</p>
              <div className="mt-2 space-y-2 text-xs text-slate-700">
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {disabledReasonForLog ?? "Logging is ready. Task and agent defaults are prefilled from current context."}
                </p>
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {staffingQuery.data?.manager
                    ? "Manager slot is healthy."
                    : "Manager slot is empty. Create or attach a manager-role agent, then assign it."}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Memory Snapshot</p>
              <div className="mt-2 space-y-2">
                {selectedTaskMemory.length ? (
                  selectedTaskMemory.slice(0, 4).map((memory, index) => (
                    <div key={String(memory.id ?? index)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-medium text-slate-900">{String(memory.title ?? "Untitled memory")}</p>
                      <p className="mt-1 text-slate-600">{String(memory.content ?? "")}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No memory attached to this task yet.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Latest Evaluations</p>
              <div className="mt-2 space-y-2">
                {(timelineQuery.data?.evaluations ?? evaluationsQuery.data?.items ?? []).slice(0, 4).map((evaluation) => (
                  <div key={evaluation.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="font-medium text-slate-900">{evaluation.agent_id}</p>
                    <p className="mt-1 text-slate-600">
                      evaluator {evaluation.evaluator_agent_id} | quality {evaluation.score_quality}/10
                    </p>
                    <p className="mt-1 text-slate-500">{formatDate(evaluation.timestamp)}</p>
                  </div>
                ))}
                {!(timelineQuery.data?.evaluations ?? evaluationsQuery.data?.items ?? []).length ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No evaluations visible for the current selection.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Task Worklog Thread</p>
              <div className="mt-2 space-y-2">
                {selectedTaskWorklogs.length ? (
                  selectedTaskWorklogs.slice(0, 5).map((entry, index) => (
                    <div key={String(entry.id ?? index)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-medium text-slate-900">{String(entry.summary ?? "Untitled log")}</p>
                      <p className="mt-1 text-slate-600">{String(entry.action_type ?? "activity")}</p>
                      <p className="mt-1 text-slate-500">{formatDate(String(entry.timestamp ?? ""))}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No task-specific worklogs yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

