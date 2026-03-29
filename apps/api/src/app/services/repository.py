from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.models.enums import MemoryPromotionStatus, ProjectStatus
from app.schemas.agent import AgentCreate, AgentStatusUpdate, AgentUpdate
from app.schemas.evaluation import EvaluationCreate
from app.schemas.handover import HandoverCreate
from app.schemas.memory import MemoryPromotionRequest
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.task import TaskCreate
from app.schemas.worklog import WorklogCreate

PROJECTS: dict[str, dict] = {}
AGENTS: dict[str, dict] = {}
TASKS: dict[str, dict] = {}
WORKLOGS: dict[str, dict] = {}
HANDOVERS: dict[str, dict] = {}
MEMORY: dict[str, dict] = {}
EVALUATIONS: dict[str, dict] = {}
EVALUATION_QUEUE: list[dict] = []
EVALUATION_OVERRIDE_AUDIT: list[dict] = []
TASK_CHILDREN: dict[str, list[str]] = defaultdict(list)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_project(payload: ProjectCreate) -> dict:
    project_id = str(uuid4())
    record = payload.model_dump()
    record.update({"id": project_id, "manager_agent_id": None, "created_at": now_iso(), "updated_at": now_iso()})
    PROJECTS[project_id] = record
    return record


def update_project(project_id: str, payload: ProjectUpdate) -> dict:
    current = PROJECTS[project_id]
    updates = payload.model_dump(exclude_none=True)
    current.update(updates)
    current["updated_at"] = now_iso()
    return current


def archive_project(project_id: str) -> dict:
    current = PROJECTS[project_id]
    current["status"] = ProjectStatus.ARCHIVED.value
    current["updated_at"] = now_iso()
    return current


def create_agent(payload: AgentCreate) -> dict:
    agent_id = str(uuid4())
    record = payload.model_dump()
    record.update({"id": agent_id, "created_at": now_iso(), "updated_at": now_iso()})
    AGENTS[agent_id] = record
    return record


def update_agent(agent_id: str, payload: AgentUpdate) -> dict:
    current = AGENTS[agent_id]
    current.update(payload.model_dump(exclude_none=True))
    current["updated_at"] = now_iso()
    return current


def update_agent_status(agent_id: str, payload: AgentStatusUpdate) -> dict:
    current = AGENTS[agent_id]
    current["status"] = payload.status.value
    current["updated_at"] = now_iso()
    return current


def create_task(payload: TaskCreate) -> dict:
    task_id = str(uuid4())
    record = payload.model_dump()
    record.update({"id": task_id, "created_at": now_iso(), "updated_at": now_iso(), "blocker_reason": None})
    record["priority"] = payload.priority.value
    record["status"] = payload.status.value
    TASKS[task_id] = record
    if payload.parent_task_id:
        TASK_CHILDREN[payload.parent_task_id].append(task_id)
    return record


def create_worklog(payload: WorklogCreate) -> dict:
    worklog_id = str(uuid4())
    record = payload.model_dump()
    record["id"] = worklog_id
    record["action_type"] = payload.action_type.value
    record["timestamp"] = now_iso()
    WORKLOGS[worklog_id] = record
    return record


def create_handover(payload: HandoverCreate) -> dict:
    handover_id = str(uuid4())
    record = payload.model_dump()
    record.update({"id": handover_id, "timestamp": now_iso()})
    HANDOVERS[handover_id] = record
    return record


def create_evaluation(payload: EvaluationCreate) -> dict:
    evaluation_id = str(uuid4())
    record = payload.model_dump()
    record.update({"id": evaluation_id, "timestamp": now_iso()})
    EVALUATIONS[evaluation_id] = record
    return record


def promote_memory(payload: MemoryPromotionRequest) -> dict:
    now = now_iso()
    record = MEMORY.get(payload.memory_id, {})
    record.update(
        {
            "id": payload.memory_id,
            "memory_type": payload.memory_type.value,
            "title": payload.title,
            "content": payload.content,
            "source_ref": payload.source_ref,
            "approved_by": payload.approved_by,
            "promotion_status": MemoryPromotionStatus.PROMOTED.value,
            "is_curated": True,
            "updated_at": now,
        }
    )
    if "created_at" not in record:
        record["created_at"] = now
    MEMORY[payload.memory_id] = record
    return record


