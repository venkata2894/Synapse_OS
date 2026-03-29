export const TASK_STATUSES = [
  "backlog",
  "ready",
  "assigned",
  "in_progress",
  "awaiting_handover",
  "under_review",
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
  created_at: string;
  updated_at: string;
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

export * from "./generated/openapi";
