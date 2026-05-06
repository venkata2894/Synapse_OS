"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Users, ClipboardList } from "lucide-react";

import { QueryState } from "@/components/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardSubtitle, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import {
  createProject,
  getProjectStaffing,
  listAgents,
  listProjects,
  listTasks,
  listWorklogs,
} from "@/lib/api-client";
import { shortDate } from "@/lib/format";

import type { AgentContract, ProjectContract } from "@sentientops/contracts";

type SortColumn = "name" | "status" | "manager" | "agents" | "tasks" | "updated";
type SortDirection = "asc" | "desc";

const STATUS_TONE: Record<string, "signal" | "warn" | "neutral" | "danger"> = {
  active: "signal",
  paused: "warn",
  archived: "neutral",
};

function statusTone(status: string): "signal" | "warn" | "neutral" | "danger" {
  return STATUS_TONE[status] ?? "neutral";
}

function relativeFromNow(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(value);
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

export default function ProjectsPage() {
  const actor = useActor();
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDirection }>({
    col: "updated",
    dir: "desc",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `projects:${actor.actorId}`,
    { enabled: actor.ready }
  );

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `agents-all:${actor.actorId}`,
    { enabled: actor.ready }
  );

  const tasksQuery = usePollingQuery(
    () => listTasks({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `tasks-all:${actor.actorId}`,
    { enabled: actor.ready }
  );

  const projects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data?.items]);
  const agents = useMemo(() => agentsQuery.data?.items ?? [], [agentsQuery.data?.items]);
  const tasks = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data?.items]);

  const agentCountByProject = useMemo(() => {
    const counter: Record<string, number> = {};
    for (const agent of agents) {
      if (agent.project_id) {
        counter[agent.project_id] = (counter[agent.project_id] ?? 0) + 1;
      }
    }
    return counter;
  }, [agents]);

  const taskCountByProject = useMemo(() => {
    const counter: Record<string, number> = {};
    for (const task of tasks) {
      counter[task.project_id] = (counter[task.project_id] ?? 0) + 1;
    }
    return counter;
  }, [tasks]);

  const managerById = useMemo(() => {
    const map: Record<string, AgentContract> = {};
    for (const agent of agents) {
      map[agent.id] = agent;
    }
    return map;
  }, [agents]);

  const sortedProjects = useMemo(() => {
    const enriched = projects.map((project) => ({
      project,
      managerName: project.manager_agent_id ? managerById[project.manager_agent_id]?.name ?? null : null,
      agentCount: agentCountByProject[project.id] ?? 0,
      taskCount: taskCountByProject[project.id] ?? 0,
    }));

    const dirMul = sort.dir === "asc" ? 1 : -1;
    enriched.sort((a, b) => {
      switch (sort.col) {
        case "name":
          return dirMul * a.project.name.localeCompare(b.project.name);
        case "status":
          return dirMul * a.project.status.localeCompare(b.project.status);
        case "manager":
          return dirMul * ((a.managerName ?? "~").localeCompare(b.managerName ?? "~"));
        case "agents":
          return dirMul * (a.agentCount - b.agentCount);
        case "tasks":
          return dirMul * (a.taskCount - b.taskCount);
        case "updated":
        default: {
          const ad = new Date(a.project.updated_at).getTime();
          const bd = new Date(b.project.updated_at).getTime();
          return dirMul * (ad - bd);
        }
      }
    });
    return enriched;
  }, [projects, managerById, agentCountByProject, taskCountByProject, sort]);

  function toggleSort(col: SortColumn) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" || col === "manager" ? "asc" : "desc" }
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Operations</CardSubtitle>
            <CardTitle>Projects</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <QueryState
              isLoading={projectsQuery.isLoading}
              error={projectsQuery.error}
              lastUpdatedAt={projectsQuery.lastUpdatedAt}
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </div>
        </CardHeader>

        {sortedProjects.length === 0 && !projectsQuery.isLoading ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                  <SortableHeader label="Name" col="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Status" col="status" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Manager" col="manager" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Agents" col="agents" sort={sort} onSort={toggleSort} align="center" />
                  <SortableHeader label="Tasks" col="tasks" sort={sort} onSort={toggleSort} align="center" />
                  <SortableHeader label="Last activity" col="updated" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="text-ink-secondary">
                {sortedProjects.map(({ project, managerName, agentCount, taskCount }) => (
                  <tr
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="cursor-pointer border-t border-edge transition hover:bg-canvas-raised/40"
                  >
                    <td className="py-3.5 pr-4 font-semibold text-ink">{project.name}</td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={statusTone(project.status)}>{project.status}</Badge>
                    </td>
                    <td className="py-3.5 pr-4">{managerName ?? <span className="text-ink-ghost">—</span>}</td>
                    <td className="py-3.5 pr-4 text-center font-mono tabular-nums">{agentCount}</td>
                    <td className="py-3.5 pr-4 text-center font-mono tabular-nums">{taskCount}</td>
                    <td className="py-3.5 pr-4 font-mono text-xs text-ink-tertiary">
                      {relativeFromNow(project.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProjectDrawer
        projectId={selectedProjectId}
        project={projects.find((p) => p.id === selectedProjectId) ?? null}
        onClose={() => setSelectedProjectId(null)}
      />

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultOwner={actor.actorId}
        onCreated={() => {
          void projectsQuery.refresh();
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function SortableHeader({
  label,
  col,
  sort,
  onSort,
  align,
}: {
  label: string;
  col: SortColumn;
  sort: { col: SortColumn; dir: SortDirection };
  onSort: (col: SortColumn) => void;
  align?: "left" | "center";
}) {
  const Icon = sort.col === col ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`pb-3 pr-4 ${align === "center" ? "text-center" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.2em] transition hover:text-ink ${
          sort.col === col ? "text-ink" : "text-ink-tertiary"
        }`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-display text-base font-bold text-ink">No projects yet</p>
      <p className="max-w-sm text-sm text-ink-secondary">
        Create your first to begin.
      </p>
      <Button size="sm" className="mt-2" onClick={onCreate}>
        <Plus className="h-4 w-4" /> New project
      </Button>
    </div>
  );
}

function ProjectDrawer({
  projectId,
  project,
  onClose,
}: {
  projectId: string | null;
  project: ProjectContract | null;
  onClose: () => void;
}) {
  const actor = useActor();
  const open = Boolean(projectId);

  const staffingQuery = usePollingQuery(
    () =>
      getProjectStaffing(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId as string
      ),
    `staffing:${projectId ?? "_"}`,
    { enabled: actor.ready && Boolean(projectId) }
  );

  const worklogQuery = usePollingQuery(
    () =>
      listWorklogs(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { projectId: projectId as string, limit: 8 }
      ),
    `worklogs:${projectId ?? "_"}`,
    { enabled: actor.ready && Boolean(projectId) }
  );

  const staffing = staffingQuery.data;
  const manager = staffing?.manager ?? null;
  const counters = staffing?.counters;
  const totalAgents =
    counters?.total_agents ??
    (staffing
      ? (staffing.manager ? 1 : 0) +
        staffing.workers.length +
        staffing.evaluators.length +
        staffing.other_agents.length
      : 0);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{project?.name ?? "Project"}</SheetTitle>
          <SheetDescription>
            {project?.objective || project?.description || "Project staffing & recent activity."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Manager</p>
            {manager ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-edge bg-canvas-inset p-3">
                <Avatar>
                  <AvatarFallback className="text-xs font-bold">{initials(manager.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{manager.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                    {manager.role} · {manager.status}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-edge bg-canvas-inset p-3 text-sm text-ink-tertiary">
                No manager assigned.
              </p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <StatTile icon={<Users className="h-4 w-4" />} label="Agents" value={totalAgents} />
            <StatTile
              icon={<ClipboardList className="h-4 w-4" />}
              label="Tasks in progress"
              value={counters?.tasks_in_progress ?? 0}
            />
          </section>

          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Recent activity</p>
            <QueryState
              isLoading={worklogQuery.isLoading}
              error={worklogQuery.error}
              lastUpdatedAt={worklogQuery.lastUpdatedAt}
            />
            <div className="mt-3 space-y-2">
              {(worklogQuery.data?.items ?? []).slice(0, 6).map((entry) => (
                <div key={entry.id} className="surface-inset rounded-lg p-3">
                  <p className="font-mono text-[10px] text-ink-tertiary">
                    {shortDate(entry.timestamp)} · {entry.action_type}
                  </p>
                  <p className="mt-1 text-sm text-ink">{entry.summary}</p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {entry.agent_name} on {entry.task_title}
                  </p>
                </div>
              ))}
              {(worklogQuery.data?.items ?? []).length === 0 && !worklogQuery.isLoading ? (
                <p className="rounded-lg border border-dashed border-edge bg-canvas-inset p-3 text-sm text-ink-tertiary">
                  No activity recorded yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-inset rounded-lg p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  defaultOwner,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOwner: string;
  onCreated: (project: ProjectContract) => void;
}) {
  const actor = useActor();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [owner, setOwner] = useState(defaultOwner);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setObjective("");
    setOwner(defaultOwner);
    setTagsInput("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const created = await createProject(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        {
          name: name.trim(),
          description: description.trim() || undefined,
          objective: objective.trim() || undefined,
          owner: owner.trim() || defaultOwner,
          tags: tags.length > 0 ? tags : undefined,
        }
      );
      reset();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Spin up a new project workspace and assign agents later.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Atlas migration"
              autoFocus
              required
            />
          </Field>
          <Field label="Objective">
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What outcome defines success?"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short context for the team."
            />
          </Field>
          <Field label="Owner">
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={defaultOwner} />
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="growth, q3"
            />
          </Field>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
        {label}
        {required ? <span className="text-danger">*</span> : null}
        {hint ? <span className="text-ink-ghost normal-case tracking-normal">— {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

