"use client";

import type { DashboardSummary } from "@sentientops/contracts";
import Link from "next/link";
import { FolderKanban, KanbanSquare, Terminal, AlertTriangle, ShieldCheck } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { QueryState } from "@/components/query-state";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { getDashboardSummary } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

const empty: DashboardSummary = {
  totals: { active_projects: 0, tasks_in_progress: 0, blocked_tasks: 0, recent_handovers: 0, low_score_alerts: 0 },
  alerts: { blocked_tasks: [], low_scores: [] },
  projects: [],
  recent_handovers: [],
  recent_evaluations: [],
};

export default function HomePage() {
  const actor = useActor();
  const query = usePollingQuery(
    () => getDashboardSummary({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `dashboard:${actor.actorId}`,
    { enabled: actor.ready, initialData: empty }
  );
  const summary = query.data ?? empty;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Operations</CardSubtitle>
            <CardTitle>Daily overview</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button asChild variant="outline" size="sm">
              <Link href="/projects"><FolderKanban className="h-4 w-4" /> Projects</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/tasks"><KanbanSquare className="h-4 w-4" /> Tasks</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/tools"><Terminal className="h-4 w-4" /> Open console</Link>
            </Button>
          </div>
        </CardHeader>
        <QueryState isLoading={query.isLoading} error={query.error} lastUpdatedAt={query.lastUpdatedAt} />
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Active projects" value={summary.totals.active_projects} tone="signal" />
        <MetricCard label="In progress" value={summary.totals.tasks_in_progress} />
        <MetricCard label="Blocked" value={summary.totals.blocked_tasks} tone="danger" />
        <MetricCard label="Handovers (7d)" value={summary.totals.recent_handovers} tone="accent" />
        <MetricCard label="Low scores" value={summary.totals.low_score_alerts} tone="warn" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active clusters</CardTitle>
            <Badge tone="signal">Live</Badge>
          </CardHeader>
          {summary.projects.length === 0 ? (
            <EmptyState
              title="No active projects"
              hint="Create your first project to begin staffing agents."
              ctaLabel="Create project"
              ctaHref="/projects"
            />
          ) : (
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
                {summary.projects.map((p) => (
                  <tr key={p.project_id} className="border-t border-edge transition hover:bg-canvas-raised/40">
                    <td className="py-3.5 pr-4 font-semibold text-ink">{p.name}</td>
                    <td className="py-3.5 pr-4"><Badge tone="signal">{p.status}</Badge></td>
                    <td className="py-3.5 pr-4 text-center font-mono">{p.task_count}</td>
                    <td className="py-3.5 pr-4 text-center font-mono">
                      {p.blocked_count > 0 ? (
                        <span className="text-danger font-bold">{p.blocked_count}</span>
                      ) : (
                        <span className="text-ink-tertiary">0</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-mono">{p.evaluation_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <AlertsFeed summary={summary} />
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Recent evaluations</CardTitle></CardHeader>
        {summary.recent_evaluations.length === 0 ? (
          <EmptyState
            title="No evaluations yet"
            hint="Evaluations appear here once tasks complete the evaluator workflow."
            ctaLabel="View workflow"
            ctaHref="/tasks"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.recent_evaluations.slice(0, 6).map((e) => (
              <div key={e.id} className="surface-inset p-3">
                <p className="font-mono text-[10px] text-ink-tertiary">{shortDate(e.timestamp)}</p>
                <p className="mt-1 text-sm text-ink">Task {e.task_id}</p>
                <p className="mt-1 text-xs text-ink-secondary">Agent {e.agent_id}</p>
                <p className="mt-1.5 font-mono text-xs">
                  Quality <span className="text-signal">{e.score_quality}</span> · Reliability <span className="text-signal">{e.score_reliability}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AlertsFeed({ summary }: { summary: DashboardSummary }) {
  const items = [
    ...summary.alerts.blocked_tasks.map((t) => ({ kind: "blocked" as const, id: t.id, title: t.title })),
    ...summary.alerts.low_scores.map((s) => ({
      kind: "low_score" as const,
      id: s.evaluation_id,
      title: `Agent ${s.agent_id} avg ${s.avg.toFixed(1)}`,
    })),
  ];
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-signal/20 bg-signal-dim p-4 text-sm text-signal">
        <ShieldCheck className="h-5 w-5" />
        <p className="font-medium">System performance is within optimal range.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div
          key={`${item.kind}:${item.id}`}
          className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
            item.kind === "blocked"
              ? "border-danger/20 bg-danger-dim text-danger"
              : "border-warn/20 bg-warn-dim text-warn"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{item.title}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  hint,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  hint: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="font-display text-base font-bold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-secondary">{hint}</p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href={ctaHref as never}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
