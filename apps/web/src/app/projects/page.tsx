"use client";

import { useEffect, useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { listEvaluations, listProjects, listTasks } from "@/lib/api-client";
import { TASK_STATUS_LABELS } from "@/lib/status";

export default function ProjectsPage() {
  const actor = useActor();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId }),
    [actor.actorId],
    { enabled: actor.ready }
  );

  useEffect(() => {
    const first = projectsQuery.data?.items[0]?.id;
    if (!selectedProjectId && first) {
      setSelectedProjectId(first);
    }
  }, [projectsQuery.data?.items, selectedProjectId]);

  const tasksQuery = usePollingQuery(
    () => listTasks({ actorId: actor.actorId }, { projectId: selectedProjectId }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId) }
  );

  const evaluationsQuery = usePollingQuery(
    () => listEvaluations({ actorId: actor.actorId }, { projectId: selectedProjectId }),
    [actor.actorId, selectedProjectId],
    { enabled: actor.ready && Boolean(selectedProjectId) }
  );

  const selectedProject = useMemo(
    () => projectsQuery.data?.items.find((project) => project.id === selectedProjectId) ?? null,
    [projectsQuery.data?.items, selectedProjectId]
  );

  const statusCounts = useMemo(() => {
    const counters: Record<string, number> = {};
    for (const task of tasksQuery.data?.items ?? []) {
      counters[task.status] = (counters[task.status] ?? 0) + 1;
    }
    return counters;
  }, [tasksQuery.data?.items]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Project Registry</p>
        <QueryState
          isLoading={projectsQuery.isLoading}
          error={projectsQuery.error}
          lastUpdatedAt={projectsQuery.lastUpdatedAt}
        />
        <div className="mt-3 space-y-2">
          {projectsQuery.data?.items.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedProjectId(project.id)}
              className={[
                "w-full rounded-xl border px-3 py-3 text-left transition",
                project.id === selectedProjectId
                  ? "border-teal-300/45 bg-teal-500/10 text-teal-100"
                  : "border-slate-300/20 bg-white/5 text-slate-100 hover:bg-white/10"
              ].join(" ")}
            >
              <p className="text-sm font-medium">{project.name}</p>
              <p className="mt-1 text-xs capitalize text-slate-300">{project.status}</p>
            </button>
          ))}
          {!projectsQuery.data?.items.length ? (
            <p className="rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2 text-sm text-slate-300">
              No projects available yet.
            </p>
          ) : null}
        </div>
      </aside>

      <section className="space-y-4">
        <article className="panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Project Overview</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-100">{selectedProject?.name ?? "Select a project"}</h3>
          <p className="mt-2 text-sm text-slate-300">{selectedProject?.objective ?? "No project selected."}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
            {(selectedProject?.tags ?? []).map((tag) => (
              <span key={tag} className="rounded-full border border-slate-300/30 bg-white/5 px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
        </article>

        <div className="grid gap-4 xl:grid-cols-2">
          <article className="panel p-4">
            <p className="text-sm font-semibold text-slate-100">Task Board Summary</p>
            <QueryState isLoading={tasksQuery.isLoading} error={tasksQuery.error} lastUpdatedAt={tasksQuery.lastUpdatedAt} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => (
                <div key={status} className="rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{statusCounts[status] ?? 0}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel p-4">
            <p className="text-sm font-semibold text-slate-100">Evaluation Quick Pane</p>
            <QueryState
              isLoading={evaluationsQuery.isLoading}
              error={evaluationsQuery.error}
              lastUpdatedAt={evaluationsQuery.lastUpdatedAt}
            />
            <div className="mt-3 space-y-2">
              {(evaluationsQuery.data?.items ?? []).slice(0, 6).map((evaluation) => (
                <div key={evaluation.id} className="rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2">
                  <p className="text-sm text-slate-100">Task {evaluation.task_id}</p>
                  <p className="text-xs text-slate-300">
                    Agent {evaluation.agent_id} • Quality {evaluation.score_quality}/10
                  </p>
                </div>
              ))}
              {!evaluationsQuery.data?.items.length ? (
                <p className="text-sm text-slate-400">No evaluations recorded for this project yet.</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
