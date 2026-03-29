import Link from "next/link";

import { AlertPanel } from "@/components/alert-panel";
import { KanbanBoard } from "@/components/kanban-board";

const cards = [
  { label: "Active Projects", value: "1" },
  { label: "Tasks in Progress", value: "0" },
  { label: "Blocked Tasks", value: "0" },
  { label: "Recent Handovers", value: "0" }
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <Link className="rounded-lg bg-ink px-4 py-2 text-white" href="/projects">
          Project Detail
        </Link>
        <Link className="rounded-lg bg-white px-4 py-2 text-ink ring-1 ring-slate-300" href="/agents">
          Agent Profiles
        </Link>
        <Link className="rounded-lg bg-white px-4 py-2 text-ink ring-1 ring-slate-300" href="/evaluations">
          Evaluation Summaries
        </Link>
      </section>

      <KanbanBoard />
      <AlertPanel />
    </div>
  );
}

