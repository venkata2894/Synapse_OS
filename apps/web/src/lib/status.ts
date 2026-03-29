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
  backlog: "border-slate-200 bg-slate-100 text-slate-700",
  ready: "border-blue-200 bg-blue-50 text-blue-700",
  assigned: "border-cyan-200 bg-cyan-50 text-cyan-700",
  in_progress: "border-teal-200 bg-teal-50 text-teal-700",
  awaiting_handover: "border-indigo-200 bg-indigo-50 text-indigo-700",
  under_review: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reopened: "border-orange-200 bg-orange-50 text-orange-700"
};

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status]
}));
