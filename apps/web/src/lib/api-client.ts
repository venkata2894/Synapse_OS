import type {
  AgentContract,
  AgentToolCallEnvelope,
  AgentToolManifest,
  BoardSnapshot,
  DashboardSummary,
  EvaluationContract,
  ListResponse,
  ProcessTemplate,
  ProjectContract,
  ProjectStaffingSummary,
  TaskContract,
  TaskTimelineResponse,
  TaskTransitionResponse,
  WorklogEntry,
  WorklogListResponse
} from "@sentientops/contracts";

type ActorContext = {
  actorId: string;
  actorRole?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || `Request failed: ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

function actorHeaders(actor: ActorContext): Headers {
  const headers = new Headers();
  headers.set("X-Actor-Id", actor.actorId);
  headers.set("X-Actor-Role", actor.actorRole ?? "owner");
  return headers;
}

export async function getDashboardSummary(actor: ActorContext): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>("/dashboard/summary", {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listProjects(actor: ActorContext): Promise<ListResponse<ProjectContract>> {
  return requestJson<ListResponse<ProjectContract>>("/projects", {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function getProject(actor: ActorContext, projectId: string): Promise<ProjectContract> {
  return requestJson<ProjectContract>(`/projects/${projectId}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function getProjectStaffing(actor: ActorContext, projectId: string): Promise<ProjectStaffingSummary> {
  return requestJson<ProjectStaffingSummary>(`/projects/${projectId}/staffing`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function createProjectAgent(
  actor: ActorContext,
  projectId: string,
  payload: {
    name: string;
    role: "manager" | "worker" | "evaluator";
    type: "project_side" | "platform_side";
    capabilities: string[];
    status: "active" | "inactive" | "paused";
  }
): Promise<AgentContract> {
  return requestJson<AgentContract>(`/projects/${projectId}/agents`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
}

export async function attachAgentToProject(
  actor: ActorContext,
  projectId: string,
  agentId: string
): Promise<AgentContract> {
  return requestJson<AgentContract>(`/projects/${projectId}/agents/attach`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ agent_id: agentId })
  });
}

export async function detachAgentFromProject(
  actor: ActorContext,
  projectId: string,
  agentId: string
): Promise<{ agent: AgentContract; project: ProjectContract }> {
  return requestJson<{ agent: AgentContract; project: ProjectContract }>(`/projects/${projectId}/agents/${agentId}/detach`, {
    method: "POST",
    headers: actorHeaders(actor)
  });
}

export async function assignProjectManager(
  actor: ActorContext,
  projectId: string,
  managerAgentId: string
): Promise<ProjectContract> {
  return requestJson<ProjectContract>(`/projects/${projectId}/manager`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ manager_agent_id: managerAgentId })
  });
}

export async function updateAgentStatus(
  actor: ActorContext,
  agentId: string,
  status: "active" | "inactive" | "paused"
): Promise<AgentContract> {
  return requestJson<AgentContract>(`/agents/${agentId}/status`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ status })
  });
}

export async function listTasks(
  actor: ActorContext,
  filters: { projectId?: string; status?: string; assignedTo?: string; limit?: number; offset?: number } = {}
): Promise<ListResponse<TaskContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<TaskContract>>(`/tasks${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listAgents(
  actor: ActorContext,
  filters: { projectId?: string; role?: string; limit?: number; offset?: number } = {}
): Promise<ListResponse<AgentContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.role) params.set("role", filters.role);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<AgentContract>>(`/agents${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listEvaluations(
  actor: ActorContext,
  filters: { projectId?: string; agentId?: string; limit?: number; offset?: number } = {}
): Promise<ListResponse<EvaluationContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.agentId) params.set("agent_id", filters.agentId);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<EvaluationContract>>(`/evaluations${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function requestEvaluation(
  actor: ActorContext,
  payload: {
    project_id: string;
    task_id: string;
    agent_id: string;
    requested_by: string;
  }
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/evaluations/request", {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
}

export async function fetchTaskContext(agentApiKey: string, taskId: string): Promise<Record<string, unknown>> {
  return callAgentTool(agentApiKey, "fetch_task_context", { task_id: taskId });
}

export async function getBoard(actor: ActorContext, projectId: string): Promise<BoardSnapshot> {
  return requestJson<BoardSnapshot>(`/boards/${projectId}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function transitionTask(
  actor: ActorContext,
  taskId: string,
  payload: {
    target_status: string;
    reason?: string;
    blocker_reason?: string;
    metadata?: Record<string, unknown>;
    assigned_to?: string;
  }
): Promise<TaskTransitionResponse> {
  return requestJson<TaskTransitionResponse>(`/tasks/${taskId}/transition`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
}

export async function getTaskTimeline(actor: ActorContext, taskId: string): Promise<TaskTimelineResponse> {
  return requestJson<TaskTimelineResponse>(`/tasks/${taskId}/timeline`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listWorklogs(
  actor: ActorContext,
  filters: { projectId?: string; taskId?: string; agentId?: string; actionType?: string; limit?: number; offset?: number } = {}
): Promise<WorklogListResponse> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.taskId) params.set("task_id", filters.taskId);
  if (filters.agentId) params.set("agent_id", filters.agentId);
  if (filters.actionType) params.set("action_type", filters.actionType);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<WorklogListResponse>(`/worklogs${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function appendWorklog(
  actor: ActorContext,
  payload: {
    task_id: string;
    agent_id: string;
    action_type: string;
    summary: string;
    detailed_log: string;
    artifacts: string[];
    confidence: number;
  }
): Promise<WorklogEntry> {
  return requestJson<WorklogEntry>("/worklogs", {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(actorHeaders(actor).entries()),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });
}

export async function getDefaultProcessTemplate(actor: ActorContext): Promise<ProcessTemplate> {
  return requestJson<ProcessTemplate>("/process/templates/default", {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function bootstrapProjectProcess(actor: ActorContext, projectId: string): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(`/projects/${projectId}/process/bootstrap`, {
    method: "POST",
    headers: actorHeaders(actor)
  });
}

export function openProjectEventStream(
  projectId: string,
  actorId: string,
  token?: string
): EventSource {
  const params = new URLSearchParams({ project_id: projectId });
  if (actorId) params.set("actor_id", actorId);
  if (token) params.set("token", token);
  return new EventSource(`${API_BASE_URL}/events/stream?${params.toString()}`);
}

export async function getAgentToolManifest(agentApiKey: string): Promise<AgentToolManifest> {
  return requestJson<AgentToolManifest>("/agent-tools/manifest", {
    method: "GET",
    headers: new Headers({ Authorization: `Bearer ${agentApiKey}` })
  });
}

export async function callAgentTool(
  agentApiKey: string,
  toolName: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): Promise<AgentToolCallEnvelope & Record<string, unknown>> {
  const headers = new Headers({
    Authorization: `Bearer ${agentApiKey}`,
    "Content-Type": "application/json"
  });
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }
  return requestJson<AgentToolCallEnvelope & Record<string, unknown>>(`/agent-tools/${toolName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

export function averageEvaluationScore(evaluation: EvaluationContract): number {
  const values = [
    evaluation.score_completion,
    evaluation.score_quality,
    evaluation.score_reliability,
    evaluation.score_handover,
    evaluation.score_context,
    evaluation.score_clarity,
    evaluation.score_improvement
  ];
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export { ApiError };
