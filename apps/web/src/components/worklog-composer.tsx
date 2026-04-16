"use client";

import type { AgentContract, TaskContract } from "@sentientops/contracts";
import { useEffect, useMemo, useState } from "react";

const ACTION_OPTIONS = [
  "start",
  "progress",
  "decision",
  "issue",
  "output",
  "handover",
  "completion",
  "correction"
] as const;

const LAST_ACTION_KEY = "sentientops:last-worklog-action";

type WorklogComposerProps = {
  title?: string;
  tasks: TaskContract[];
  agents: Pick<AgentContract, "id" | "name" | "role" | "status">[];
  initialTaskId?: string;
  initialAgentId?: string;
  disabledReason?: string | null;
  submitLabel?: string;
  onSubmit: (payload: {
    task_id: string;
    agent_id: string;
    action_type: string;
    summary: string;
    detailed_log: string;
    artifacts: string[];
    confidence: number;
  }) => Promise<void>;
};

export function WorklogComposer({
  title = "Quick Log",
  tasks,
  agents,
  initialTaskId,
  initialAgentId,
  disabledReason,
  submitLabel = "Log Work",
  onSubmit
}: WorklogComposerProps) {
  const [taskId, setTaskId] = useState(initialTaskId ?? "");
  const [agentId, setAgentId] = useState(initialAgentId ?? "");
  const [actionType, setActionType] = useState("progress");
  const [summary, setSummary] = useState("");
  const [detailedLog, setDetailedLog] = useState("");
  const [artifactsText, setArtifactsText] = useState("");
  const [confidence, setConfidence] = useState(0.8);
  const [showDetails, setShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.sessionStorage.getItem(LAST_ACTION_KEY);
    if (last && ACTION_OPTIONS.includes(last as (typeof ACTION_OPTIONS)[number])) {
      setActionType(last);
    }
  }, []);

  useEffect(() => {
    if (initialTaskId && tasks.some((task) => task.id === initialTaskId)) {
      setTaskId(initialTaskId);
    }
  }, [initialTaskId, tasks]);

  useEffect(() => {
    if (initialAgentId && agents.some((agent) => agent.id === initialAgentId)) {
      setAgentId(initialAgentId);
    }
  }, [agents, initialAgentId]);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === taskId) ?? null,
    [taskId, tasks]
  );

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? null,
    [agentId, agents]
  );

  const resetForm = () => {
    setSummary("");
    setDetailedLog("");
    setArtifactsText("");
    setSuccessMessage("Worklog captured.");
  };

  return (
    <div className="surface-inset rounded-2xl p-5 ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3 border-b border-edge/50 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Structured Logging</p>
          <h4 className="mt-1 text-base font-bold text-ink">{title}</h4>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="rounded-full border border-edge bg-canvas-base px-3 py-1.5 text-[11px] font-bold text-ink-secondary transition hover:border-signal/30 hover:text-signal"
        >
          {showDetails ? "− Hide detail" : "+ Add detail"}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Linked Task</label>
            <select
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              className="w-full rounded-xl border border-edge bg-canvas-base px-3 py-2.5 text-xs text-ink outline-none transition focus:border-signal/50 focus:ring-2 focus:ring-signal/5"
            >
              <option value="">Select task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Agent Actor</label>
            <select
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              className="w-full rounded-xl border border-edge bg-canvas-base px-3 py-2.5 text-xs text-ink outline-none transition focus:border-signal/50 focus:ring-2 focus:ring-signal/5"
            >
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Signal Type</label>
            <select
              value={actionType}
              onChange={(event) => setActionType(event.target.value)}
              className="w-full rounded-xl border border-edge bg-canvas-base px-3 py-2.5 text-xs font-bold text-signal outline-none transition focus:border-signal/50"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase().replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Observation Summary</label>
            <input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="What was observed or accomplished?"
              className="w-full rounded-xl border border-edge bg-canvas-base px-4 py-2.5 text-xs text-ink outline-none transition placeholder:text-ink-ghost focus:border-signal/50"
            />
          </div>
        </div>

        {showDetails ? (
          <div className="mt-2 space-y-4 animate-fade-up">
            <div className="space-y-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Detailed Analysis</label>
              <textarea
                value={detailedLog}
                onChange={(event) => setDetailedLog(event.target.value)}
                placeholder="Deep context for human auditors and future agents..."
                className="soft-scroll min-h-[120px] w-full rounded-xl border border-edge bg-canvas-base px-4 py-3 text-xs text-ink outline-none transition placeholder:text-ink-ghost focus:border-signal/50 focus:shadow-glow"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Artifact Registry</label>
                <input
                  value={artifactsText}
                  onChange={(event) => setArtifactsText(event.target.value)}
                  placeholder="URL paths, comma separated"
                  className="w-full rounded-xl border border-edge bg-canvas-base px-4 py-2.5 text-xs text-ink outline-none transition placeholder:text-ink-ghost focus:border-signal/50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">Confidence</label>
                  <span className="font-mono text-[10px] font-bold text-signal">{(confidence * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confidence}
                  onChange={(event) => setConfidence(Number(event.target.value))}
                  className="mt-2 w-full h-2 rounded-lg bg-slate-100 appearance-none cursor-pointer accent-signal"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex-1">
            {disabledReason ? (
              <p className="text-[11px] text-danger font-medium">⚠️ {disabledReason}</p>
            ) : error ? (
              <p className="text-[11px] text-danger font-medium">❌ {error}</p>
            ) : successMessage ? (
              <p className="text-[11px] text-ok font-medium">✅ {successMessage}</p>
            ) : (
              <p className="text-[11px] text-ink-ghost italic">Awaiting intervention...</p>
            )}
          </div>

          <button
            type="button"
            disabled={Boolean(disabledReason) || isSubmitting}
            onClick={async () => {
              if (!taskId || !agentId || !summary.trim()) {
                setError("Task, agent, and summary are required.");
                return;
              }
              setIsSubmitting(true);
              setError(null);
              setSuccessMessage(null);
              try {
                await onSubmit({
                  task_id: taskId,
                  agent_id: agentId,
                  action_type: actionType,
                  summary: summary.trim(),
                  detailed_log: detailedLog.trim(),
                  artifacts: artifactsText
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                  confidence
                });
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem(LAST_ACTION_KEY, actionType);
                }
                resetForm();
              } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Failed to append worklog.");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="rounded-xl bg-ink px-6 py-2.5 text-sm font-bold text-white shadow-depth transition hover:bg-ink-secondary hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {isSubmitting ? "Committing..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
