"use client";

import type { DashboardSummary } from "@sentientops/contracts";
import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { getDashboardSummary } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

const emptySummary: DashboardSummary = {
  totals: {
    active_projects: 0,
    tasks_in_progress: 0,
    blocked_tasks: 0,
    recent_handovers: 0,
    low_score_alerts: 0
  },
  alerts: { blocked_tasks: [], low_scores: [] },
  projects: [],
  recent_handovers: [],
  recent_evaluations: []
};

export default function HomePage() {
  const actor = useActor();
  const query = usePollingQuery(
    () => getDashboardSummary({ actorId: actor.actorId, actorRole: actor.actorRole }),
    [actor.actorId],
    { enabled: actor.ready, initialData: emptySummary }
  );
  const summary = query.data ?? emptySummary;

  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Global Pulse</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Multi-Agent Operations Dashboard</h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/projects" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700">
              Project Details
            </Link>
            <Link href="/tasks" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700">
              Task Board
            </Link>
            <Link href="/tools" className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-teal-700">
              Open Tool Console
            </Link>
          </div>
        </div>
        <div className="mt-3">
          <QueryState isLoading={query.isLoading} error={query.error} lastUpdatedAt={query.lastUpdatedAt} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active Projects" value={summary.totals.active_projects} tone="teal" />
        <MetricCard label="In Progress" value={summary.totals.tasks_in_progress} />
        <MetricCard label="Blocked Tasks" value={summary.totals.blocked_tasks} tone="rose" />
        <MetricCard label="Handovers" value={summary.totals.recent_handovers} tone="amber" />
        <MetricCard label="Low Score Alerts" value={summary.totals.low_score_alerts} tone="rose" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="panel p-4">
          <h4 className="text-lg font-semibold text-slate-900">Active Project Snapshots</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                  <th className="pb-2">Project</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Tasks</th>
                  <th className="pb-2">Blocked</th>
                  <th className="pb-2">Evaluations</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {summary.projects.map((project) => (
                  <tr key={project.project_id} className="border-t border-slate-200">
                    <td className="py-2">{project.name}</td>
                    <td className="py-2 capitalize">{project.status}</td>
                    <td className="py-2">{project.task_count}</td>
                    <td className="py-2">{project.blocked_count}</td>
                    <td className="py-2">{project.evaluation_count}</td>
                  </tr>
                ))}
                {!summary.projects.length ? (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={5}>
                      No projects yet. Use Tool Console to create one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel p-4">
          <h4 className="text-lg font-semibold text-slate-900">Alerts</h4>
          <div className="mt-3 space-y-2">
            {summary.alerts.blocked_tasks.slice(0, 5).map((task) => (
              <p key={task.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Blocked: {task.title}
              </p>
            ))}
            {summary.alerts.low_scores.slice(0, 5).map((item) => (
              <p key={item.evaluation_id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Low score: Agent {item.agent_id} avg {item.avg.toFixed(1)}
              </p>
            ))}
            {!summary.alerts.blocked_tasks.length && !summary.alerts.low_scores.length ? (
              <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                No critical alerts right now.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel p-4">
        <h4 className="text-lg font-semibold text-slate-900">Recent Evaluations</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.recent_evaluations.slice(0, 6).map((evaluation) => (
            <article key={evaluation.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{shortDate(evaluation.timestamp)}</p>
              <p className="mt-1 text-sm text-slate-900">Task: {evaluation.task_id}</p>
              <p className="mt-1 text-xs text-slate-600">Agent: {evaluation.agent_id}</p>
              <p className="mt-1 text-xs text-slate-600">
                Quality: {evaluation.score_quality} | Reliability: {evaluation.score_reliability}
              </p>
            </article>
          ))}
          {!summary.recent_evaluations.length ? <p className="text-sm text-slate-500">No evaluations recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

