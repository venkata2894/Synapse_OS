"use client";

import { useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { averageEvaluationScore, listAgents, listEvaluations, listProjects } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

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
      <article className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Evaluator Layer</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Scorecards and Audit Visibility</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
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
          <div key={card.id} className="panel p-4">
            <p className="text-xs text-slate-500">{shortDate(card.timestamp)}</p>
            <p className="mt-1 text-sm text-slate-800">Task {card.task_id}</p>
            <p className="text-xs text-slate-500">Agent {card.agent_id}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.average.toFixed(1)} / 10</p>

            <div className="mt-3 space-y-1 text-xs text-slate-700">
              <p>Completion {card.score_completion}</p>
              <p>Quality {card.score_quality}</p>
              <p>Reliability {card.score_reliability}</p>
              <p>Handover {card.score_handover}</p>
              <p>Context {card.score_context}</p>
              <p>Clarity {card.score_clarity}</p>
              <p>Improvement {card.score_improvement}</p>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              Audit entries: {card.override_audit_entries?.length ?? 0}
            </div>
          </div>
        ))}
        {!cards.length ? <p className="text-sm text-slate-500">No evaluations available for selected filters.</p> : null}
      </article>
    </section>
  );
}

