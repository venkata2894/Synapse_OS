import type { TaskStatus } from "@sentientops/contracts";
import { TASK_STATUSES } from "@sentientops/contracts";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  intake: "Intake",
  backlog: "Backlog",
  ready: "Ready",
  assigned: "Assigned",
  in_progress: "In Progress",
  awaiting_handover: "Awaiting Handover",
  under_review: "Under Review",
  evaluation: "Evaluation",
  blocked: "Blocked",
  completed: "Completed",
  reopened: "Reopened"
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  intake: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  backlog: "border-ink-ghost/60 bg-ink-ghost/10 text-ink-secondary",
  ready: "border-info/30 bg-info-dim text-info",
  assigned: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  in_progress: "border-signal/30 bg-signal-dim text-signal",
  awaiting_handover: "border-indigo-400/30 bg-indigo-400/10 text-indigo-300",
  under_review: "border-warn/30 bg-warn-dim text-warn",
  evaluation: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
  blocked: "border-danger/30 bg-danger-dim text-danger",
  completed: "border-ok/30 bg-ok-dim text-ok",
  reopened: "border-orange-400/30 bg-orange-400/10 text-orange-300"
};

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status]
}));
