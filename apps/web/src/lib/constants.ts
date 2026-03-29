export const KANBAN_STATUSES = [
  "Backlog",
  "Ready",
  "Assigned",
  "In Progress",
  "Awaiting Handover",
  "Under Review",
  "Blocked",
  "Completed",
  "Reopened"
] as const;

export const DEMO_ALERTS = [
  { id: "a1", type: "blocked", message: "2 tasks are blocked in Project Atlas." },
  { id: "a2", type: "low_score", message: "Worker Agent W-12 scored below threshold in last 3 evaluations." }
] as const;

