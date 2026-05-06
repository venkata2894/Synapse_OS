import * as React from "react";
import type { TaskStatus } from "@sentientops/contracts";
import { Badge } from "./badge";

const STATUS_TONE: Record<string, "signal" | "warn" | "danger" | "info" | "accent" | "neutral"> = {
  intake: "neutral",
  backlog: "neutral",
  ready: "info",
  assigned: "info",
  in_progress: "warn",
  awaiting_handover: "accent",
  under_review: "accent",
  evaluation: "accent",
  blocked: "danger",
  completed: "signal",
  reopened: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  intake: "Intake",
  backlog: "Backlog",
  ready: "Ready",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_handover: "Awaiting handover",
  under_review: "Under review",
  evaluation: "Evaluation",
  blocked: "Blocked",
  completed: "Completed",
  reopened: "Reopened",
};

export function StatusPill({ status }: { status: TaskStatus | string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status] ?? status}</Badge>;
}
