"use client";

import * as React from "react";
import { MoreHorizontal, Plus, UserPlus } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/cn";
import {
  attachAgentToProject,
  createProjectAgent,
  detachAgentFromProject,
} from "@/lib/api-client";

import type { ProjectStaffingAgent, ProjectStaffingSummary } from "@sentientops/contracts";

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
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
  return `${days}d ago`;
}

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

type AgentsGridProps = {
  projectId: string | null;
  staffing: ProjectStaffingSummary | null;
  onChanged: () => Promise<void> | void;
};

export function AgentsGrid({ projectId, staffing, onChanged }: AgentsGridProps) {
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const attached = React.useMemo<ProjectStaffingAgent[]>(() => {
    if (!staffing) return [];
    const items = [
      ...staffing.workers,
      ...staffing.evaluators,
      ...staffing.other_agents,
    ];
    const dedup = new Map<string, ProjectStaffingAgent>();
    for (const agent of items) dedup.set(agent.id, agent);
    return Array.from(dedup.values());
  }, [staffing]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardSubtitle>Roster</CardSubtitle>
          <CardTitle>Agents attached</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!projectId}
            onClick={() => setAttachOpen(true)}
          >
            <UserPlus className="h-4 w-4" /> Attach agent
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!projectId}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create new
          </Button>
        </div>
      </CardHeader>

      {!projectId ? (
        <p className="text-sm text-ink-tertiary">Select a project to view its roster.</p>
      ) : attached.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge bg-canvas-inset p-6 text-center">
          <p className="text-sm font-semibold text-ink">No agents attached</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Attach an existing agent or create a new one to start staffing this project.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
              <UserPlus className="h-4 w-4" /> Attach agent
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create new
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attached.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              projectId={projectId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <AttachAgentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        projectId={projectId}
        candidates={staffing?.attachable_agents ?? []}
        onAttached={async () => {
          setAttachOpen(false);
          await onChanged();
        }}
      />

      <CreateAgentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        onCreated={async () => {
          setCreateOpen(false);
          await onChanged();
        }}
      />
    </Card>
  );
}

function AgentCard({
  agent,
  projectId,
  onChanged,
}: {
  agent: ProjectStaffingAgent;
  projectId: string;
  onChanged: () => Promise<void> | void;
}) {
  const actor = useActor();
  const [busy, setBusy] = React.useState(false);

  async function handleDetach() {
    setBusy(true);
    try {
      await detachAgentFromProject(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId,
        agent.id
      );
      await onChanged();
    } catch {
      // surfaced upstream via query refresh / errors — keep UI quiet here.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-inset flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs font-bold">{initials(agent.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{agent.name}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-ghost">{agent.id}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={busy}
              aria-label="Agent actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void handleDetach()} disabled={busy}>
              Detach from project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>View profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Change role</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={roleTone(agent.role)}>{agent.role}</Badge>
        <Badge tone={agent.type === "platform_side" ? "info" : "neutral"}>{agent.type.replace("_", " ")}</Badge>
        <Badge tone={statusTone(agent.status)}>{agent.status}</Badge>
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
        <span>last active {relativeFromNow(agent.updated_at)}</span>
        <span>
          {agent.assigned_task_count}a · {agent.completed_task_count}c
        </span>
      </div>
    </div>
  );
}

function AttachAgentDialog({
  open,
  onOpenChange,
  projectId,
  candidates,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  candidates: ProjectStaffingAgent[];
  onAttached: () => Promise<void> | void;
}) {
  const actor = useActor();
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setRoleFilter("all");
      setPickedId(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    return candidates.filter((agent) => {
      if (roleFilter !== "all" && agent.role !== roleFilter) return false;
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        agent.name.toLowerCase().includes(term) ||
        agent.id.toLowerCase().includes(term) ||
        agent.role.toLowerCase().includes(term)
      );
    });
  }, [candidates, roleFilter, search]);

  async function submit() {
    if (!projectId || !pickedId) {
      setError("Pick an agent first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await attachAgentToProject(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId,
        pickedId
      );
      await onAttached();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach agent</DialogTitle>
          <DialogDescription>Pick an unassigned agent from the registry.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_140px] gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, id, or role"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="evaluator">Evaluator</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="max-h-[280px] rounded-xl border border-edge bg-canvas-inset">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-tertiary">
                No matching agents.
              </p>
            ) : (
              filtered.map((agent) => {
                const selected = agent.id === pickedId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setPickedId(agent.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition",
                      selected ? "bg-signal-dim" : "hover:bg-canvas-raised"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] font-bold">
                        {initials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{agent.name}</p>
                      <p className="truncate font-mono text-[10px] text-ink-tertiary">
                        {agent.role} · {agent.type} · {agent.status}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="sm"
            disabled={!pickedId || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Attaching..." : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAgentSheet({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onCreated: () => Promise<void> | void;
}) {
  const actor = useActor();
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<"manager" | "worker" | "evaluator">("worker");
  const [type, setType] = React.useState<"project_side" | "platform_side">("project_side");
  const [capabilities, setCapabilities] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive" | "paused">("active");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setRole("worker");
      setType("project_side");
      setCapabilities("");
      setStatus("active");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function submit() {
    if (!projectId) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProjectAgent(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId,
        {
          name: name.trim(),
          role,
          type,
          capabilities: capabilities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          status,
        }
      );
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create agent</SheetTitle>
          <SheetDescription>
            Materialize a new agent inside this project. Capabilities are comma-separated tags.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="QA-Worker-01"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="evaluator">Evaluator</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_side">Project side</SelectItem>
                  <SelectItem value="platform_side">Platform side</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Capabilities">
            <Input
              value={capabilities}
              onChange={(event) => setCapabilities(event.target.value)}
              placeholder="comma, separated, tags"
            />
          </Field>

          <Field label="Status">
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={submitting} onClick={() => void submit()}>
              {submitting ? "Creating..." : "Create agent"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}
