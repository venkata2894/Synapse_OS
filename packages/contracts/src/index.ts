export const TASK_STATUSES = [
  "intake",
  "backlog",
  "ready",
  "assigned",
  "in_progress",
  "awaiting_handover",
  "under_review",
  "evaluation",
  "blocked",
  "completed",
  "reopened"
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ProjectContract {
  id: string;
  name: string;
  description: string;
  objective: string;
  status: "active" | "archived" | "paused";
  owner: string;
  manager_agent_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AgentContract {
  id: string;
  name: string;
  role: "owner" | "manager" | "worker" | "evaluator";
  type: "project_side" | "platform_side";
  project_id: string | null;
  capabilities: string[];
  status: "active" | "inactive" | "paused";
  memory_profile_id?: string | null;
  evaluation_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskContract {
  id: string;
  project_id: string;
  title: string;
  description: string;
  created_by: string;
  assigned_to: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: TaskStatus;
  dependencies: string[];
  acceptance_criteria: string;
  context_refs: string[];
  parent_task_id: string | null;
  blocker_reason: string | null;
  parent_task_depth?: number;
  evaluation_queued?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationContract {
  id: string;
  project_id: string;
  task_id: string;
  agent_id: string;
  evaluator_agent_id: string;
  score_completion: number;
  score_quality: number;
  score_reliability: number;
  score_handover: number;
  score_context: number;
  score_clarity: number;
  score_improvement: number;
  missed_points: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string;
  timestamp: string;
  override_reason?: string;
  override_audit_entries?: Array<{
    evaluation_id: string;
    owner_id: string;
    reason: string;
    original_scores: Record<string, number>;
    override_scores: Record<string, number>;
    timestamp: string;
  }>;
}

export interface ListResponse<T> {
  items: T[];
  count: number;
}

export interface DashboardSummary {
  totals: {
    active_projects: number;
    tasks_in_progress: number;
    blocked_tasks: number;
    recent_handovers: number;
    low_score_alerts: number;
  };
  alerts: {
    blocked_tasks: TaskContract[];
    low_scores: Array<{
      evaluation_id: string;
      agent_id: string;
      avg: number;
    }>;
  };
  projects: Array<{
    project_id: string;
    name: string;
    status: string;
    task_count: number;
    blocked_count: number;
    evaluation_count: number;
  }>;
  recent_handovers: Array<Record<string, unknown>>;
  recent_evaluations: EvaluationContract[];
}

export interface TaskLane {
  status: TaskStatus;
  title: string;
  items: TaskContract[];
}

export interface BoardCard {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: TaskStatus;
  assigned_to: string | null;
  blocker_reason: string | null;
  dependency_count: number;
  updated_at: string;
}

export interface BoardLane {
  status: TaskStatus | string;
  label: string;
  wip_limit: number;
  count: number;
  blocked_count: number;
  cards: BoardCard[];
}

export interface BoardSnapshot {
  project_id: string;
  project_name: string;
  generated_at: string;
  lanes: BoardLane[];
  counters: {
    total_tasks: number;
    blocked_tasks: number;
    in_progress_tasks: number;
  };
}

export interface TaskTransitionRecord {
  id: string;
  task_id: string;
  project_id: string;
  from_status: string;
  to_status: string;
  actor_id: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface TaskTimelineResponse {
  task: TaskContract;
  worklogs: Array<Record<string, unknown>>;
  handovers: Array<Record<string, unknown>>;
  transitions: TaskTransitionRecord[];
  evaluations: EvaluationContract[];
  memory: Array<Record<string, unknown>>;
}

export interface TaskTransitionResponse {
  task: TaskContract;
  transition: TaskTransitionRecord;
  evaluation_queued: boolean;
}

export interface ProcessTemplate {
  name: string;
  workflow_stages: string[];
  transition_matrix: Record<string, string[]>;
  wip_limits: Record<string, number>;
}

export interface StreamEventEnvelope {
  type: string;
  project_id: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
}

export interface AgentToolManifest {
  kind: "agent_tool_manifest";
  version: "v1";
  tool_count: number;
  tools: AgentToolDefinition[];
}

export interface AgentToolCallEnvelope {
  tool: string;
  actor: {
    actor_id: string;
    role: string;
    auth_mode: string;
  };
  result: Record<string, unknown>;
}

export interface ToolRunRecord {
  id: string;
  tool: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
  timestamp: string;
  success: boolean;
}

export * from "./generated/openapi";
