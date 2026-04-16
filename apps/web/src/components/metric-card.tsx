type MetricCardProps = {
  label: string;
  value: string | number;
  tone?: "neutral" | "teal" | "amber" | "rose";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-white text-ink shadow-sm hover:shadow-md",
  teal: "border-signal/20 bg-signal-dim text-signal shadow-sm hover:shadow-md ring-1 ring-signal/5",
  amber: "border-warn/20 bg-warn-dim text-warn shadow-sm hover:shadow-md ring-1 ring-warn/5",
  rose: "border-danger/20 bg-danger-dim text-danger shadow-sm hover:shadow-md ring-1 ring-danger/5"
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <article className={`rounded-2xl border px-4 py-3 transition-all duration-300 ${toneClasses[tone]}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
    </article>
  );
}
