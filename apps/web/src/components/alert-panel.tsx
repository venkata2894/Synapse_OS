import { DEMO_ALERTS } from "@/lib/constants";

export function AlertPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold text-ink">In-App Alerts</h2>
      <ul className="space-y-2">
        {DEMO_ALERTS.map((alert) => (
          <li
            key={alert.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {alert.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

