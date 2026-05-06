import type { TaskStatus } from "@sentientops/contracts";

/**
 * Stage groups cluster the 8 workflow lanes under 4 caption labels per the
 * Dark Ops design spec §7.2. Discrete lanes preserve workflow integrity per
 * PRIMER.md while visually grouping related stages.
 *
 * `blocked` and `reopened` are intentionally NOT lanes here — they surface as
 * a banner and filter chip in the control bar.
 */
export type StageGroupKey = "intake" | "active" | "handoff" | "done";

export interface StageGroup {
  key: StageGroupKey;
  label: string;
  lanes: TaskStatus[];
  defaultCollapsed?: boolean;
}

export const STAGE_GROUPS: StageGroup[] = [
  {
    key: "intake",
    label: "INTAKE",
    lanes: ["intake", "ready"],
  },
  {
    key: "active",
    label: "ACTIVE",
    lanes: ["assigned", "in_progress"],
  },
  {
    key: "handoff",
    label: "HANDOFF",
    lanes: ["awaiting_handover", "under_review", "evaluation"],
  },
  {
    key: "done",
    label: "DONE",
    lanes: ["completed"],
    defaultCollapsed: true,
  },
];

export const ALL_GROUP_LANES: TaskStatus[] = STAGE_GROUPS.flatMap(
  (group) => group.lanes
);

/**
 * Fallback transition matrix used when the process template endpoint hasn't
 * loaded yet. Mirrors `services/workflow.py` defaults.
 */
export const FALLBACK_TRANSITION_MATRIX: Record<TaskStatus, TaskStatus[]> = {
  intake: ["ready", "blocked"],
  backlog: ["ready", "blocked"],
  ready: ["assigned", "blocked"],
  assigned: ["in_progress", "blocked"],
  in_progress: ["awaiting_handover", "under_review", "blocked"],
  awaiting_handover: ["under_review", "blocked"],
  under_review: ["evaluation", "reopened", "blocked"],
  evaluation: ["completed", "reopened"],
  blocked: [
    "ready",
    "assigned",
    "in_progress",
    "awaiting_handover",
    "under_review",
    "evaluation",
    "reopened",
  ],
  reopened: ["ready", "assigned", "in_progress"],
  completed: ["reopened"],
};