def reset_in_memory_state() -> None:
    PROJECTS.clear()
    AGENTS.clear()
    TASKS.clear()
    WORKLOGS.clear()
    HANDOVERS.clear()
    MEMORY.clear()
    EVALUATIONS.clear()
    EVALUATION_QUEUE.clear()
    EVALUATION_OVERRIDE_AUDIT.clear()
    TASK_CHILDREN.clear()


def seed_demo_data(*, force: bool = False) -> bool:
    if not force and any((PROJECTS, AGENTS, TASKS, WORKLOGS, HANDOVERS, MEMORY, EVALUATIONS)):
        return False

    reset_in_memory_state()

    seeded_at = datetime.now(timezone.utc)

    def ts(minutes_ago: int) -> str:
        return (seeded_at - timedelta(minutes=minutes_ago)).isoformat()

    project_core_id = "project-synapse-core"
    project_memory_id = "project-memory-pipeline"

    manager_core_id = "agent-manager-orion"
    manager_memory_id = "agent-manager-atlas"

    worker_lex_id = "agent-worker-lex"
    worker_nova_id = "agent-worker-nova"
    worker_quill_id = "agent-worker-quill"

    evaluator_iris_id = "agent-evaluator-iris"
    evaluator_kai_id = "agent-evaluator-kai"

    PROJECTS.update(
        {
            project_core_id: {
                "id": project_core_id,
                "name": "Synapse OS Delivery",
                "description": "Agent-first project orchestration workspace for V1 delivery.",
                "objective": "Ship Kanban operations, memory continuity, and evaluation loops.",
                "owner": "owner-1",
                "status": ProjectStatus.ACTIVE.value,
                "tags": ["v1", "frontend", "agent-ops"],
                "manager_agent_id": manager_core_id,
                "created_at": ts(480),
                "updated_at": ts(14),
            },
            project_memory_id: {
                "id": project_memory_id,
                "name": "Memory Reliability Track",
                "description": "Curated memory promotion, retrieval quality, and auditability.",
                "objective": "Improve context recall and reduce repeated agent mistakes.",
                "owner": "owner-1",
                "status": ProjectStatus.ACTIVE.value,
                "tags": ["memory", "evaluation", "qdrant"],
                "manager_agent_id": manager_memory_id,
                "created_at": ts(360),
                "updated_at": ts(9),
            },
        }
    )

    AGENTS.update(
        {
            "agent-owner-1": {
                "id": "agent-owner-1",
                "name": "Owner Control",
                "role": "owner",
                "type": "platform_side",
                "project_id": None,
                "capabilities": ["governance", "score_override", "release_signoff"],
                "status": "active",
                "created_at": ts(500),
                "updated_at": ts(20),
            },
            manager_core_id: {
                "id": manager_core_id,
                "name": "Manager Orion",
                "role": "manager",
                "type": "project_side",
                "project_id": project_core_id,
                "capabilities": ["planning", "task_breakdown", "handover_gate"],
                "status": "active",
                "created_at": ts(420),
                "updated_at": ts(15),
            },
            manager_memory_id: {
                "id": manager_memory_id,
                "name": "Manager Atlas",
                "role": "manager",
                "type": "project_side",
                "project_id": project_memory_id,
                "capabilities": ["memory_review", "policy_enforcement"],
                "status": "active",
                "created_at": ts(410),
                "updated_at": ts(12),
            },
            worker_lex_id: {
                "id": worker_lex_id,
                "name": "Worker Lex",
                "role": "worker",
                "type": "project_side",
                "project_id": project_core_id,
                "capabilities": ["frontend", "integration", "tooling"],
                "status": "active",
                "created_at": ts(390),
                "updated_at": ts(5),
            },
            worker_nova_id: {
                "id": worker_nova_id,
                "name": "Worker Nova",
                "role": "worker",
                "type": "project_side",
                "project_id": project_core_id,
                "capabilities": ["backend", "contracts", "tests"],
                "status": "active",
                "created_at": ts(388),
                "updated_at": ts(4),
            },
            worker_quill_id: {
                "id": worker_quill_id,
                "name": "Worker Quill",
                "role": "worker",
                "type": "project_side",
                "project_id": project_memory_id,
                "capabilities": ["vector-search", "context-ranking"],
                "status": "active",
                "created_at": ts(376),
                "updated_at": ts(6),
            },
            evaluator_iris_id: {
                "id": evaluator_iris_id,
                "name": "Evaluator Iris",
                "role": "evaluator",
                "type": "platform_side",
                "project_id": project_core_id,
                "capabilities": ["quality-scoring", "handover-review"],
                "status": "active",
                "created_at": ts(350),
                "updated_at": ts(7),
            },
            evaluator_kai_id: {
                "id": evaluator_kai_id,
                "name": "Evaluator Kai",
                "role": "evaluator",
                "type": "platform_side",
                "project_id": project_memory_id,
                "capabilities": ["memory-audit", "scorecards"],
                "status": "active",
                "created_at": ts(345),
                "updated_at": ts(10),
            },
        }
    )

    TASKS.update(
        {
            "task-backlog-api": {
                "id": "task-backlog-api",
                "project_id": project_core_id,
                "title": "Expand API read coverage",
                "description": "Add read endpoints for timeline and memory snapshots.",
                "created_by": manager_core_id,
                "assigned_to": None,
                "priority": "high",
                "status": "backlog",
                "dependencies": [],
                "acceptance_criteria": "Read models documented and typed in contracts.",
                "context_refs": ["docs/architecture/backend-read-models.md"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(300),
                "updated_at": ts(280),
                "evaluation_queued": False,
            },
            "task-ready-auth": {
                "id": "task-ready-auth",
                "project_id": project_core_id,
                "title": "Tighten Clerk role mapping",
                "description": "Map Clerk session claims to actor roles with strict checks.",
                "created_by": manager_core_id,
                "assigned_to": None,
                "priority": "medium",
                "status": "ready",
                "dependencies": [],
                "acceptance_criteria": "Role mismatch requests are rejected with clear errors.",
                "context_refs": ["PRIMER.md", "apps/api/src/app/core/auth.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(280),
                "updated_at": ts(220),
                "evaluation_queued": False,
            },
            "task-assigned-kanban": {
                "id": "task-assigned-kanban",
                "project_id": project_core_id,
                "title": "Polish Kanban lane interactions",
                "description": "Improve drag and lane transitions with clearer action buttons.",
                "created_by": manager_core_id,
                "assigned_to": worker_lex_id,
                "priority": "high",
                "status": "assigned",
                "dependencies": ["task-ready-auth"],
                "acceptance_criteria": "Assigned tasks can be claimed only by assigned worker.",
                "context_refs": ["apps/web/src/app/tasks/page.tsx"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(260),
                "updated_at": ts(40),
                "evaluation_queued": False,
            },
            "task-progress-runtime": {
                "id": "task-progress-runtime",
                "project_id": project_core_id,
                "title": "Implement tool runtime tracing",
                "description": "Capture request and response metadata for each tool call.",
                "created_by": manager_core_id,
                "assigned_to": worker_nova_id,
                "priority": "critical",
                "status": "in_progress",
                "dependencies": ["task-assigned-kanban"],
                "acceptance_criteria": "History surfaces payload, result, and actor identity.",
                "context_refs": ["apps/api/src/app/services/agent_toolkit.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(250),
                "updated_at": ts(12),
                "evaluation_queued": False,
            },
            "task-handover-ingestion": {
                "id": "task-handover-ingestion",
                "project_id": project_core_id,
                "title": "Prepare handover packet for ingestion track",
                "description": "Document completed work and unresolved risks for evaluator review.",
                "created_by": manager_core_id,
                "assigned_to": worker_lex_id,
                "priority": "medium",
                "status": "awaiting_handover",
                "dependencies": ["task-progress-runtime"],
                "acceptance_criteria": "Handover includes blockers, risks, and next steps.",
                "context_refs": ["apps/api/src/app/schemas/handover.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(240),
                "updated_at": ts(18),
                "evaluation_queued": False,
            },
            "task-review-guardrails": {
                "id": "task-review-guardrails",
                "project_id": project_core_id,
                "title": "Review guardrail policy tests",
                "description": "Validate manager and claim constraints in policy suite.",
                "created_by": manager_core_id,
                "assigned_to": worker_nova_id,
                "priority": "high",
                "status": "under_review",
                "dependencies": [],
                "acceptance_criteria": "Policy test suite passes with branch coverage notes.",
                "context_refs": ["apps/api/tests/test_policies.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(230),
                "updated_at": ts(16),
                "evaluation_queued": False,
            },
            "task-blocked-mcp": {
                "id": "task-blocked-mcp",
                "project_id": project_core_id,
                "title": "Enable remote MCP broker handshake",
                "description": "Finalize broker authentication and callback route validation.",
                "created_by": manager_core_id,
                "assigned_to": worker_lex_id,
                "priority": "critical",
                "status": "blocked",
                "dependencies": ["task-ready-auth"],
                "acceptance_criteria": "Broker handshake passes in local and staging.",
                "context_refs": ["apps/api/src/app/mcp/server.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": "Waiting for provider OAuth scope approval.",
                "created_at": ts(220),
                "updated_at": ts(11),
                "evaluation_queued": False,
            },
            "task-completed-dashboard": {
                "id": "task-completed-dashboard",
                "project_id": project_core_id,
                "title": "Ship dashboard summary widgets",
                "description": "Expose blocked and low-score alerts in dashboard cards.",
                "created_by": manager_core_id,
                "assigned_to": worker_nova_id,
                "priority": "medium",
                "status": "completed",
                "dependencies": ["task-progress-runtime"],
                "acceptance_criteria": "Cards refresh every polling cycle and display alerts.",
                "context_refs": ["apps/web/src/app/page.tsx"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(210),
                "updated_at": ts(8),
                "evaluation_queued": True,
            },
            "task-reopened-alerts": {
                "id": "task-reopened-alerts",
                "project_id": project_core_id,
                "title": "Refine low-score alert threshold",
                "description": "Tune alert rules to reduce false positives for short tasks.",
                "created_by": manager_core_id,
                "assigned_to": worker_lex_id,
                "priority": "medium",
                "status": "reopened",
                "dependencies": ["task-completed-dashboard"],
                "acceptance_criteria": "Threshold changes documented and verified.",
                "context_refs": ["apps/api/src/app/api/v1/endpoints/dashboard.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(205),
                "updated_at": ts(6),
                "evaluation_queued": False,
            },
            "task-parent-ux": {
                "id": "task-parent-ux",
                "project_id": project_core_id,
                "title": "Frontend elegance pass",
                "description": "Establish a light visual language with responsive layouts.",
                "created_by": manager_core_id,
                "assigned_to": worker_nova_id,
                "priority": "high",
                "status": "in_progress",
                "dependencies": [],
                "acceptance_criteria": "No horizontal page overflow at standard breakpoints.",
                "context_refs": ["apps/web/src/app/globals.css", "apps/web/src/components/app-shell.tsx"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(200),
                "updated_at": ts(3),
                "evaluation_queued": False,
            },
            "task-subtask-spacing": {
                "id": "task-subtask-spacing",
                "project_id": project_core_id,
                "title": "Align card spacing system",
                "description": "Normalize card paddings and table spacing across pages.",
                "created_by": manager_core_id,
                "assigned_to": worker_lex_id,
                "priority": "medium",
                "status": "assigned",
                "dependencies": ["task-parent-ux"],
                "acceptance_criteria": "Metric cards and panels share spacing scale.",
                "context_refs": ["apps/web/src/components/metric-card.tsx"],
                "parent_task_id": "task-parent-ux",
                "parent_task_depth": 1,
                "blocker_reason": None,
                "created_at": ts(190),
                "updated_at": ts(2),
                "evaluation_queued": False,
            },
            "task-memory-index": {
                "id": "task-memory-index",
                "project_id": project_memory_id,
                "title": "Tune curated memory indexing",
                "description": "Improve retrieval ranking for cross-task context queries.",
                "created_by": manager_memory_id,
                "assigned_to": worker_quill_id,
                "priority": "high",
                "status": "in_progress",
                "dependencies": [],
                "acceptance_criteria": "Top-5 retrieval quality improves in manual checks.",
                "context_refs": ["apps/api/src/app/vector/qdrant_store.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(170),
                "updated_at": ts(13),
                "evaluation_queued": False,
            },
            "task-memory-curation": {
                "id": "task-memory-curation",
                "project_id": project_memory_id,
                "title": "Define hybrid promotion workflow",
                "description": "System suggestion plus manager confirmation with audit trails.",
                "created_by": manager_memory_id,
                "assigned_to": worker_quill_id,
                "priority": "medium",
                "status": "completed",
                "dependencies": ["task-memory-index"],
                "acceptance_criteria": "Promotion decisions are stored with approver identity.",
                "context_refs": ["apps/api/src/app/services/memory.py"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": None,
                "created_at": ts(160),
                "updated_at": ts(25),
                "evaluation_queued": True,
            },
            "task-memory-blocker": {
                "id": "task-memory-blocker",
                "project_id": project_memory_id,
                "title": "Stabilize vector schema migration",
                "description": "Finalize migration script for embedding payload compatibility.",
                "created_by": manager_memory_id,
                "assigned_to": worker_quill_id,
                "priority": "high",
                "status": "blocked",
                "dependencies": ["task-memory-index"],
                "acceptance_criteria": "Migration runs cleanly in CI and local infra.",
                "context_refs": ["ops/docker-compose.yml"],
                "parent_task_id": None,
                "parent_task_depth": 0,
                "blocker_reason": "Qdrant collection migration spec still pending approval.",
                "created_at": ts(150),
                "updated_at": ts(17),
                "evaluation_queued": False,
            },
        }
    )

    TASK_CHILDREN["task-parent-ux"].append("task-subtask-spacing")

    WORKLOGS.update(
        {
            "worklog-runtime-1": {
                "id": "worklog-runtime-1",
                "task_id": "task-progress-runtime",
                "agent_id": worker_nova_id,
                "action_type": "progress",
                "summary": "Added structured logging envelope for tool calls.",
                "detailed_log": "Request payload, actor metadata, and result code now captured for each tool execution.",
                "artifacts": ["apps/api/src/app/services/agent_toolkit.py"],
                "confidence": 0.82,
                "timestamp": ts(10),
            },
            "worklog-ux-1": {
                "id": "worklog-ux-1",
                "task_id": "task-parent-ux",
                "agent_id": worker_lex_id,
                "action_type": "decision",
                "summary": "Switched to light palette with card-based composition.",
                "detailed_log": "Adjusted panel gradients, spacing, and responsive lane layout.",
                "artifacts": ["apps/web/src/app/globals.css", "apps/web/src/components/app-shell.tsx"],
                "confidence": 0.87,
                "timestamp": ts(5),
            },
            "worklog-memory-1": {
                "id": "worklog-memory-1",
                "task_id": "task-memory-index",
                "agent_id": worker_quill_id,
                "action_type": "progress",
                "summary": "Improved retrieval filtering by project and task context.",
                "detailed_log": "Memory search endpoint now prioritizes project scope and contextual matching.",
                "artifacts": ["apps/api/src/app/api/v1/endpoints/memory.py"],
                "confidence": 0.78,
                "timestamp": ts(21),
            },
        }
    )

    HANDOVERS.update(
        {
            "handover-ingestion-1": {
                "id": "handover-ingestion-1",
                "task_id": "task-handover-ingestion",
                "project_id": project_core_id,
                "from_agent_id": worker_lex_id,
                "to_agent_id": evaluator_iris_id,
                "completed_work": "Context bundle and acceptance checklist drafted.",
                "pending_work": "Need evaluator score and owner acknowledgment.",
                "blockers": "None",
                "risks": "Checklist language may be ambiguous for non-technical reviewers.",
                "next_steps": "Evaluator validates clarity and scoring readiness.",
                "confidence": 0.84,
                "timestamp": ts(19),
            },
            "handover-memory-1": {
                "id": "handover-memory-1",
                "task_id": "task-memory-curation",
                "project_id": project_memory_id,
                "from_agent_id": worker_quill_id,
                "to_agent_id": evaluator_kai_id,
                "completed_work": "Hybrid promotion flow implemented and documented.",
                "pending_work": "Run larger retrieval relevance checks against seeded corpus.",
                "blockers": "Awaiting final benchmark dataset.",
                "risks": "False positives if query terms are too generic.",
                "next_steps": "Evaluator runs scoring matrix and submits findings.",
                "confidence": 0.76,
                "timestamp": ts(26),
            },
        }
    )

    EVALUATIONS.update(
        {
            "evaluation-dashboard-1": {
                "id": "evaluation-dashboard-1",
                "project_id": project_core_id,
                "task_id": "task-completed-dashboard",
                "agent_id": worker_nova_id,
                "evaluator_agent_id": evaluator_iris_id,
                "score_completion": 8,
                "score_quality": 8,
                "score_reliability": 7,
                "score_handover": 8,
                "score_context": 7,
                "score_clarity": 8,
                "score_improvement": 7,
                "missed_points": ["Alert copy can be more action-oriented."],
                "strengths": ["Fast delivery", "Clean UI composition"],
                "weaknesses": ["Limited edge-case tests"],
                "recommendations": "Add dashboard fallback states for sparse datasets.",
                "timestamp": ts(7),
            },
            "evaluation-memory-1": {
                "id": "evaluation-memory-1",
                "project_id": project_memory_id,
                "task_id": "task-memory-curation",
                "agent_id": worker_quill_id,
                "evaluator_agent_id": evaluator_kai_id,
                "score_completion": 4,
                "score_quality": 4,
                "score_reliability": 5,
                "score_handover": 4,
                "score_context": 4,
                "score_clarity": 5,
                "score_improvement": 4,
                "missed_points": ["Did not include adversarial retrieval cases."],
                "strengths": ["Workflow is documented clearly."],
                "weaknesses": ["Low benchmark coverage"],
                "recommendations": "Add stress tests and richer memory fixtures.",
                "timestamp": ts(24),
            },
        }
    )

    EVALUATION_OVERRIDE_AUDIT.append(
        {
            "evaluation_id": "evaluation-dashboard-1",
            "owner_id": "owner-1",
            "reason": "Adjusted based on release scope and dependency constraints.",
            "original_scores": {
                "score_completion": 7,
                "score_quality": 7,
                "score_reliability": 7,
                "score_handover": 7,
                "score_context": 7,
                "score_clarity": 7,
                "score_improvement": 7,
            },
            "override_scores": {
                "score_completion": 8,
                "score_quality": 8,
                "score_reliability": 7,
                "score_handover": 8,
                "score_context": 7,
                "score_clarity": 8,
                "score_improvement": 7,
            },
            "timestamp": ts(6),
        }
    )

    EVALUATION_QUEUE.extend(
        [
            {"job_id": "eval-job-001", "task_id": "task-completed-dashboard", "created_at": ts(8)},
            {"job_id": "eval-job-002", "task_id": "task-memory-curation", "created_at": ts(25)},
        ]
    )

    MEMORY.update(
        {
            "memory-raw-runtime-1": {
                "id": "memory-raw-runtime-1",
                "project_id": project_core_id,
                "task_id": "task-progress-runtime",
                "memory_type": "task",
                "title": "Tool tracing edge case",
                "content": "Batch tool calls can return partial failures when payload schemas diverge.",
                "source_ref": "worklog-runtime-1",
                "approved_by": None,
                "promotion_status": MemoryPromotionStatus.RAW.value,
                "is_curated": False,
                "created_at": ts(10),
                "updated_at": ts(10),
            },
            "memory-curated-ui-1": {
                "id": "memory-curated-ui-1",
                "project_id": project_core_id,
                "task_id": "task-parent-ux",
                "memory_type": "project",
                "title": "Responsive board rule",
                "content": "Prefer responsive lane grids over fixed-width horizontal boards to avoid page overflow.",
                "source_ref": "apps/web/src/app/tasks/page.tsx",
                "approved_by": manager_core_id,
                "promotion_status": MemoryPromotionStatus.PROMOTED.value,
                "is_curated": True,
                "created_at": ts(5),
                "updated_at": ts(4),
            },
            "memory-curated-memory-1": {
                "id": "memory-curated-memory-1",
                "project_id": project_memory_id,
                "task_id": "task-memory-curation",
                "memory_type": "task",
                "title": "Hybrid promotion baseline",
                "content": "Memory entries require high-signal suggestion plus manager confirmation before promotion.",
                "source_ref": "apps/api/src/app/services/memory.py",
                "approved_by": manager_memory_id,
                "promotion_status": MemoryPromotionStatus.PROMOTED.value,
                "is_curated": True,
                "created_at": ts(28),
                "updated_at": ts(23),
            },
        }
    )

    return True
