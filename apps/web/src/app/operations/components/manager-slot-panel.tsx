"use client";

import * as React from "react";
import { ShieldCheck, UserCog, UserPlus } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActor } from "@/hooks/use-actor";
import { cn } from "@/lib/cn";
import { assignProjectManager } from "@/lib/api-client";

import type {
  AgentContract,
  ProjectStaffingAgent,
  ProjectStaffingSummary,
} from "@sentientops/contracts";

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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

type ManagerSlotPanelProps = {
  projectId: string | null;
  staffing: ProjectStaffingSummary | null;
  candidateAgents: AgentContract[];
  onChanged: () => Promise<void> | void;
};

export function ManagerSlotPanel({
  projectId,
  staffing,
  candidateAgents,
  onChanged,
}: ManagerSlotPanelProps) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [reassignOpen, setReassignOpen] = React.useState(false);

  const manager = staffing?.manager ?? null;

  if (!projectId) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Manager slot</CardSubtitle>
            <CardTitle>Select a project</CardTitle>
          </div>
        </CardHeader>
        <p className="text-sm text-ink-tertiary">
          Choose a project from the rail to view or assign its manager.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardSubtitle>Manager slot</CardSubtitle>
          <CardTitle>Project manager</CardTitle>
        </div>
        {manager ? (
          <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
            <UserCog className="h-4 w-4" /> Reassign
          </Button>
        ) : null}
      </CardHeader>

      {manager ? (
        <FilledManager manager={manager} />
      ) : (
        <VacantManager onAssign={() => setAssignOpen(true)} />
      )}

      <AssignManagerDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        projectId={projectId}
        candidates={candidateAgents}
        onAssigned={async () => {
          setAssignOpen(false);
          await onChanged();
        }}
      />

      <AssignManagerDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        projectId={projectId}
        candidates={candidateAgents}
        currentManagerId={manager?.id ?? null}
        confirm
        onAssigned={async () => {
          setReassignOpen(false);
          await onChanged();
        }}
      />
    </Card>
  );
}

function FilledManager({ manager }: { manager: ProjectStaffingAgent }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="h-12 w-12">
        <AvatarFallback className="text-sm font-bold">{initials(manager.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink">{manager.name}</p>
          <Badge tone="info">{manager.role}</Badge>
          <Badge tone={manager.status === "active" ? "signal" : "neutral"}>
            {manager.status}
          </Badge>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          In role for {relativeFromNow(manager.updated_at)} ·{" "}
          {manager.assigned_task_count} assigned · {manager.completed_task_count} completed
        </p>
      </div>
    </div>
  );
}

function VacantManager({ onAssign }: { onAssign: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-edge bg-canvas-inset p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warn-dim text-warn">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">No manager assigned</p>
          <p className="text-xs text-ink-secondary">
            Pick an eligible agent to own the project.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onAssign}>
        <UserPlus className="h-4 w-4" /> Assign manager
      </Button>
    </div>
  );
}

function AssignManagerDialog({
  open,
  onOpenChange,
  projectId,
  candidates,
  currentManagerId,
  confirm,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  candidates: AgentContract[];
  currentManagerId?: string | null;
  confirm?: boolean;
  onAssigned: () => Promise<void> | void;
}) {
  const actor = useActor();
  const [search, setSearch] = React.useState("");
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setPickedId(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const eligible = React.useMemo(() => {
    return candidates.filter((agent) => {
      if (agent.id === currentManagerId) return false;
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        agent.name.toLowerCase().includes(term) ||
        agent.role.toLowerCase().includes(term) ||
        agent.id.toLowerCase().includes(term)
      );
    });
  }, [candidates, currentManagerId, search]);

  async function submit() {
    if (!pickedId) {
      setError("Pick an agent first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await assignProjectManager(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId,
        pickedId
      );
      await onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm ? "Reassign manager" : "Assign manager"}</DialogTitle>
          <DialogDescription>
            {confirm
              ? "V1 enforces one manager per project. Reassigning replaces the current manager immediately."
              : "Pick an eligible agent. Manager-capable roles are listed first."}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, role, or id"
        />

        <ScrollArea className="max-h-[280px] rounded-xl border border-edge bg-canvas-inset">
          <div className="p-1">
            {eligible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-tertiary">
                No eligible agents.
              </p>
            ) : (
              eligible.map((agent) => {
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
            {submitting
              ? "Assigning..."
              : confirm
                ? "Confirm reassignment"
                : "Assign manager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
