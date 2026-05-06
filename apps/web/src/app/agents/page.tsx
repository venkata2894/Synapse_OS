"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { QueryState } from "@/components/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardSubtitle, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import {
  listAgents,
  listProjects,
  listWorklogs,
  updateAgentStatus,
} from "@/lib/api-client";
import { shortDate } from "@/lib/format";

import type { AgentContract } from "@sentientops/contracts";

type SortColumn = "name" | "type" | "role" | "status" | "projects" | "updated";
type SortDirection = "asc" | "desc";

type TypeFilter = "project_side" | "platform_side";
type StatusFilter = "active" | "inactive" | "paused";
type RoleFilter = "owner" | "manager" | "worker" | "evaluator";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "project_side", label: "Project side" },
  { value: "platform_side", label: "Platform side" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "paused", label: "Paused" },
];

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "worker", label: "Worker" },
  { value: "evaluator", label: "Evaluator" },
];

function statusTone(status: string): "signal" | "warn" | "neutral" {
  if (status === "active") return "signal";
  if (status === "paused") return "warn";
  return "neutral";
}

function roleTone(role: string): "info" | "accent" | "signal" | "neutral" {
  switch (role) {
    case "manager":
      return "info";
    case "evaluator":
      return "accent";
    case "worker":
      return "signal";
    default:
      return "neutral";
  }
}

