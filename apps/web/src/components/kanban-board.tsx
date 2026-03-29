import { KANBAN_STATUSES } from "@/lib/constants";

export function KanbanBoard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-ink">Task Workflow</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KANBAN_STATUSES.map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-mist/70 p-3">
            <p className="text-sm font-medium text-slate-700">{status}</p>
            <p className="mt-2 text-xs text-slate-500">0 tasks</p>
          </div>
        ))}
      </div>
    </section>
  );
}

