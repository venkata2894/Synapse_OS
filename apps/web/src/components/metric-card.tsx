type MetricCardProps = {
  label: string;
  value: string | number;
  tone?: "neutral" | "teal" | "amber" | "rose";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "border-slate-300/20 bg-slate-600/10 text-slate-100",
  teal: "border-teal-300/35 bg-teal-500/10 text-teal-100",
  amber: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  rose: "border-rose-300/35 bg-rose-500/10 text-rose-100"
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <article className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}

