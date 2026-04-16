"use client";

type AgentKeyPanelProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export function AgentKeyPanel({ value, onChange, compact = false }: AgentKeyPanelProps) {
  return (
    <section className={`surface ${compact ? "p-3" : "p-4"}`}>
      <div className={`flex ${compact ? "flex-col gap-2" : "flex-col gap-3 md:flex-row md:items-end md:justify-between"}`}>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Agent API Key</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Stored in session only. Required for tool execution and task context retrieval.
          </p>
        </div>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="soa_dev_agent_key"
        className="mt-3 w-full rounded-xl border border-edge bg-canvas-base px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-ghost focus:border-signal/50 focus:shadow-glow"
      />
    </section>
  );
}
