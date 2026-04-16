"use client";

import { useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { averageEvaluationScore, listAgents, listEvaluations, listProjects } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

function scoreTone(score: number): string {
  if (score >= 7) return "text-signal";
  if (score >= 4) return "text-warn";
  return "text-danger";
}

export default function EvaluationsPage() {
  const actor = useActor();
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState("");

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  const evaluationsQuery = usePollingQuery(
    () =>
      listEvaluations(
        { actorId: actor.actorId },
        { projectId: projectId || undefined, agentId: agentId || undefined }
      ),
    [actor.actorId, projectId, agentId],
    { enabled: actor.ready }
  );

  const cards = useMemo(() => {
    return (evaluationsQuery.data?.items ?? []).map((evaluation) => ({
      ...evaluation,
      average: averageEvaluationScore(evaluation)
    }));
  }, [evaluationsQuery.data?.items]);

  return (
    <section className="space-y-4">
      <article className="surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Evaluator Layer</p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink">Scorecards and Audit Visibility</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="rounded-lg border border-edge bg-canvas-surface px-3 py-2 text-sm text-ink outline-none focus:border-signal/50"
            >
              <option value="">All Projects</option>
              {(projectsQuery.data?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              className="rounded-lg border border-edge bg-canvas-surface px-3 py-2 text-sm text-ink outline-none focus:border-signal/50"
            >
              <option value="">All Agents</option>
              {(agentsQuery.data?.items ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <QueryState
            isLoading={evaluationsQuery.isLoading}
            error={evaluationsQuery.error}
            lastUpdatedAt={evaluationsQuery.lastUpdatedAt}
          />
        </div>
      </article>

      <article className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.id} className="surface p-4 transition-all duration-200 hover:border-edge-bright">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[10px] text-ink-ghost">{shortDate(card.timestamp)}</p>
              <span className="rounded-full border border-edge bg-canvas-surface px-2 py-0.5 font-mono text-[10px] text-ink-tertiary">
                {card.override_audit_entries?.length ?? 0} audits
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">Task {card.task_id}</p>
            <p className="text-xs text-ink-tertiary">Agent {card.agent_id}</p>
            <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${scoreTone(card.average)}`}>
              {card.average.toFixed(1)}
              <span className="ml-1 font-mono text-sm font-normal text-ink-ghost">/ 10</span>
            </p>

            <div className="mt-3 space-y-1.5">
              {[
                { label: "Completion", value: card.score_completion },
                { label: "Quality", value: card.score_quality },
                { label: "Reliability", value: card.score_reliability },
                { label: "Handover", value: card.score_handover },
                { label: "Context", value: card.score_context },
                { label: "Clarity", value: card.score_clarity },
                { label: "Improvement", value: card.score_improvement }
              ].map((metric) => (
                <div key={metric.label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-ink-tertiary">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full bg-signal transition-all"
                        style={{ width: `${(metric.value / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`font-mono text-[11px] tabular-nums ${scoreTone(metric.value)}`}>{metric.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!cards.length ? <p className="text-sm text-ink-tertiary">No evaluations available for selected filters.</p> : null}
      </article>
    </section>
  );
}
