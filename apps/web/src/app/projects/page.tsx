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
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="surface p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Project Registry</p>
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
                "w-full rounded-xl border px-3 py-3 text-left transition-all duration-200",
                project.id === selectedProjectId
                  ? "surface-inset glow-signal text-signal"
                  : "border-edge bg-canvas-surface text-ink-secondary hover:border-edge-bright hover:text-ink"
              ].join(" ")}
            >
              <p className="text-sm font-medium">{project.name}</p>
              <p className="mt-1 font-mono text-[10px] capitalize text-ink-tertiary">{project.status}</p>
            </button>
          ))}
          {!projectsQuery.data?.items.length ? (
            <p className="surface-inset rounded-lg px-3 py-3 text-sm text-ink-tertiary">
              No projects available yet.
            </p>
          ) : null}
        </div>
      </aside>

      {/* Main content */}
      <section className="space-y-4">
        <article className="surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Project Overview</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-ink">{selectedProject?.name ?? "Select a project"}</h3>
          <p className="mt-2 text-sm text-ink-secondary">{selectedProject?.objective ?? "No project selected."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(selectedProject?.tags ?? []).map((tag) => (
              <span key={tag} className="rounded-full border border-edge bg-canvas-surface px-3 py-1 font-mono text-[10px] text-ink-tertiary">
                {tag}
              </span>
            ))}
          </div>
        </article>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Task board summary */}
          <article className="surface p-5">
            <p className="font-display text-sm font-semibold text-ink">Task Board Summary</p>
            <QueryState isLoading={tasksQuery.isLoading} error={tasksQuery.error} lastUpdatedAt={tasksQuery.lastUpdatedAt} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => {
                const count = statusCounts[status] ?? 0;
                return (
                  <div key={status} className="surface-inset rounded-lg px-3 py-2">
                    <p className="font-mono text-[10px] text-ink-tertiary">{label}</p>
                    <p className={`mt-1 font-display text-lg font-bold tabular-nums ${count > 0 ? "text-ink" : "text-ink-ghost"}`}>
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Evaluation pane */}
          <article className="surface p-5">
            <p className="font-display text-sm font-semibold text-ink">Evaluation Quick Pane</p>
            <QueryState
              isLoading={evaluationsQuery.isLoading}
              error={evaluationsQuery.error}
              lastUpdatedAt={evaluationsQuery.lastUpdatedAt}
            />
            <div className="mt-3 space-y-2">
              {(evaluationsQuery.data?.items ?? []).slice(0, 6).map((evaluation) => (
                <div key={evaluation.id} className="surface-inset rounded-lg px-3 py-2">
                  <p className="text-sm text-ink">Task {evaluation.task_id}</p>
                  <p className="text-xs text-ink-tertiary">
                    Agent {evaluation.agent_id} | Quality{" "}
                    <span className="font-mono text-signal">{evaluation.score_quality}/10</span>
                  </p>
                </div>
              ))}
              {!evaluationsQuery.data?.items.length ? (
                <p className="text-sm text-ink-tertiary">No evaluations recorded for this project yet.</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
