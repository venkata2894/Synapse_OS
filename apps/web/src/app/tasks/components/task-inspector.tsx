"use client";

import * as React from "react";
import type {
  AgentContract,
  BoardCard,
  EvaluationContract,
  TaskTimelineResponse,
  TaskStatus,
} from "@sentientops/contracts";

import { Badge } from "@/components/ui/badge";
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
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { WorklogComposer } from "@/components/worklog-composer";
import { averageEvaluationScore } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { TASK_STATUS_LABELS } from "@/lib/status";

interface TaskInspectorProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  card: BoardCard | null;
  timeline: TaskTimelineResponse | null;
  timelineLoading: boolean;
  agents: AgentContract[];
  allowedTransitions: TaskStatus[];
  isMutating: boolean;
  actionError: string | null;
  onTransition: (
    target: TaskStatus,
    options: { reason?: string; blockerReason?: string; assignedTo?: string }
  ) => Promise<void>;
  onAppendWorklog: (payload: {
    task_id: string;
    agent_id: string;
    action_type: string;
    summary: string;
    detailed_log: string;
    artifacts: string[];
    confidence: number;
  }) => Promise<void>;
  onRequestEvaluation?: () => void;
  cardsById: Map<string, BoardCard>;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "—";
  return date.toLocaleString();
}

