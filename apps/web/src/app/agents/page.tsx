"use client";

import type { AgentContract, EvaluationContract, TaskContract } from "@sentientops/contracts";
import { useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { averageEvaluationScore, listAgents, listEvaluations, listTasks } from "@/lib/api-client";

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
      <article className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Agent Registry</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Performance and Contribution</h3>
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
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

      <article className="panel p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.13em] text-slate-500">
                <th className="pb-2">Agent</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Assigned</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Avg Score</th>
                <th className="pb-2">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 text-slate-800">
                  <td className="py-2">
                    <p className="font-medium">{row.name}</p>
                    <p className="break-all text-xs text-slate-500">{row.id}</p>
                  </td>
                  <td className="py-2 capitalize">{row.role}</td>
                  <td className="py-2 capitalize">{row.status}</td>
                  <td className="py-2">{row.assignedCount}</td>
                  <td className="py-2">{row.completedCount}</td>
                  <td className="py-2">{row.avgScore ? row.avgScore.toFixed(1) : "N/A"}</td>
                  <td className="py-2 text-xs text-slate-600">{row.capabilities.join(", ") || "N/A"}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500">
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
