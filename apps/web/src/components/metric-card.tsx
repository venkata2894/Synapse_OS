type MetricCardProps = {
  label: string;
  value: string | number;
  tone?: "neutral" | "teal" | "amber" | "rose";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-white text-slate-900",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700"
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <article className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}
