from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
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

