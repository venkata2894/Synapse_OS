"use client";

import type { AgentContract, EvaluationContract, TaskContract } from "@sentientops/contracts";
import { useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { averageEvaluationScore, listAgents, listEvaluations, listTasks } from "@/lib/api-client";

function roleBadge(role: string): string {
  switch (role) {
    case "manager":
      return "border-info/30 bg-info-dim text-info";
    case "evaluator":
      return "border-purple-400/30 bg-purple-400/10 text-purple-300";
    default:
      return "border-signal/30 bg-signal-dim text-signal";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "active":
      return "bg-signal";
    case "paused":
      return "bg-warn";
    default:
      return "bg-ink-ghost";
  }
}

export default function AgentsPage() {
  const actor = useActor();
  const [roleFilter, setRoleFilter] = useState("");

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId }, { role: roleFilter || undefined }),
    [actor.actorId, roleFilter],
    { enabled: actor.ready }
  );

  const tasksQuery = usePollingQuery(
    () => listTasks({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  const evaluationsQuery = usePollingQuery(
    () => listEvaluations({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  const rows = useMemo(() => {
    return (agentsQuery.data?.items ?? []).map((agent: AgentContract) => {
      const assignedTasks = (tasksQuery.data?.items ?? []).filter((task: TaskContract) => task.assigned_to === agent.id);
      const completedTasks = assignedTasks.filter((task) => task.status === "completed");
      const evaluations = (evaluationsQuery.data?.items ?? []).filter(
        (evaluation: EvaluationContract) => evaluation.agent_id === agent.id
      );
      const average = evaluations.length
        ? evaluations.reduce((sum, evaluation) => sum + averageEvaluationScore(evaluation), 0) / evaluations.length
        : 0;
      return {
        ...agent,
        assignedCount: assignedTasks.length,
        completedCount: completedTasks.length,
        avgScore: average
      };
    });
  }, [agentsQuery.data?.items, tasksQuery.data?.items, evaluationsQuery.data?.items]);

  return (
    <section className="space-y-4">
      <article className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Agent Registry</p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink">Performance and Contribution</h3>
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-edge bg-canvas-surface px-3 py-2 text-sm text-ink outline-none focus:border-signal/50"
          >
            <option value="">All Roles</option>
            <option value="manager">Manager</option>
            <option value="worker">Worker</option>
            <option value="evaluator">Evaluator</option>
          </select>
        </div>
        <div className="mt-3">
          <QueryState isLoading={agentsQuery.isLoading} error={agentsQuery.error} lastUpdatedAt={agentsQuery.lastUpdatedAt} />
        </div>
      </article>

      <article className="surface p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
                <th className="pb-3">Agent</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Assigned</th>
                <th className="pb-3">Completed</th>
                <th className="pb-3">Avg Score</th>
                <th className="pb-3">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-edge/50 transition hover:bg-canvas-surface/50">
                  <td className="py-3">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="mt-0.5 break-all font-mono text-[10px] text-ink-ghost">{row.id}</p>
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${roleBadge(row.role)}`}>
                      {row.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-1.5 capitalize text-ink-secondary">
                      <span className={`inline-block h-2 w-2 rounded-full ${statusDot(row.status)}`} />
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-ink-secondary">{row.assignedCount}</td>
                  <td className="py-3 font-mono text-ink-secondary">{row.completedCount}</td>
                  <td className="py-3 font-mono">
                    {row.avgScore ? (
                      <span className="text-signal">{row.avgScore.toFixed(1)}</span>
                    ) : (
                      <span className="text-ink-ghost">N/A</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.capabilities.length ? (
                        row.capabilities.map((cap) => (
                          <span key={cap} className="rounded-full border border-edge bg-canvas-surface px-2 py-0.5 font-mono text-[10px] text-ink-tertiary">
                            {cap}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-ink-ghost">N/A</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-tertiary">
                    No agents found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
