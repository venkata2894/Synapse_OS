"use client";

import * as React from "react";
import { ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { createHandover, listProjectHandovers } from "@/lib/api-client";

import type {
  ProjectStaffingAgent,
  TaskContract,
  WorklogEntry,
} from "@sentientops/contracts";

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type HandoversTabProps = {
  projectId: string | null;
  tasks: TaskContract[];
  agents: ProjectStaffingAgent[];
  refreshSignal: number;
};

export function HandoversTab({
  projectId,
  tasks,
  agents,
  refreshSignal,
}: HandoversTabProps) {
  const actor = useActor();
  const [createOpen, setCreateOpen] = React.useState(false);

  const handoverQuery = usePollingQuery(
    () =>
      listProjectHandovers(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        projectId as string,
        25
      ),
    `handovers:${actor.actorId}:${projectId ?? "_"}`,
    { enabled: actor.ready && Boolean(projectId), intervalMs: 30_000 }
  );

  React.useEffect(() => {
    if (refreshSignal && projectId) void handoverQuery.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const items: WorklogEntry[] = handoverQuery.data?.items ?? [];

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
          Recent handovers
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!projectId}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Create handover
        </Button>
      </div>

      {!projectId ? (
        <p className="rounded-lg border border-dashed border-edge bg-canvas-inset p-3 text-xs text-ink-tertiary">
          Select a project first.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge bg-canvas-inset p-3 text-xs text-ink-tertiary">
          No handovers logged yet for this project.
        </p>
      ) : (
        <ScrollArea className="max-h-[360px]">
          <div className="space-y-2">
            {items.map((entry) => (
              <HandoverRow key={entry.id} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateHandoverDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        tasks={tasks}
        agents={agents}
        onCreated={async () => {
          setCreateOpen(false);
          await handoverQuery.refresh();
        }}
      />
    </div>
  );
}

function HandoverRow({ entry }: { entry: WorklogEntry }) {
  return (
    <div className="rounded-lg border border-edge bg-canvas-inset p-3">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
        <span className="rounded bg-accent-dim px-1.5 py-0.5 text-accent">handover</span>
        <span title={new Date(entry.timestamp).toLocaleString()}>{shortDate(entry.timestamp)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-secondary">
        <span className="truncate font-semibold text-ink">{entry.agent_name}</span>
        <ArrowRight className="h-3 w-3 text-ink-tertiary" />
        <span className="truncate text-ink">{entry.task_title}</span>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-ink">{entry.summary}</p>
    </div>
  );
}

function CreateHandoverDialog({
  open,
  onOpenChange,
  projectId,
  tasks,
  agents,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  tasks: TaskContract[];
  agents: ProjectStaffingAgent[];
  onCreated: () => Promise<void> | void;
}) {
  const actor = useActor();
  const [taskId, setTaskId] = React.useState("");
  const [fromAgentId, setFromAgentId] = React.useState("");
  const [toAgentId, setToAgentId] = React.useState("");
  const [completedWork, setCompletedWork] = React.useState("");
  const [pendingWork, setPendingWork] = React.useState("");
  const [blockers, setBlockers] = React.useState("None.");
  const [risks, setRisks] = React.useState("None.");
  const [nextSteps, setNextSteps] = React.useState("");
  const [confidence, setConfidence] = React.useState(0.8);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setTaskId("");
      setFromAgentId("");
      setToAgentId("");
      setCompletedWork("");
      setPendingWork("");
      setBlockers("None.");
      setRisks("None.");
      setNextSteps("");
      setConfidence(0.8);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function submit() {
    if (!projectId) return;
    if (!taskId) {
      setError("Pick a task.");
      return;
    }
    if (!fromAgentId || !toAgentId) {
      setError("Pick both source and destination agents.");
      return;
    }
    if (fromAgentId === toAgentId) {
      setError("Source and destination agents must differ.");
      return;
    }
    if (!completedWork.trim() || !pendingWork.trim() || !nextSteps.trim()) {
      setError("Completed work, pending work, and next steps are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createHandover(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        {
          task_id: taskId,
          project_id: projectId,
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          completed_work: completedWork.trim(),
          pending_work: pendingWork.trim(),
          blockers: blockers.trim() || "None.",
          risks: risks.trim() || "None.",
          next_steps: nextSteps.trim(),
          confidence,
        }
      );
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handover failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create handover</DialogTitle>
          <DialogDescription>
            Capture a structured handover between agents on a task.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Task" required>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From agent" required>
              <Select value={fromAgentId} onValueChange={setFromAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick source" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="To agent" required>
              <Select value={toAgentId} onValueChange={setToAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick destination" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Completed work" required>
            <Textarea
              value={completedWork}
              onChange={(event) => setCompletedWork(event.target.value)}
              placeholder="What's done."
            />
          </Field>
          <Field label="Pending work" required>
            <Textarea
              value={pendingWork}
              onChange={(event) => setPendingWork(event.target.value)}
              placeholder="What's outstanding."
            />
          </Field>
          <Field label="Next steps" required>
            <Textarea
              value={nextSteps}
              onChange={(event) => setNextSteps(event.target.value)}
              placeholder="What the next agent should do first."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Blockers">
              <Input value={blockers} onChange={(event) => setBlockers(event.target.value)} />
            </Field>
            <Field label="Risks">
              <Input value={risks} onChange={(event) => setRisks(event.target.value)} />
            </Field>
          </div>
          <Field label={`Confidence (${(confidence * 100).toFixed(0)}%)`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-canvas-raised accent-signal"
            />
          </Field>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" size="sm" disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Saving..." : "Create handover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
