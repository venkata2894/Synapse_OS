"use client";

type AgentKeyPanelProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export function AgentKeyPanel({ value, onChange, compact = false }: AgentKeyPanelProps) {
  return (
    <section className={`rounded-2xl border border-slate-300/20 bg-slate-700/20 ${compact ? "p-3" : "p-4"}`}>
      <div className={`flex ${compact ? "flex-col gap-2" : "flex-col gap-3 md:flex-row md:items-end md:justify-between"}`}>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Agent API Key</p>
          <p className="mt-1 text-xs text-slate-300/90">
            Stored in session only. Required for tool execution and task context retrieval.
          </p>
        </div>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="soa_dev_agent_key"
        className="mt-3 w-full rounded-xl border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none ring-teal-400/50 placeholder:text-slate-400 focus:ring-2"
      />
    </section>
  );
}

