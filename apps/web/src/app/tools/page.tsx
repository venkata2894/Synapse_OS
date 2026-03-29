"use client";

import type { ToolRunRecord } from "@sentientops/contracts";
import { useEffect, useState } from "react";

import { AgentKeyPanel } from "@/components/agent-key-panel";
import { useAgentKey } from "@/hooks/use-agent-key";
import { callAgentTool, getAgentToolManifest } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

export default function ToolConsolePage() {
  const { agentKey, saveAgentKey, isLoaded } = useAgentKey();
  const [manifest, setManifest] = useState<{ name: string; description: string }[]>([]);
  const [toolName, setToolName] = useState("");
  const [payloadText, setPayloadText] = useState("{\n  \n}");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<ToolRunRecord[]>([]);

  useEffect(() => {
    if (!isLoaded || !agentKey.trim()) {
      return;
    }
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
        const message = err instanceof Error ? err.message : "Failed to load tools";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingManifest(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentKey, isLoaded]);

  const runTool = async () => {
    if (!toolName) return;
    if (!agentKey.trim()) {
      setError("Agent API key is required.");
      return;
    }
    setError(null);
    setIsRunning(true);
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      const response = await callAgentTool(
        agentKey.trim(),
        toolName,
        payload,
        idempotencyKey.trim() || undefined
      );
      const record: ToolRunRecord = {
        id: crypto.randomUUID(),
        tool: toolName,
        payload,
        response: response as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        success: true
      };
      setHistory((previous) => [record, ...previous].slice(0, 20));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool call failed";
      setError(message);
      const record: ToolRunRecord = {
        id: crypto.randomUUID(),
        tool: toolName,
        payload: {},
        response: { error: message },
        timestamp: new Date().toISOString(),
        success: false
      };
      setHistory((previous) => [record, ...previous].slice(0, 20));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="space-y-4">
      <AgentKeyPanel value={agentKey} onChange={saveAgentKey} />

      <article className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Agent Tool Runner</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-100">Invoke MCP/Tool-Compatible Backend Actions</h3>
          </div>
          <p className="text-xs text-slate-400">{isLoadingManifest ? "Loading manifest..." : `${manifest.length} tools`}</p>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Tool</label>
            <select
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
              className="w-full rounded-lg border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
            >
              {manifest.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Idempotency Key</label>
            <input
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              placeholder="optional-run-key"
              className="w-full rounded-lg border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
            />

            <button
              type="button"
              onClick={() => void runTool()}
              disabled={isRunning || !toolName}
              className="mt-2 w-full rounded-lg border border-teal-300/45 bg-teal-500/12 px-3 py-2 text-sm text-teal-100 disabled:opacity-55"
            >
              {isRunning ? "Running..." : "Run Tool"}
            </button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Payload JSON</label>
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              className="soft-scroll mt-2 h-56 w-full rounded-xl border border-slate-300/30 bg-slate-950/50 px-3 py-2 font-mono text-xs text-slate-100 outline-none ring-teal-400/50 focus:ring-2"
            />
          </div>
        </div>
      </article>

      <article className="panel p-4">
        <h4 className="text-lg font-semibold text-slate-100">Run History</h4>
        <div className="mt-3 space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-slate-300/20 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-100">{entry.tool}</p>
                <p className="text-xs text-slate-400">{shortDate(entry.timestamp)}</p>
              </div>
              <p className={`mt-1 text-xs ${entry.success ? "text-teal-200" : "text-rose-200"}`}>
                {entry.success ? "Success" : "Failed"}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-300">Payload</summary>
                <pre className="soft-scroll mt-1 max-h-40 overflow-auto text-xs text-slate-200">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </details>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-300">Response</summary>
                <pre className="soft-scroll mt-1 max-h-48 overflow-auto text-xs text-slate-200">
                  {JSON.stringify(entry.response, null, 2)}
                </pre>
              </details>
            </div>
          ))}
          {!history.length ? <p className="text-sm text-slate-400">No tool runs yet.</p> : null}
        </div>
      </article>
    </section>
  );
}
