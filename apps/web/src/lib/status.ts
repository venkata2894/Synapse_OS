import type { TaskStatus } from "@sentientops/contracts";
import { TASK_STATUSES } from "@sentientops/contracts";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  assigned: "Assigned",
  in_progress: "In Progress",
  awaiting_handover: "Awaiting Handover",
  under_review: "Under Review",
  blocked: "Blocked",
  completed: "Completed",
  reopened: "Reopened"
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "border-slate-300/35 bg-slate-500/10 text-slate-200",
  ready: "border-blue-300/35 bg-blue-500/10 text-blue-100",
  assigned: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
  in_progress: "border-teal-300/35 bg-teal-500/10 text-teal-100",
  awaiting_handover: "border-indigo-300/35 bg-indigo-500/10 text-indigo-100",
  under_review: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  blocked: "border-rose-300/35 bg-rose-500/12 text-rose-100",
  completed: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
  reopened: "border-orange-300/35 bg-orange-500/12 text-orange-100"
};

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status]
}));