function typeTone(type: string): "info" | "neutral" {
  return type === "platform_side" ? "info" : "neutral";
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

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export default function AgentsPage() {
  const actor = useActor();
  const [typeFilter, setTypeFilter] = useState<TypeFilter | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDirection }>({
    col: "updated",
    dir: "desc",
  });

  const agentsQuery = usePollingQuery(
    () =>
      listAgents(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { role: roleFilter ?? undefined }
      ),
    `agents:${actor.actorId}:${typeFilter ?? "_"}:${statusFilter ?? "_"}:${roleFilter ?? "_"}`,
    { enabled: actor.ready }
  );

  const projectsQuery = usePollingQuery(
    () => listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `projects-for-agents:${actor.actorId}`,
    { enabled: actor.ready }
  );

  const allAgents = useMemo(
    () => agentsQuery.data?.items ?? [],
    [agentsQuery.data?.items]
  );

  const projectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const project of projectsQuery.data?.items ?? []) {
      ids.add(project.id);
    }
    return ids;
  }, [projectsQuery.data?.items]);

  const projectCountByAgent = useMemo(() => {
    const counter: Record<string, number> = {};
    for (const agent of allAgents) {
      if (agent.project_id && projectIds.has(agent.project_id)) {
        counter[agent.id] = (counter[agent.id] ?? 0) + 1;
      }
    }
    return counter;
  }, [allAgents, projectIds]);

  const filteredAgents = useMemo(() => {
    return allAgents.filter((agent) => {
      if (typeFilter && agent.type !== typeFilter) return false;
      if (statusFilter && agent.status !== statusFilter) return false;
      // role filter is also applied server-side via query param, but keep client-side
      // guard for safety in case the API ignores unknown roles.
      if (roleFilter && agent.role !== roleFilter) return false;
      return true;
    });
  }, [allAgents, typeFilter, statusFilter, roleFilter]);

  const sortedAgents = useMemo(() => {
    const enriched = filteredAgents.map((agent) => ({
      agent,
      projectCount: projectCountByAgent[agent.id] ?? (agent.project_id ? 1 : 0),
    }));
    const dirMul = sort.dir === "asc" ? 1 : -1;
    enriched.sort((a, b) => {
      switch (sort.col) {
        case "name":
          return dirMul * a.agent.name.localeCompare(b.agent.name);
        case "type":
          return dirMul * a.agent.type.localeCompare(b.agent.type);
        case "role":
          return dirMul * a.agent.role.localeCompare(b.agent.role);
        case "status":
          return dirMul * a.agent.status.localeCompare(b.agent.status);
        case "projects":
          return dirMul * (a.projectCount - b.projectCount);
        case "updated":
        default: {
          const ad = new Date(a.agent.updated_at).getTime();
          const bd = new Date(b.agent.updated_at).getTime();
          return dirMul * (ad - bd);
        }
      }
    });
    return enriched;
  }, [filteredAgents, projectCountByAgent, sort]);

  function toggleSort(col: SortColumn) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" || col === "role" || col === "type" ? "asc" : "desc" }
    );
  }

  function clearFilters() {
    setTypeFilter(null);
    setStatusFilter(null);
    setRoleFilter(null);
  }

  const hasFilters = Boolean(typeFilter || statusFilter || roleFilter);

  // Touch projectsQuery so its lastUpdatedAt stays warm; surfaces auth errors too.
  const projectsLoading = projectsQuery.isLoading;

  const selectedAgent = useMemo(
    () => allAgents.find((a) => a.id === selectedAgentId) ?? null,
    [allAgents, selectedAgentId]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Operations</CardSubtitle>
            <CardTitle>Agents</CardTitle>
          </div>
          <QueryState
            isLoading={agentsQuery.isLoading || projectsLoading}
            error={agentsQuery.error ?? projectsQuery.error}
            lastUpdatedAt={agentsQuery.lastUpdatedAt}
          />
        </CardHeader>

        <FilterBar
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          roleFilter={roleFilter}
          onType={(value) => setTypeFilter((cur) => (cur === value ? null : value))}
          onStatus={(value) => setStatusFilter((cur) => (cur === value ? null : value))}
          onRole={(value) => setRoleFilter((cur) => (cur === value ? null : value))}
          onClear={clearFilters}
          hasFilters={hasFilters}
        />

        {sortedAgents.length === 0 && !agentsQuery.isLoading ? (
          <EmptyState onClear={clearFilters} hasFilters={hasFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                  <SortableHeader label="Name" col="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Type" col="type" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Role" col="role" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Status" col="status" sort={sort} onSort={toggleSort} />
                  <SortableHeader
                    label="Projects"
                    col="projects"
                    sort={sort}
                    onSort={toggleSort}
                    align="center"
                  />
                  <SortableHeader label="Last active" col="updated" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="text-ink-secondary">
                {sortedAgents.map(({ agent, projectCount }) => (
                  <tr
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className="cursor-pointer border-t border-edge transition hover:bg-canvas-raised/40"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[11px] font-bold">
                            {initials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{agent.name}</p>
                          <p className="truncate font-mono text-[10px] text-ink-ghost">{agent.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={typeTone(agent.type)}>{formatLabel(agent.type)}</Badge>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={roleTone(agent.role)}>{agent.role}</Badge>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={statusTone(agent.status)}>{agent.status}</Badge>
                    </td>
                    <td className="py-3.5 pr-4 text-center font-mono tabular-nums">{projectCount}</td>
                    <td className="py-3.5 pr-4 font-mono text-xs text-ink-tertiary">
                      {relativeFromNow(agent.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AgentDrawer
        agent={selectedAgent}
        onClose={() => setSelectedAgentId(null)}
        onStatusChanged={() => {
          void agentsQuery.refresh();
        }}
      />
    </div>
  );
}

function FilterBar({
  typeFilter,
  statusFilter,
  roleFilter,
  onType,
  onStatus,
  onRole,
  onClear,
  hasFilters,
}: {
  typeFilter: TypeFilter | null;
  statusFilter: StatusFilter | null;
  roleFilter: RoleFilter | null;
  onType: (value: TypeFilter) => void;
  onStatus: (value: StatusFilter) => void;
  onRole: (value: RoleFilter) => void;
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-edge px-5 py-4">
      <FilterGroup label="Type">
        {TYPE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={typeFilter === opt.value}
            onClick={() => onType(opt.value)}
          >
            {opt.label}
          </FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup label="Status">
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={statusFilter === opt.value}
            onClick={() => onStatus(opt.value)}
          >
            {opt.label}
          </FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup label="Role">
        {ROLE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={roleFilter === opt.value}
            onClick={() => onRole(opt.value)}
          >
            {opt.label}
          </FilterChip>
        ))}
      </FilterGroup>
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "border-signal/50 bg-signal-dim text-signal hover:border-signal/70 hover:text-signal"
          : ""
      }
    >
      {children}
    </Button>
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

function EmptyState({
  onClear,
  hasFilters,
}: {
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-display text-base font-bold text-ink">
        {hasFilters ? "No agents match these filters" : "No agents yet"}
      </p>
      <p className="max-w-sm text-sm text-ink-secondary">
        {hasFilters
          ? "No agents match these filters — clear filters to see all."
          : "Agents will appear here once they're registered."}
      </p>
      {hasFilters ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function AgentDrawer({
  agent,
  onClose,
  onStatusChanged,
}: {
  agent: AgentContract | null;
  onClose: () => void;
  onStatusChanged: () => void;
}) {
  const actor = useActor();
  const open = Boolean(agent);
  const agentId = agent?.id ?? null;

  const worklogQuery = usePollingQuery(
    () =>
      listWorklogs(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { agentId: agentId as string, limit: 8 }
      ),
    `agent-worklogs:${agentId ?? "_"}`,
    { enabled: actor.ready && Boolean(agentId) }
  );

  const [pendingStatus, setPendingStatus] = useState<StatusFilter | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleStatusChange(next: StatusFilter) {
    if (!agent) return;
    if (agent.status === next) return;
    setPendingStatus(next);
    setStatusError(null);
    try {
      await updateAgentStatus(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        agent.id,
        next
      );
      onStatusChanged();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setStatusError(null);
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{agent?.name ?? "Agent"}</SheetTitle>
          <SheetDescription>
            {agent ? `${formatLabel(agent.type)} · ${formatLabel(agent.role)}` : "Agent profile"}
          </SheetDescription>
        </SheetHeader>

        {agent ? (
          <div className="mt-6 space-y-5">
            <section className="flex items-center gap-3 rounded-xl border border-edge bg-canvas-inset p-3">
              <Avatar>
                <AvatarFallback className="text-xs font-bold">
                  {initials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{agent.name}</p>
                <p className="truncate font-mono text-[10px] text-ink-ghost">{agent.id}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={typeTone(agent.type)}>{formatLabel(agent.type)}</Badge>
                  <Badge tone={roleTone(agent.role)}>{agent.role}</Badge>
                  <Badge tone={statusTone(agent.status)}>{agent.status}</Badge>
                </div>
              </div>
            </section>

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                Capabilities
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.capabilities.length ? (
                  agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded-full border border-edge bg-canvas-raised px-2.5 py-0.5 font-mono text-[10px] text-ink-secondary"
                    >
                      {cap}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-ink-tertiary">No capabilities recorded.</p>
                )}
              </div>
            </section>

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                Status
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isCurrent = agent.status === opt.value;
                  const isPending = pendingStatus === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={isCurrent ? "primary" : "outline"}
                      disabled={isPending || isCurrent}
                      onClick={() => handleStatusChange(opt.value)}
                    >
                      {isPending ? "Updating..." : opt.label}
                    </Button>
                  );
                })}
              </div>
              {statusError ? (
                <p className="mt-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">
                  {statusError}
                </p>
              ) : null}
            </section>

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                Recent activity
              </p>
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
                      {entry.task_title}
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
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