function readString(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/**
 * Right-side inspector Sheet (480px) with Overview/Activity/Evaluation/Memory tabs.
 * Spec §7.6 — sections each fit one viewport so no nested scroll-past.
 */
export function TaskInspector({
  open,
  onOpenChange,
  card,
  timeline,
  timelineLoading,
  agents,
  allowedTransitions,
  isMutating,
  actionError,
  onTransition,
  onAppendWorklog,
  onRequestEvaluation,
  cardsById,
}: TaskInspectorProps): React.ReactElement {
  const [transitionTarget, setTransitionTarget] = React.useState<TaskStatus | "">("");
  const [transitionReason, setTransitionReason] = React.useState("");
  const [blockerReason, setBlockerReason] = React.useState("");
  const [assignTarget, setAssignTarget] = React.useState("");

  React.useEffect(() => {
    setTransitionTarget("");
    setTransitionReason("");
    setBlockerReason("");
    setAssignTarget(card?.assigned_to ?? "");
  }, [card?.id, card?.assigned_to]);

  React.useEffect(() => {
    if (!card) return;
    if (!transitionTarget || !allowedTransitions.includes(transitionTarget)) {
      setTransitionTarget(allowedTransitions[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTransitions, card?.id]);

  const taskDetails = timeline?.task ?? null;
  const evaluations = timeline?.evaluations ?? [];
  const transitions = timeline?.transitions ?? [];
  const handovers = (timeline?.handovers ?? []) as Array<Record<string, unknown>>;
  const worklogs = (timeline?.worklogs ?? []) as Array<Record<string, unknown>>;
  const memoryEntries = (timeline?.memory ?? []) as Array<Record<string, unknown>>;
  const dependencyIds: string[] = taskDetails?.dependencies ?? [];
  const latestEvaluation: EvaluationContract | null = evaluations[0] ?? null;

  const submitTransition = async () => {
    if (!card || !transitionTarget) return;
    if (transitionTarget === "assigned" && !assignTarget) return;
    if (transitionTarget === "blocked" && !blockerReason.trim()) return;
    await onTransition(transitionTarget, {
      reason: transitionReason.trim() || undefined,
      blockerReason:
        transitionTarget === "blocked" ? blockerReason.trim() : undefined,
      assignedTo: transitionTarget === "assigned" ? assignTarget : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]"
      >
        {!card ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-ink-tertiary">No task selected.</p>
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2 border-b border-edge px-5 pt-6 pb-4">
              <div className="flex items-start gap-2">
                <SheetTitle className="flex-1 pr-6 text-base font-semibold leading-tight">
                  {card.title}
                </SheetTitle>
                <StatusPill status={card.status} />
              </div>
              <SheetDescription className="font-mono text-[10px] text-ink-ghost">
                {card.id} · updated {formatDate(card.updated_at)}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="mx-5 mt-3 h-9 w-fit">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                <TabsTrigger value="memory">Memory</TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="soft-scroll flex-1 space-y-4 overflow-y-auto px-5 pt-3 pb-6"
              >
                {timelineLoading && !taskDetails ? (
                  <p className="text-xs text-ink-ghost">Loading task…</p>
                ) : null}

                {taskDetails?.description ? (
                  <section className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                      Description
                    </p>
                    <p className="text-sm text-ink-secondary">
                      {taskDetails.description}
                    </p>
                  </section>
                ) : null}

                <section className="space-y-2 rounded-xl border border-edge bg-canvas-inset/60 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Transition Builder
                  </p>
                  <div className="grid gap-2">
                    <Select
                      value={transitionTarget || undefined}
                      onValueChange={(value) =>
                        setTransitionTarget(value as TaskStatus)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select next status" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTransitions.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No transitions available
                          </SelectItem>
                        ) : (
                          allowedTransitions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {TASK_STATUS_LABELS[status]}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {transitionTarget === "assigned" ? (
                      <Select
                        value={assignTarget || undefined}
                        onValueChange={(value) => setAssignTarget(value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select worker" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} ({agent.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}

                    {transitionTarget === "blocked" ? (
                      <Textarea
                        value={blockerReason}
                        onChange={(event) =>
                          setBlockerReason(event.target.value)
                        }
                        placeholder="Blocker reason (required)"
                      />
                    ) : null}

                    <Textarea
                      value={transitionReason}
                      onChange={(event) =>
                        setTransitionReason(event.target.value)
                      }
                      placeholder="Reason (optional)"
                    />

                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={isMutating || !transitionTarget}
                      onClick={() => void submitTransition()}
                    >
                      {isMutating ? "Applying…" : "Apply Transition"}
                    </Button>
                    {actionError ? (
                      <p className="rounded-md border border-danger/30 bg-danger-dim px-2 py-1 text-[11px] text-danger">
                        {actionError}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-2 rounded-xl border border-edge bg-canvas-inset/60 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Dependencies
                  </p>
                  {dependencyIds.length === 0 ? (
                    <p className="text-xs text-ink-ghost">No dependencies.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {dependencyIds.map((depId) => {
                        const dep = cardsById.get(depId);
                        return (
                          <li
                            key={depId}
                            className="flex items-center justify-between gap-2 rounded-md border border-edge bg-canvas-base px-2 py-1.5 font-mono text-[11px]"
                          >
                            <span className="line-clamp-1 text-ink-secondary">
                              {dep?.title ?? "Unresolved dependency"}
                            </span>
                            {dep ? (
                              <StatusPill status={dep.status} />
                            ) : (
                              <Badge tone="neutral">missing</Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="space-y-2 rounded-xl border border-edge bg-canvas-inset/60 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Blocker
                  </p>
                  {card.blocker_reason ? (
                    <p className="rounded-md border border-danger/30 bg-danger-dim px-2 py-1.5 text-xs text-danger">
                      {card.blocker_reason}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-ghost">No active blocker.</p>
                  )}
                </section>
              </TabsContent>

              <TabsContent
                value="activity"
                className="soft-scroll flex-1 space-y-4 overflow-y-auto px-5 pt-3 pb-6"
              >
                {taskDetails ? (
                  <WorklogComposer
                    title="Log this transition"
                    tasks={[taskDetails]}
                    agents={agents}
                    initialTaskId={taskDetails.id}
                    initialAgentId={taskDetails.assigned_to ?? agents[0]?.id}
                    presetActionType="progress"
                    submitLabel="Append to timeline"
                    disabledReason={
                      agents.length ? null : "No project agents attached."
                    }
                    onSubmit={onAppendWorklog}
                  />
                ) : null}

                <section className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Worklog
                  </p>
                  {worklogs.length === 0 ? (
                    <p className="text-xs text-ink-ghost">No entries.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {worklogs.map((entry, index) => (
                        <li
                          key={readString(entry["id"], `worklog-${index}`)}
                          className="rounded-md border border-edge bg-canvas-base p-2 font-mono text-[11px]"
                        >
                          <p className="text-ink-secondary">
                            <span className="text-signal">
                              {readString(entry["action_type"]).toUpperCase()}
                            </span>{" "}
                            · {readString(entry["summary"])}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            {formatDate(readString(entry["timestamp"], ""))}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Handovers
                  </p>
                  {handovers.length === 0 ? (
                    <p className="text-xs text-ink-ghost">No handovers.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {handovers.map((entry, index) => (
                        <li
                          key={readString(entry["id"], `handover-${index}`)}
                          className="rounded-md border border-edge bg-canvas-base p-2 font-mono text-[11px]"
                        >
                          <p className="text-ink-secondary">
                            {readString(entry["from_agent_id"])} →{" "}
                            {readString(entry["to_agent_id"])}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            {readString(entry["pending_work"])}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            {formatDate(readString(entry["timestamp"], ""))}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                    Transitions
                  </p>
                  {transitions.length === 0 ? (
                    <p className="text-xs text-ink-ghost">No transitions yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {transitions.map((transition) => (
                        <li
                          key={transition.id}
                          className="rounded-md border border-edge bg-canvas-base p-2 font-mono text-[11px]"
                        >
                          <p className="text-ink-secondary">
                            {transition.from_status} → {transition.to_status}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            actor: {transition.actor_id}
                            {transition.reason
                              ? ` · ${transition.reason}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            {formatDate(transition.timestamp)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </TabsContent>

              <TabsContent
                value="evaluation"
                className="soft-scroll flex-1 space-y-4 overflow-y-auto px-5 pt-3 pb-6"
              >
                {latestEvaluation ? (
                  <section className="space-y-2 rounded-xl border border-edge bg-canvas-inset/60 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                      Latest score
                    </p>
                    <p className="font-mono text-3xl font-bold text-signal">
                      {averageEvaluationScore(latestEvaluation).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink-secondary">
                      Evaluator: {latestEvaluation.evaluator_agent_id}
                    </p>
                    <p className="font-mono text-[11px] text-ink-ghost">
                      {formatDate(latestEvaluation.timestamp)}
                    </p>
                    {latestEvaluation.override_reason ? (
                      <p className="text-xs text-warn">
                        Override: {latestEvaluation.override_reason}
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <section className="space-y-2 rounded-xl border border-edge bg-canvas-inset/60 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                      No evaluation yet
                    </p>
                    <p className="text-xs text-ink-secondary">
                      {card.status === "completed"
                        ? "Task completed — request an evaluation."
                        : "Evaluations run after completion or under-review."}
                    </p>
                    {onRequestEvaluation ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={onRequestEvaluation}
                      >
                        Request evaluation
                      </Button>
                    ) : (
                      <p className="font-mono text-[11px] text-ink-ghost">—</p>
                    )}
                  </section>
                )}

                {evaluations.length > 1 ? (
                  <section className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                      History
                    </p>
                    <ul className="space-y-1.5">
                      {evaluations.slice(1).map((evaluation) => (
                        <li
                          key={evaluation.id}
                          className="rounded-md border border-edge bg-canvas-base p-2 font-mono text-[11px]"
                        >
                          <p className="text-ink-secondary">
                            avg{" "}
                            {averageEvaluationScore(evaluation).toFixed(2)} ·{" "}
                            {evaluation.evaluator_agent_id}
                          </p>
                          <p className="mt-0.5 text-ink-ghost">
                            {formatDate(evaluation.timestamp)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </TabsContent>

              <TabsContent
                value="memory"
                className={cn(
                  "soft-scroll flex-1 space-y-3 overflow-y-auto px-5 pt-3 pb-6"
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                  Memory promotions
                </p>
                {memoryEntries.length === 0 ? (
                  <p className="text-xs text-ink-ghost">
                    — no memory entries surfaced for this task.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {memoryEntries.map((entry, index) => (
                      <li
                        key={readString(entry["id"], `memory-${index}`)}
                        className="rounded-md border border-edge bg-canvas-base p-2 text-[11px]"
                      >
                        <p className="font-medium text-ink-secondary">
                          {readString(entry["title"])}
                        </p>
                        <p className="mt-0.5 text-ink-ghost">
                          {readString(entry["content"])}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
