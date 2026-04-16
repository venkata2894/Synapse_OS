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
    <div className="space-y-6">
      {/* Header panel */}
      <section className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-signal" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Global Pulse</p>
            </div>
            <h3 className="mt-1 font-display text-3xl font-bold text-ink">
              Operational Overview
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/projects"
              className="flex items-center gap-2 rounded-xl border border-edge bg-white px-4 py-2.5 font-medium text-ink-secondary transition-all hover:border-signal/30 hover:bg-slate-50 hover:text-signal"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1.5 4.5V12.5C1.5 13.05 1.95 13.5 2.5 13.5H13.5C14.05 13.5 14.5 13.05 14.5 12.5V5.5C14.5 4.95 14.05 4.5 13.5 4.5H8L6.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5V4.5Z" />
              </svg>
              Project Details
            </Link>
            <Link
              href="/tasks"
              className="flex items-center gap-2 rounded-xl border border-edge bg-white px-4 py-2.5 font-medium text-ink-secondary transition-all hover:border-signal/30 hover:bg-slate-50 hover:text-signal"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1.5" y="1.5" width="3.5" height="13" rx="1" />
                <rect x="6.25" y="1.5" width="3.5" height="9" rx="1" />
                <rect x="11" y="1.5" width="3.5" height="11" rx="1" />
              </svg>
              Task Board
            </Link>
            <Link
              href="/tools"
              className="flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 font-bold text-white shadow-lg shadow-signal/20 transition-all hover:bg-signal/90 hover:shadow-signal/30"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
                <polyline points="4.5,6 7,8.5 4.5,11" />
                <line x1="9" y1="11" x2="12" y2="11" />
              </svg>
              Open Console
            </Link>
          </div>
        </div>
        <div className="mt-4 border-t border-edge pt-4">
          <QueryState isLoading={query.isLoading} error={query.error} lastUpdatedAt={query.lastUpdatedAt} />
        </div>
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Active Projects" value={summary.totals.active_projects} tone="teal" />
        <MetricCard label="In Progress" value={summary.totals.tasks_in_progress} />
        <MetricCard label="Blocked Tasks" value={summary.totals.blocked_tasks} tone="rose" />
        <MetricCard label="Handovers" value={summary.totals.recent_handovers} tone="amber" />
        <MetricCard label="Alerts" value={summary.totals.low_score_alerts} tone="rose" />
      </section>

      {/* Main grid */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Project snapshots */}
        <article className="surface p-6">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg font-bold text-ink">Active Clusters</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-ink-tertiary">Real-time</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4 text-center">Tasks</th>
                  <th className="pb-3 pr-4 text-center">Blocked</th>
                  <th className="pb-3 text-center">Evals</th>
                </tr>
              </thead>
              <tbody className="text-ink-secondary">
                {summary.projects.map((project) => (
                  <tr key={project.project_id} className="border-t border-slate-100 transition hover:bg-slate-50/50">
                    <td className="py-3.5 pr-4 font-semibold text-ink">{project.name}</td>
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-dim px-2 py-0.5 text-[10px] font-bold capitalize text-signal">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                        {project.status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-center font-mono font-medium">{project.task_count}</td>
                    <td className="py-3.5 pr-4 text-center font-mono">
                      {project.blocked_count > 0 ? (
                        <span className="font-bold text-danger">{project.blocked_count}</span>
                      ) : (
                        <span className="text-ink-tertiary">0</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-mono font-medium">{project.evaluation_count}</td>
                  </tr>
                ))}
                {!summary.projects.length ? (
                  <tr>
                    <td className="py-6 text-center text-ink-tertiary" colSpan={5}>
                      No active clusters detected.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        {/* Alerts */}
        <article className="surface p-6">
          <h4 className="font-display text-lg font-bold text-ink">System Alerts</h4>
          <div className="mt-5 space-y-3">
            {summary.alerts.blocked_tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-xl border border-danger/10 bg-danger-dim p-3 text-sm text-danger ring-1 ring-danger/5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{task.title}</p>
                </div>
              </div>
            ))}
            {summary.alerts.low_scores.slice(0, 5).map((item) => (
              <div key={item.evaluation_id} className="flex items-center gap-3 rounded-xl border border-warn/10 bg-warn-dim p-3 text-sm text-warn ring-1 ring-warn/5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-warn text-white">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Performance Alert</p>
                  <p className="text-[11px] opacity-80">Agent {item.agent_id} avg {item.avg.toFixed(1)}</p>
                </div>
              </div>
            ))}
            {!summary.alerts.blocked_tasks.length && !summary.alerts.low_scores.length ? (
              <div className="flex items-center gap-3 rounded-xl border border-signal/10 bg-signal-dim p-4 text-sm text-signal ring-1 ring-signal/5">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">System performance is within optimal range.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {/* Recent evaluations */}
      <section className="surface p-5">
        <h4 className="font-display text-lg font-semibold text-ink">Recent Evaluations</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.recent_evaluations.slice(0, 6).map((evaluation) => (
            <article key={evaluation.id} className="surface-inset rounded-xl p-3 transition hover:border-edge-bright">
              <p className="font-mono text-[10px] text-ink-ghost">{shortDate(evaluation.timestamp)}</p>
              <p className="mt-1 text-sm text-ink">Task: {evaluation.task_id}</p>
              <p className="mt-1 text-xs text-ink-tertiary">Agent: {evaluation.agent_id}</p>
              <p className="mt-1.5 font-mono text-xs text-ink-secondary">
                Quality: <span className="text-signal">{evaluation.score_quality}</span> | Reliability:{" "}
                <span className="text-signal">{evaluation.score_reliability}</span>
              </p>
            </article>
          ))}
          {!summary.recent_evaluations.length ? (
            <p className="text-sm text-ink-tertiary">No evaluations recorded yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
