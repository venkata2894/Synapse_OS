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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Structured Logging</p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">{title}</h4>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[11px] text-slate-700"
        >
          {showDetails ? "Hide detail" : "Add detail"}
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <select
          value={taskId}
          onChange={(event) => setTaskId(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
        >
          <option value="">Select task</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>

        <select
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
        >
          <option value="">Select agent</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.role})
            </option>
          ))}
        </select>

        <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
          <select
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Short, useful summary"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
          />
        </div>

        {showDetails ? (
          <>
            <textarea
              value={detailedLog}
              onChange={(event) => setDetailedLog(event.target.value)}
              placeholder="Optional detail for humans, evaluators, and future agents"
              className="soft-scroll min-h-24 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none ring-teal-400/50 focus:ring-2"
            />
            <input
              value={artifactsText}
              onChange={(event) => setArtifactsText(event.target.value)}
              placeholder="Artifacts, comma separated"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            />
            <label className="text-xs text-slate-600">
              Confidence: {(confidence * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                className="mt-2 w-full accent-teal-600"
              />
            </label>
          </>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <p>
            Task: <span className="font-medium text-slate-800">{activeTask?.title ?? "Not selected"}</span>
          </p>
          <p className="mt-0.5">
            Agent: <span className="font-medium text-slate-800">{activeAgent?.name ?? "Not selected"}</span>
          </p>
        </div>

        {disabledReason ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{disabledReason}</p>
        ) : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        {successMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{successMessage}</p>
        ) : null}

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
          className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
