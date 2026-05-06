"use client";

import type { ToolRunRecord } from "@sentientops/contracts";
import { Clipboard, Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentKeyPanel } from "@/components/agent-key-panel";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardSubtitle, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAgentKey } from "@/hooks/use-agent-key";
import { callAgentTool, getAgentToolManifest } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

type PresetId =
  | "create_project"
  | "create_task"
  | "transition_task"
  | "request_evaluation"
  | "register_agent"
  | "append_worklog"
  | "fetch_task_context";

const PRESET_LABELS: Record<PresetId, string> = {
  create_project: "Create Project",
  create_task: "Create Task",
  transition_task: "Transition Task",
  request_evaluation: "Request Evaluation",
  register_agent: "Register Agent",
  append_worklog: "Append Worklog",
  fetch_task_context: "Fetch Task Context"
};

export default function ToolConsolePage() {
  const { agentKey, saveAgentKey, isLoaded } = useAgentKey();
  const [manifest, setManifest] = useState<{ name: string; description: string }[]>([]);
  const [toolName, setToolName] = useState("");
  const [payloadText, setPayloadText] = useState("{\n  \n}");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<ToolRunRecord[]>([]);
  const [latestResponse, setLatestResponse] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  const [presetId, setPresetId] = useState<PresetId>("create_project");
  const [presetFields, setPresetFields] = useState<Record<string, string>>({
    name: "Project Atlas",
    description: "Agent-run project",
    objective: "Ship production flow",
    owner: "owner-1",
    project_id: "",
    title: "Implement board transitions",
    task_id: "",
    target_status: "in_progress",
    agent_id: "",
    requested_by: "owner-1",
    role: "worker",
    type: "project_side",
    capabilities: "frontend, tooling",
    summary: "Implemented a scoped update",
    action_type: "progress",
    detailed_log: "Updated task context and validated the interaction path."
  });

  const PRESET_FIELDS: Record<PresetId, string[]> = {
    create_project: ["name", "description", "objective", "owner"],
    create_task: ["project_id", "title", "owner"],
    transition_task: ["task_id", "target_status"],
    request_evaluation: ["project_id", "task_id", "agent_id", "requested_by"],
    register_agent: ["name", "role", "type", "project_id", "capabilities"],
    append_worklog: ["task_id", "agent_id", "action_type", "summary", "detailed_log"],
    fetch_task_context: ["task_id"]
  };

  const regenerateKey = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  // Ensure idempotency key is set (covers SSR / older envs that didn't set initial state)
  useEffect(() => {
    if (!idempotencyKey) regenerateKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !agentKey.trim()) return;
    let cancelled = false;
    setIsLoadingManifest(true);
    setError(null);
    void getAgentToolManifest(agentKey.trim())
      .then((response) => {
        if (cancelled) return;
        setManifest(response.tools);
        setToolName((current) => current || response.tools[0]?.name || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tools");
      })
      .finally(() => { if (!cancelled) setIsLoadingManifest(false); });
    return () => { cancelled = true; };
  }, [agentKey, isLoaded]);

  const presetPayload = useMemo(() => {
    switch (presetId) {
      case "create_project":
        return { name: presetFields.name || "Project Atlas", description: presetFields.description || "Agent-run project", objective: presetFields.objective || "Ship production flow", owner: presetFields.owner || "owner-1", status: "active", tags: ["v1", "agent-first"] };
      case "create_task":
        return { project_id: presetFields.project_id, title: presetFields.title || "Implement board transitions", description: "Task created from guided preset.", created_by: presetFields.owner || "owner-1", priority: "high", status: "ready", dependencies: [], acceptance_criteria: "Task transitions are valid", context_refs: [], parent_task_depth: 0 };
      case "transition_task":
        return { task_id: presetFields.task_id, target_status: presetFields.target_status || "in_progress", metadata: {} };
      case "request_evaluation":
        return { project_id: presetFields.project_id, task_id: presetFields.task_id, agent_id: presetFields.agent_id || "agent-worker-lex", requested_by: presetFields.requested_by || "owner-1" };
      case "register_agent":
        return { name: presetFields.name || "Worker Delta", role: presetFields.role || "worker", type: presetFields.type || "project_side", project_id: presetFields.project_id || null, capabilities: (presetFields.capabilities || "frontend, tooling").split(",").map((item) => item.trim()).filter(Boolean), status: "active" };
      case "append_worklog":
        return { task_id: presetFields.task_id, agent_id: presetFields.agent_id || "agent-worker-lex", action_type: presetFields.action_type || "progress", summary: presetFields.summary || "Implemented a scoped update", detailed_log: presetFields.detailed_log || "Updated task context and validated the interaction path.", artifacts: [], confidence: 0.82 };
      case "fetch_task_context":
        return { task_id: presetFields.task_id };
      default:
        return {};
    }
  }, [presetId, presetFields]);

  const runTool = async () => {
    if (!toolName) return;
    if (!agentKey.trim()) { setError("Agent API key is required."); return; }
    setError(null);
    setIsRunning(true);
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      const response = await callAgentTool(agentKey.trim(), toolName, payload, idempotencyKey.trim() || undefined);
      const record: ToolRunRecord = { id: crypto.randomUUID(), tool: toolName, payload, response: response as Record<string, unknown>, timestamp: new Date().toISOString(), success: true };
      setHistory((previous) => [record, ...previous].slice(0, 20));
      setLatestResponse(response);
      regenerateKey();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool call failed";
      setError(message);
      const record: ToolRunRecord = { id: crypto.randomUUID(), tool: toolName, payload: {}, response: { error: message }, timestamp: new Date().toISOString(), success: false };
      setHistory((previous) => [record, ...previous].slice(0, 20));
      setLatestResponse({ error: message });
    } finally { setIsRunning(false); }
  };

  const copyResponse = async () => {
    if (latestResponse === null || latestResponse === undefined) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(latestResponse, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available — silently ignore
    }
  };

  return (
    <section className="space-y-4">
      <AgentKeyPanel value={agentKey} onChange={saveAgentKey} />

      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Agent Tool Runner</CardSubtitle>
            <CardTitle className="mt-1 text-xl">Guided Presets + Raw JSON</CardTitle>
          </div>
          <p className="font-mono text-[10px] text-ink-ghost">
            {isLoadingManifest ? "Loading manifest..." : `${manifest.length} tools`}
          </p>
        </CardHeader>

        {error ? (
          <p className="mb-3 rounded-lg border border-danger/20 bg-danger-dim px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          {/* Left column — preset + controls */}
          <div className="space-y-3">
            <div className="surface-inset rounded-xl p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">Guided Preset</p>
              <select value={presetId} onChange={(event) => setPresetId(event.target.value as PresetId)}
                className="mt-2 w-full rounded-lg border border-edge bg-canvas-base px-3 py-2 text-sm text-ink outline-none focus:border-signal/50">
                {Object.entries(PRESET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <div className="mt-2 space-y-2">
                {PRESET_FIELDS[presetId].map((field) => (
                  <Input key={field} value={presetFields[field] ?? ""} placeholder={field}
                    onChange={(event) => setPresetFields((previous) => ({ ...previous, [field]: event.target.value }))}
                    className="h-9 font-mono text-xs" />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => { setToolName(presetId); setPayloadText(JSON.stringify(presetPayload, null, 2)); }}
                className="mt-3 w-full">
                Apply Preset to Payload
              </Button>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">Tool</label>
              <select value={toolName} onChange={(event) => setToolName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-edge bg-canvas-base px-3 py-2 text-sm text-ink outline-none focus:border-signal/50">
                {manifest.map((tool) => (
                  <option key={tool.name} value={tool.name}>{tool.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">Idempotency Key</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={idempotencyKey}
                  onChange={(event) => setIdempotencyKey(event.target.value)}
                  placeholder="auto-generated UUID"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={regenerateKey}
                  aria-label="Regenerate idempotency key"
                  title="Regenerate key"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button type="button" variant="primary" onClick={() => void runTool()} disabled={isRunning || !toolName}
              className="w-full">
              {isRunning ? "Running..." : "Run Tool"}
            </Button>
          </div>

          {/* Right column — JSON editor */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">Payload JSON</label>
            <Textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)}
              className="soft-scroll mt-1 h-72 font-mono text-xs" />
          </div>
        </div>
      </Card>

      {/* Latest response panel */}
      {latestResponse !== null ? (
        <Card>
          <CardHeader>
            <div>
              <CardSubtitle>Latest Response</CardSubtitle>
              <CardTitle className="mt-1 text-lg">Tool Call Result</CardTitle>
            </div>
          </CardHeader>
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void copyResponse()}
              aria-label="Copy response JSON"
              title={copied ? "Copied!" : "Copy JSON"}
              className="absolute right-2 top-2 z-10"
            >
              {copied ? <Check className="h-4 w-4 text-signal" /> : <Clipboard className="h-4 w-4" />}
            </Button>
            {copied ? (
              <span className="absolute right-12 top-3 z-10 rounded-md bg-canvas-raised px-2 py-1 font-mono text-[10px] text-signal">
                Copied!
              </span>
            ) : null}
            <pre className="surface-inset soft-scroll max-h-96 overflow-auto rounded-xl p-4 font-mono text-xs whitespace-pre-wrap text-ink-secondary">
              {JSON.stringify(latestResponse, null, 2)}
            </pre>
          </div>
        </Card>
      ) : null}

      {/* Run history */}
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Activity</CardSubtitle>
            <CardTitle className="mt-1 text-lg">Run History</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="surface-inset rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-medium text-ink">{entry.tool}</p>
                <p className="font-mono text-[10px] text-ink-ghost">{shortDate(entry.timestamp)}</p>
              </div>
              <p className={`mt-1 font-mono text-[11px] ${entry.success ? "text-signal" : "text-danger"}`}>
                {entry.success ? "Success" : "Failed"}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-[10px] text-ink-tertiary hover:text-ink-secondary">Payload</summary>
                <pre className="soft-scroll mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-ink-ghost">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </details>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-[10px] text-ink-tertiary hover:text-ink-secondary">Response</summary>
                <pre className="soft-scroll mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-ink-ghost">
                  {JSON.stringify(entry.response, null, 2)}
                </pre>
              </details>
            </div>
          ))}
          {!history.length ? <p className="text-sm text-ink-tertiary">No tool runs yet.</p> : null}
        </div>
      </Card>
    </section>
  );
}
