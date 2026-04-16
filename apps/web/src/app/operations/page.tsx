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
  const parts = [`${agent.worklog_count} logs`, `${agent.assigned_task_count} assigned`, `${agent.completed_task_count} completed`];
  if (typeof agent.average_score === "number") parts.push(`avg ${agent.average_score.toFixed(1)}`);
  return parts.join(" | ");
}

function roleTone(role: string): string {
  switch (role) {
    case "manager": return "border-info/30 bg-info-dim text-info";
    case "evaluator": return "border-purple-400/30 bg-purple-400/10 text-purple-300";
    default: return "border-signal/30 bg-signal-dim text-signal";
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
    () => listProjects({ actorId: actor.actorId }), [actor.actorId],
    { enabled: actor.ready, intervalMs: 30_000 }
  );

  useEffect(() => {
    const first = projectsQuery.data?.items[0]?.id;
    if (!selectedProjectId && first) setSelectedProjectId(first);
  }, [projectsQuery.data?.items, selectedProjectId]);

  const stream = useResilientEventStream({
    enabled: actor.ready && Boolean(selectedProjectId),
    connect: () => openProjectEventStream(selectedProjectId, actor.actorId || "owner-dev"),
    onEvent: (event) => {
      if (!event.data) return;
      try { const parsed = JSON.parse(event.data) as { type?: string }; if (parsed.type === "heartbeat") return; } catch { /* */ }
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
    if (!selectedTaskId && firstTask) { setSelectedTaskId(firstTask); return; }
    if (selectedTaskId && !(tasksQuery.data?.items ?? []).some((task) => task.id === selectedTaskId)) setSelectedTaskId(firstTask ?? "");
  }, [selectedTaskId, tasksQuery.data?.items]);

  const timelineQuery = usePollingQuery(
    () => getTaskTimeline({ actorId: actor.actorId }, selectedTaskId),
    [actor.actorId, selectedTaskId],
    { enabled: actor.ready && Boolean(selectedTaskId), intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
  );

  useEffect(() => {
    if (!streamPulse) return;
    void staffingQuery.refresh(); void tasksQuery.refresh(); void worklogsQuery.refresh(); void evaluationsQuery.refresh();
    if (selectedTaskId) void timelineQuery.refresh();
  }, [evaluationsQuery, selectedTaskId, staffingQuery, streamPulse, tasksQuery, timelineQuery, worklogsQuery]);

  const selectedTask = useMemo(
    () => (tasksQuery.data?.items ?? []).find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasksQuery.data?.items]
  );

  const rosterAgents = useMemo(() => {
    const summary = staffingQuery.data;
    if (!summary) return [] as ProjectStaffingAgent[];
    const items = [...(summary.manager ? [summary.manager] : []), ...summary.workers, ...summary.evaluators, ...summary.other_agents];
    const unique = new Map<string, ProjectStaffingAgent>();
    for (const agent of items) unique.set(agent.id, agent);
    return Array.from(unique.values());
  }, [staffingQuery.data]);

  useEffect(() => {
    if (!selectedManagerId) {
      const firstManager = rosterAgents.find((agent) => agent.role === "manager");
      if (firstManager) setSelectedManagerId(firstManager.id);
    }
  }, [rosterAgents, selectedManagerId]);

  const disabledReasonForLog = useMemo(() => {
    if (!selectedProjectId) return "Select a project before writing logs.";
    if (!tasksQuery.data?.items.length) return "Create or load a task before writing logs.";
    if (!rosterAgents.length) return "Attach at least one agent first.";
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
      staffingQuery.refresh(), tasksQuery.refresh(), worklogsQuery.refresh(), evaluationsQuery.refresh(),
      selectedTaskId ? timelineQuery.refresh() : Promise.resolve()
    ]);
  };

  const setFeedback = (message: string) => { setActionError(null); setActionMessage(message); };

  const handleAction = async (runner: () => Promise<void>, success: string) => {
    setActionError(null); setActionMessage(null);
    try { await runner(); await refreshAll(); setFeedback(success); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Action failed"); }
  };

  const selectedTaskMemory = (timelineQuery.data?.memory ?? []) as Array<Record<string, unknown>>;
  const selectedTaskWorklogs = (timelineQuery.data?.worklogs ?? []) as Array<Record<string, unknown>>;

  const [activeTab, setActiveTab] = useState<"task" | "policy" | "evals" | "thread">("task");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Panel */}
      <section className="surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tertiary">Mission Control</p>
            <h3 className="mt-1 font-display text-3xl font-bold text-ink tracking-tight">Agent Operations Surface</h3>
            <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
              Staff your project cluster, monitor agent lifecycles, and capture durable execution logs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Active Project</label>
              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}
                className="min-w-[200px] rounded-xl border border-edge bg-canvas-base px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-signal/50 focus:ring-2 focus:ring-signal/5">
                <option value="">Select project</option>
                {(projectsQuery.data?.items ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Connectivity</label>
              <div className={["flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
                stream.status === "connected" ? "border-ok/20 bg-ok-dim text-ok" : "border-warn/20 bg-warn-dim text-warn"
              ].join(" ")}>
                <span className={`live-dot ${stream.status !== "connected" ? "live-dot-warn" : ""}`} />
                {stream.status}
              </div>
            </div>
            <button type="button" onClick={() => void refreshAll()}
              className="mt-5 rounded-xl border border-edge bg-canvas-base p-2.5 text-ink-secondary transition hover:bg-slate-50 hover:text-ink">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24" />
                <path d="M21 3v9h-9" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-4 border-t border-edge pt-4">
          <QueryState isLoading={staffingQuery.isLoading} error={staffingQuery.error} lastUpdatedAt={staffingQuery.lastUpdatedAt} />
        </div>
      </section>

      {/* Primary Grid */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr_360px]">
        {/* Left Column — Project Roster */}
        <aside className="space-y-6">
          <div className="surface h-fit p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Project Roster</p>
              <span className="rounded-full border border-edge bg-slate-50 px-2.5 py-1 font-mono text-[10px] text-ink-secondary">
                {staffingQuery.data?.counters.total_agents ?? 0} Total
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {/* Status Pills */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-signal/10 bg-signal-dim p-3">
                  <p className="font-mono text-[9px] uppercase text-signal">Active</p>
                  <p className="mt-1 text-lg font-bold text-ink">{staffingQuery.data?.counters.active_agents ?? 0}</p>
                </div>
                <div className="rounded-xl border border-danger/10 bg-danger-dim p-3">
                  <p className="font-mono text-[9px] uppercase text-danger">Blocked</p>
                  <p className="mt-1 text-lg font-bold text-ink">{staffingQuery.data?.counters.blocked_tasks ?? 0}</p>
                </div>
              </div>

              {/* Manager slot */}
              <div className="surface-inset rounded-2xl p-4 ring-1 ring-slate-100">
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-tertiary">Mission Manager</p>
                <p className="mt-1.5 font-display text-base font-bold text-ink">
                  {staffingQuery.data?.manager?.name ?? "Vacant"}
                </p>
                {staffingQuery.data?.manager ? (
                  <p className="mt-2 text-[11px] font-medium text-ink-secondary opacity-70">
                    {contributionLabel(staffingQuery.data.manager)}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <select value={selectedManagerId} onChange={(event) => setSelectedManagerId(event.target.value)}
                      className="w-full rounded-lg border border-edge bg-canvas-base px-2.5 py-2 text-xs text-ink outline-none focus:border-signal/50">
                      <option value="">Choose manager...</option>
                      {rosterAgents.filter((a) => a.role === "manager").map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button type="button" disabled={!selectedManagerId}
                      onClick={() => void handleAction(() => assignProjectManager({ actorId: actor.actorId }, selectedProjectId, selectedManagerId).then(() => undefined), "Manager assigned.")}
                      className="w-full rounded-lg bg-info px-3 py-2 text-xs font-semibold text-white transition hover:bg-info/90 disabled:opacity-40">
                      Assign Role
                    </button>
                  </div>
                )}
              </div>

              {/* Agent Categories */}
              {[
                { title: "Active Workers", items: staffingQuery.data?.workers ?? [], accent: "signal" },
                { title: "Evaluators", items: staffingQuery.data?.evaluators ?? [], accent: "warn" }
              ].map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">{group.title}</p>
                  {group.items.length ? group.items.map((agent) => (
                    <div key={agent.id} className="surface-inset rounded-xl p-3 text-[13px] ring-1 ring-slate-100/50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{agent.name}</span>
                        <span className={["rounded-full px-2 py-0.5 font-mono text-[9px] font-medium", roleTone(agent.role)].join(" ")}>
                          {agent.role}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        <select value={agent.status}
                          onChange={(event) => void handleAction(() => updateAgentStatus({ actorId: actor.actorId }, agent.id, event.target.value as "active" | "inactive" | "paused").then(() => undefined), `${agent.name} status updated.`)}
                          className="min-w-0 flex-1 rounded-lg border border-edge bg-canvas-base px-2 py-1.5 font-mono text-[10px] font-medium text-ink outline-none focus:border-signal/50">
                          <option value="active">ACTIVE</option>
                          <option value="paused">PAUSED</option>
                          <option value="inactive">OFFLINE</option>
                        </select>
                        <button type="button"
                          onClick={() => void handleAction(() => detachAgentFromProject({ actorId: actor.actorId }, selectedProjectId, agent.id).then(() => undefined), `${agent.name} detached.`)}
                          className="rounded-lg border border-edge bg-canvas-base p-1.5 text-danger transition hover:bg-danger-dim">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-edge bg-slate-50/50 p-4 text-center">
                      <p className="font-mono text-[9px] text-ink-tertiary italic">No {group.title.toLowerCase()} attached</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column — Main Operations */}
        <main className="space-y-6">
          {/* Interaction Control Surface */}
          <section className="surface p-6">
            <div className="flex items-center justify-between border-b border-edge pb-4">
              <h4 className="font-display text-lg font-bold text-ink">Control Surface</h4>
              <div className="flex gap-2">
                {actionError && <span className="rounded-lg bg-danger-dim px-3 py-1 text-xs font-semibold text-danger">{actionError}</span>}
                {actionMessage && <span className="rounded-lg bg-ok-dim px-3 py-1 text-xs font-semibold text-ok">{actionMessage}</span>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Form 1: New Agent */}
              <div className="space-y-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Materialize New Agent</p>
                <div className="space-y-3">
                  <div className="group relative">
                    <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Identifier (e.g. QA-Worker-01)"
                      className="w-full rounded-xl border border-edge bg-canvas-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-signal/50 focus:bg-canvas-base" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={createRole} onChange={(event) => setCreateRole(event.target.value as "manager" | "worker" | "evaluator")}
                      className="rounded-xl border border-edge bg-canvas-surface px-3 py-2.5 text-xs font-medium text-ink outline-none transition focus:border-signal/50">
                      <option value="worker">Role: Worker</option>
                      <option value="manager">Role: Manager</option>
                      <option value="evaluator">Role: Evaluator</option>
                    </select>
                    <select value={createType} onChange={(event) => setCreateType(event.target.value as "project_side" | "platform_side")}
                      className="rounded-xl border border-edge bg-canvas-surface px-3 py-2.5 text-xs font-medium text-ink outline-none transition focus:border-signal/50">
                      <option value="project_side">Context: Project</option>
                      <option value="platform_side">Context: Global</option>
                    </select>
                  </div>
                  <input value={createCapabilities} onChange={(event) => setCreateCapabilities(event.target.value)} placeholder="Capabilities (comma separated)"
                    className="w-full rounded-xl border border-edge bg-canvas-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-signal/50" />
                  <button type="button" disabled={!selectedProjectId || !createName.trim()}
                    onClick={() => void handleAction(() => createProjectAgent({ actorId: actor.actorId }, selectedProjectId, {
                      name: createName.trim(), role: createRole, type: createType,
                      capabilities: createCapabilities.split(",").map((i) => i.trim()).filter(Boolean), status: createStatus
                    }).then(() => { setCreateName(""); setCreateCapabilities(""); if (createRole === "manager") setSelectedManagerId(""); }), `${createName.trim()} created.`)}
                    className="w-full rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white shadow-depth transition hover:bg-signal/90 hover:shadow-glow disabled:opacity-30">
                    Deploy Agent instance
                  </button>
                </div>
              </div>

              {/* Form 2: Attach Existing */}
              <div className="space-y-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Registry Attachment</p>
                <p className="text-xs text-ink-secondary leading-relaxed">Attach an unassigned agent from the cluster-wide registry to this project.</p>
                <div className="space-y-3">
                  <select value={selectedAttachAgentId} onChange={(event) => setSelectedAttachAgentId(event.target.value)}
                    className="w-full rounded-xl border border-edge bg-canvas-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-signal/50">
                    <option value="">Choose unattached agent...</option>
                    {(staffingQuery.data?.attachable_agents ?? []).map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} ({agent.role})</option>
                    ))}
                  </select>
                  <button type="button" disabled={!selectedProjectId || !selectedAttachAgentId}
                    onClick={() => void handleAction(() => attachAgentToProject({ actorId: actor.actorId }, selectedProjectId, selectedAttachAgentId).then(() => { setSelectedAttachAgentId(""); }), "Agent attached.")}
                    className="w-full rounded-xl border border-info bg-info px-4 py-3 text-sm font-bold text-white shadow-depth transition hover:bg-info/90 disabled:opacity-30">
                    Sync to Project
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Console / Worklog */}
          <section className="space-y-6">
            <div className="surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-5">
                <div>
                  <h4 className="font-display text-lg font-bold text-ink">Operational Console</h4>
                  <p className="text-xs text-ink-secondary mt-1">Direct intervention and manual override controls.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}
                    className="min-w-[240px] rounded-xl border border-edge bg-canvas-base px-4 py-2.5 text-sm font-medium text-ink outline-none focus:border-signal/50">
                    <option value="">Focus View: No Task Select</option>
                    {(tasksQuery.data?.items ?? []).map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                  <button type="button" disabled={!selectedTask || !selectedTask.assigned_to}
                    onClick={() => selectedTask ? void handleAction(() => requestEvaluation({ actorId: actor.actorId }, {
                      project_id: selectedTask.project_id, task_id: selectedTask.id,
                      agent_id: selectedTask.assigned_to ?? actor.actorId, requested_by: actor.actorId
                    }).then(() => undefined), "Evaluation requested.") : undefined}
                    className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-bold text-purple-600 transition hover:bg-purple-100 disabled:opacity-40">
                    Audit
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <WorklogComposer
                  title="Capture Agent Worklog"
                  tasks={(tasksQuery.data?.items ?? []) as TaskContract[]}
                  agents={rosterAgents}
                  initialTaskId={selectedTaskId}
                  initialAgentId={selectedTask?.assigned_to ?? rosterAgents[0]?.id}
                  disabledReason={disabledReasonForLog}
                  submitLabel="Commit to Chain"
                  onSubmit={async (payload) => { await appendWorklog({ actorId: actor.actorId }, payload); await Promise.all([worklogsQuery.refresh(), timelineQuery.refresh()]); }}
                />
              </div>
            </div>

            {/* Quick Activity Strip */}
            <div className="surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary mb-4">Real-time Activity Stream</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(worklogsQuery.data?.items ?? []).slice(0, 6).map((entry: WorklogEntry) => (
                  <button key={entry.id} type="button" onClick={() => setSelectedTaskId(entry.task_id)}
                    className="flex flex-col gap-2 rounded-xl border border-edge-muted bg-slate-50/50 p-4 font-body text-left transition hover:border-signal/30 hover:bg-white hover:shadow-depth">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-signal uppercase">{entry.action_type}</span>
                      <span className="font-mono text-[9px] text-ink-ghost">{formatDate(entry.timestamp).split(",")[1]}</span>
                    </div>
                    <p className="text-sm font-bold text-ink line-clamp-1">{entry.summary}</p>
                    <p className="text-[10px] text-ink-secondary font-medium truncate">{entry.agent_name} » {entry.task_title}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* Right Column — Tabbed Context Rail */}
        <aside className="space-y-6">
          <div className="surface h-fit overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-edge">
              {[
                { id: "task", label: "Context", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> },
                { id: "policy", label: "Guard", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912.135A10 10 0 0 0 1.5 12.5V13a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.5a5 5 0 0 1 4.544-4.972L12 7.5l2.044.028A5 5 0 0 1 18.5 12.5V13a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.5a10 10 0 0 0-8.588-12.365z" /><circle cx="12" cy="18" r="3" /></svg> },
                { id: "evals", label: "Audit", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
                { id: "thread", label: "Logs", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={["flex-1 flex flex-col items-center gap-1.5 py-4 text-[10px] font-bold transition-all",
                    activeTab === tab.id ? "bg-signal-dim text-signal shadow-[inset_0_-2px_0_#00b58e]" : "text-ink-ghost hover:bg-slate-50 hover:text-ink"
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 min-h-[500px]">
              {activeTab === "task" && (
                <div className="space-y-6 animate-fade-up">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Active Focus</p>
                    <div className="surface-inset rounded-2xl p-4 ring-1 ring-slate-100">
                      <h5 className="text-base font-bold text-ink leading-tight">{selectedTask?.title ?? "No Selection"}</h5>
                      <p className="mt-2 text-xs text-ink-secondary leading-relaxed">{selectedTask?.description ?? "Focus on a task to view its material context here."}</p>
                      {selectedTask && (
                        <div className="mt-5 grid grid-cols-2 gap-2 font-mono text-[9px] font-bold">
                          <div className="rounded-lg bg-slate-100 p-2 text-ink-ghost uppercase">{TASK_STATUS_LABELS[selectedTask.status]}</div>
                          <div className="rounded-lg bg-slate-100 p-2 text-ink-ghost uppercase">{selectedTask.priority} PRIORITY</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Memory Snapshot</p>
                    {selectedTaskMemory.length ? (
                      <div className="space-y-2">
                        {selectedTaskMemory.slice(0, 3).map((memory, index) => (
                          <div key={String(memory.id ?? index)} className="surface-inset rounded-xl p-3 border-l-2 border-signal shadow-sm">
                            <p className="text-xs font-bold text-ink">{String(memory.title ?? "Untitled Intelligence")}</p>
                            <p className="mt-1 text-[11px] text-ink-secondary line-clamp-2">{String(memory.content ?? "")}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[11px] text-ink-ghost italic px-1">Memory cache is clear.</p>}
                  </div>
                </div>
              )}

              {activeTab === "policy" && (
                <div className="space-y-6 animate-fade-up">
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Protocol Guardrails</p>
                    {guardrails.map((rule) => (
                      <div key={rule} className="flex gap-3 rounded-xl border border-edge-muted bg-slate-50/50 p-3 items-start">
                        <svg className="h-4 w-4 text-signal shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                        <span className="text-[11px] leading-tight text-ink-secondary font-medium">{rule}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-4 border-t border-edge">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Operational Readiness</p>
                    {[
                      { label: "Logging Pipeline", status: disabledReasonForLog ? "Error" : "Nominal", ok: !disabledReasonForLog },
                      { label: "Manager Authority", status: staffingQuery.data?.manager ? "Verified" : "Missing", ok: !!staffingQuery.data?.manager }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium">
                        <span className="text-ink-ghost">{item.label}</span>
                        <span className={item.ok ? "text-ok" : "text-danger"}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "evals" && (
                <div className="space-y-4 animate-fade-up">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Audit History</p>
                  {(timelineQuery.data?.evaluations ?? evaluationsQuery.data?.items ?? []).slice(0, 6).map((evaluation) => (
                    <div key={evaluation.id} className="surface-inset rounded-2xl p-4 ring-1 ring-slate-100 shadow-sm transition hover:shadow-depth">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-signal">Q-SCORE: {evaluation.score_quality}/10</span>
                        <span className="font-mono text-[9px] text-ink-ghost uppercase">{formatDate(evaluation.timestamp).split(',')[0]}</span>
                      </div>
                      <p className="mt-2 text-[13px] font-bold text-ink">Evaluator @{evaluation.evaluator_agent_id.split('-').pop()}</p>
                      <p className="mt-1 text-[11px] text-ink-secondary italic truncate">Artifact integrity looks nominal...</p>
                    </div>
                  ))}
                  {!(timelineQuery.data?.evaluations ?? evaluationsQuery.data?.items ?? []).length && (
                    <div className="py-12 text-center">
                      <p className="font-mono text-[10px] text-ink-ghost">Awaiting first audit cycle...</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "thread" && (
                <div className="space-y-3 animate-fade-up">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Task Event Chain</p>
                  {selectedTaskWorklogs.length ? (
                    <div className="relative space-y-3 pl-3">
                      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-edge" />
                      {selectedTaskWorklogs.slice(0, 8).map((entry, index) => (
                        <div key={String(entry.id ?? index)} className="relative pl-6">
                          <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-signal shadow-sm" />
                          <p className="text-[12px] font-bold text-ink leading-tight">{String(entry.summary ?? "System Event")}</p>
                          <p className="mt-1 font-mono text-[9px] text-ink-ghost uppercase tracking-wider">{String(entry.action_type ?? "info")} • {formatDate(String(entry.timestamp ?? "")).split(',')[1]}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[11px] text-ink-ghost italic px-1 pt-4 text-center">No events captured for this chain.</p>}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
