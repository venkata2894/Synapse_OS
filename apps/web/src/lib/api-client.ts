import type {
  AgentContract,
  AgentToolCallEnvelope,
  AgentToolManifest,
  DashboardSummary,
  EvaluationContract,
  ListResponse,
  ProjectContract,
  TaskContract
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

export async function listTasks(
  actor: ActorContext,
  filters: { projectId?: string; status?: string; assignedTo?: string } = {}
): Promise<ListResponse<TaskContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<TaskContract>>(`/tasks${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listAgents(
  actor: ActorContext,
  filters: { projectId?: string; role?: string } = {}
): Promise<ListResponse<AgentContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.role) params.set("role", filters.role);
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<AgentContract>>(`/agents${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function listEvaluations(
  actor: ActorContext,
  filters: { projectId?: string; agentId?: string } = {}
): Promise<ListResponse<EvaluationContract>> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.agentId) params.set("agent_id", filters.agentId);
  const query = params.toString() ? `?${params.toString()}` : "";

  return requestJson<ListResponse<EvaluationContract>>(`/evaluations${query}`, {
    method: "GET",
    headers: actorHeaders(actor)
  });
}

export async function fetchTaskContext(agentApiKey: string, taskId: string): Promise<Record<string, unknown>> {
  return callAgentTool(agentApiKey, "fetch_task_context", { task_id: taskId });
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
