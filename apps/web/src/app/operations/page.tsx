"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Menu } from "lucide-react";

import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { useResilientEventStream } from "@/hooks/use-resilient-event-stream";
import {
  getProjectStaffing,
  listAgents,
  listEvaluations,
  listProjects,
  listTasks,
  listWorklogs,
  openProjectEventStream,
} from "@/lib/api-client";

import type {
  AgentContract,
  EvaluationContract,
  ProjectStaffingAgent,
  WorklogEntry,
} from "@sentientops/contracts";

import { AgentsGrid } from "./components/agents-grid";
import { KpiStrip } from "./components/kpi-strip";
import { ManagerSlotPanel } from "./components/manager-slot-panel";
import { ProjectRail, type ProjectRailItem } from "./components/project-rail";
import { RightRail } from "./components/right-rail";

export default function OperationsPage() {
  const actor = useActor();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectParam = searchParams?.get("project") ?? null;

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(projectParam ?? "");
  const [pulseMap, setPulseMap] = React.useState<Map<string, number>>(() => new Map());
  const [refreshSignal, setRefreshSignal] = React.useState(0);
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);

  // ----- Queries ----------------------------------------------------------
  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `projects:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 30_000 }
  );

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `agents-all:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 60_000 }
  );

  // Auto-select first project once data arrives.
  React.useEffect(() => {
    if (selectedProjectId) return;
    const first = projectsQuery.data?.items[0]?.id;
    if (first) {
      setSelectedProjectId(first);
    }
  }, [projectsQuery.data?.items, selectedProjectId]);

  // Mirror selected project into the URL.
  React.useEffect(() => {
    if (!selectedProjectId) return;
    if (projectParam === selectedProjectId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("project", selectedProjectId);
    router.replace(`/operations?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // SSE subscription -------------------------------------------------------
  const stream = useResilientEventStream({
    enabled: actor.ready && Boolean(selectedProjectId),
    connect: () => openProjectEventStream(selectedProjectId, actor.actorId || "owner-dev"),
    onEvent: (event) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data) as { type?: string; project_id?: string };
        if (parsed.type === "heartbeat") return;
        const pid = parsed.project_id ?? selectedProjectId;
        if (pid) {
          setPulseMap((current) => {
            const next = new Map(current);
            next.set(pid, Date.now());
            return next;
          });
        }
      } catch {
        // ignore non-JSON payloads
      }
      setRefreshSignal((value) => value + 1);
    },
  });

  // Per-project queries ----------------------------------------------------
  const enabled = actor.ready && Boolean(selectedProjectId);

  const staffingQuery = usePollingQuery(
    () =>
      getProjectStaffing(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        selectedProjectId
      ),
    `staffing:${actor.actorId}:${selectedProjectId || "_"}`,
    { enabled, intervalMs: stream.status === "connected" ? 60_000 : 10_000 }
  );

  const tasksQuery = usePollingQuery(
    () =>
      listTasks(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: selectedProjectId, limit: 200 }
      ),
    `tasks:${actor.actorId}:${selectedProjectId || "_"}`,
    { enabled, intervalMs: stream.status === "connected" ? 60_000 : 10_000 }
  );

  const worklogsQuery = usePollingQuery(
    () =>
      listWorklogs(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: selectedProjectId, limit: 30 }
      ),
    `worklogs:${actor.actorId}:${selectedProjectId || "_"}`,
    { enabled, intervalMs: stream.status === "connected" ? 45_000 : 10_000 }
  );

  const evaluationsQuery = usePollingQuery(
    () =>
      listEvaluations(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: selectedProjectId, limit: 50 }
      ),
    `evals:${actor.actorId}:${selectedProjectId || "_"}`,
    { enabled, intervalMs: 60_000 }
  );

  // SSE-driven refresh fan-out --------------------------------------------
  React.useEffect(() => {
    if (!refreshSignal || !selectedProjectId) return;
    void staffingQuery.refresh();
    void tasksQuery.refresh();
    void worklogsQuery.refresh();
    void evaluationsQuery.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // Derived data -----------------------------------------------------------
  const projects = React.useMemo(
    () => projectsQuery.data?.items ?? [],
    [projectsQuery.data?.items]
  );

  const railItems: ProjectRailItem[] = React.useMemo(() => {
    const allAgents: AgentContract[] = agentsQuery.data?.items ?? [];
    const managerById = new Map<string, AgentContract>();
    for (const agent of allAgents) managerById.set(agent.id, agent);
    return projects.map((project) => ({
      project,
      managerName: project.manager_agent_id
        ? managerById.get(project.manager_agent_id)?.name ?? null
        : null,
      wipCount:
        project.id === selectedProjectId
          ? staffingQuery.data?.counters.tasks_in_progress ?? null
          : null,
    }));
  }, [agentsQuery.data?.items, projects, selectedProjectId, staffingQuery.data?.counters.tasks_in_progress]);

  const rosterAgents: ProjectStaffingAgent[] = React.useMemo(() => {
    const summary = staffingQuery.data;
    if (!summary) return [];
    const items = [
      ...(summary.manager ? [summary.manager] : []),
      ...summary.workers,
      ...summary.evaluators,
      ...summary.other_agents,
    ];
    const dedup = new Map<string, ProjectStaffingAgent>();
    for (const agent of items) dedup.set(agent.id, agent);
    return Array.from(dedup.values());
  }, [staffingQuery.data]);

  const managerCandidates = React.useMemo<AgentContract[]>(() => {
    const all = agentsQuery.data?.items ?? [];
    const onProject = all.filter(
      (agent) => agent.project_id === selectedProjectId || !agent.project_id
    );
    // Manager-capable first, then everyone else.
    return [...onProject].sort((a, b) => {
      const aPriority = a.role === "manager" ? 0 : a.role === "owner" ? 1 : 2;
      const bPriority = b.role === "manager" ? 0 : b.role === "owner" ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });
  }, [agentsQuery.data?.items, selectedProjectId]);

  const tasks = React.useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data?.items]);
  const worklogs: WorklogEntry[] = React.useMemo(
    () => worklogsQuery.data?.items ?? [],
    [worklogsQuery.data?.items]
  );

  const lastHandover: WorklogEntry | null = React.useMemo(() => {
    return worklogs.find((entry) => entry.action_type.toLowerCase() === "handover") ?? null;
  }, [worklogs]);

  const evalsPending = React.useMemo<number | null>(() => {
    const items: EvaluationContract[] | undefined = evaluationsQuery.data?.items;
    if (!items) return null;
    const evaluatedTaskIds = new Set(items.map((evaluation) => evaluation.task_id));
    const reviewLikeStatuses = new Set([
      "awaiting_handover",
      "under_review",
      "evaluation",
    ]);
    return tasks.filter(
      (task) => reviewLikeStatuses.has(task.status) && !evaluatedTaskIds.has(task.id)
    ).length;
  }, [evaluationsQuery.data?.items, tasks]);

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      staffingQuery.refresh(),
      tasksQuery.refresh(),
      worklogsQuery.refresh(),
      evaluationsQuery.refresh(),
      projectsQuery.refresh(),
      agentsQuery.refresh(),
    ]);
  }, [
    agentsQuery,
    evaluationsQuery,
    projectsQuery,
    staffingQuery,
    tasksQuery,
    worklogsQuery,
  ]);

  const onSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // Render -----------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-dim text-signal">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
              Operations
            </p>
            <h2 className="font-display text-lg font-bold text-ink">Mission control</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <QueryState
            isLoading={
              staffingQuery.isLoading ||
              projectsQuery.isLoading ||
              agentsQuery.isLoading
            }
            error={
              staffingQuery.error ?? projectsQuery.error ?? agentsQuery.error ?? null
            }
            lastUpdatedAt={staffingQuery.lastUpdatedAt}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMobileSheetOpen(true)}
            className="xl:hidden"
          >
            <Menu className="h-4 w-4" /> Activity
          </Button>
        </div>
      </div>

      {/* Below 1024px: project rail collapses to a top Select. */}
      <div className="lg:hidden">
        <Select
          value={selectedProjectId || undefined}
          onValueChange={(value) => onSelectProject(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block">
          <ProjectRail
            items={railItems}
            selectedProjectId={selectedProjectId || null}
            onSelect={onSelectProject}
            pulseMap={pulseMap}
            onProjectCreated={(project) => {
              void projectsQuery.refresh();
              setSelectedProjectId(project.id);
            }}
          />
        </div>

        <div className="space-y-5">
          <ManagerSlotPanel
            projectId={selectedProjectId || null}
            staffing={staffingQuery.data ?? null}
            candidateAgents={managerCandidates}
            onChanged={refreshAll}
          />
          <AgentsGrid
            projectId={selectedProjectId || null}
            staffing={staffingQuery.data ?? null}
            onChanged={refreshAll}
          />
          <KpiStrip
            staffing={staffingQuery.data ?? null}
            evalsPending={evalsPending}
            lastHandover={lastHandover}
          />
        </div>

        <div className="hidden xl:block">
          <RightRail
            projectId={selectedProjectId || null}
            worklogs={worklogs}
            worklogsLoading={worklogsQuery.isLoading}
            tasks={tasks}
            agents={rosterAgents}
            streamStatus={stream.status}
            reconnectCount={stream.reconnectCount}
            lastPollAt={worklogsQuery.lastUpdatedAt}
            onWorklogAppended={async () => {
              await worklogsQuery.refresh();
              await staffingQuery.refresh();
            }}
            refreshSignal={refreshSignal}
            className="max-h-[calc(100vh-7rem)]"
          />
        </div>
      </div>

      {/* Below 1280px: right rail is hidden inline; surface as a Sheet. */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="px-5 pt-6">
            <SheetTitle>Activity & quick log</SheetTitle>
            <SheetDescription>
              Real-time activity, quick log, handovers, and connection health.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <RightRail
              projectId={selectedProjectId || null}
              worklogs={worklogs}
              worklogsLoading={worklogsQuery.isLoading}
              tasks={tasks}
              agents={rosterAgents}
              streamStatus={stream.status}
              reconnectCount={stream.reconnectCount}
              lastPollAt={worklogsQuery.lastUpdatedAt}
              onWorklogAppended={async () => {
                await worklogsQuery.refresh();
                await staffingQuery.refresh();
              }}
              refreshSignal={refreshSignal}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
