from __future__ import annotations

from fastapi import HTTPException, status

from app.core.auth import Actor
from app.core.config import settings
from app.models.enums import TaskStatus
from app.schemas.agent import AgentCreate
from app.schemas.evaluation import EvaluationRequest
from app.schemas.handover import HandoverCreate
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskClaimRequest, TaskCreate, TaskStatusUpdate
from app.schemas.worklog import WorklogCreate
from app.services.evaluation import maybe_build_evaluation_job
from app.services.policies import PolicyError, ensure_assigned_worker_can_claim, validate_subtask_limits
from app.services.repository import (
    AGENTS,
    EVALUATION_QUEUE,
    HANDOVERS,
    MEMORY,
    PROJECTS,
    TASKS,
    TASK_CHILDREN,
    WORKLOGS,
    create_agent,
    create_handover,
    create_project,
    create_worklog,
    create_task,
)


TOOL_MANIFEST: list[dict[str, str]] = [
    {"name": "create_project", "description": "Create a new project registry record."},
    {"name": "register_agent", "description": "Register a manager/worker/evaluator agent."},
    {"name": "create_task", "description": "Create a new task with priority and acceptance criteria."},
    {"name": "assign_task", "description": "Assign a task to a worker and transition to Assigned."},
    {"name": "claim_task", "description": "Claim a task as the assigned worker agent."},
    {"name": "update_task_status", "description": "Move task state with blocker handling and eval trigger."},
    {"name": "submit_completion", "description": "Shortcut to mark task Completed and queue evaluation."},
    {"name": "append_worklog", "description": "Append structured execution worklog for a task."},
    {"name": "create_handover", "description": "Create structured handover payload for continuity."},
    {"name": "fetch_project_memory", "description": "Return project-scoped memory records."},
    {"name": "fetch_task_context", "description": "Return task + worklog + handover + memory context."},
    {"name": "request_evaluation", "description": "Queue evaluation job for a task."},
]


def _require_task(task_id: str) -> dict:
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    return task


def _validate_subtask(payload: TaskCreate) -> None:
    if not payload.parent_task_id:
        return
    validate_subtask_limits(
        parent_depth=payload.parent_task_depth,
        existing_children=len(TASK_CHILDREN.get(payload.parent_task_id, [])),
        max_depth=settings.sentientops_max_subtask_depth,
        max_children=settings.sentientops_max_subtasks_per_parent,
    )


def get_tool_manifest() -> dict:
    return {
        "kind": "agent_tool_manifest",
        "version": "v1",
        "tool_count": len(TOOL_MANIFEST),
        "tools": TOOL_MANIFEST,
    }


def execute_tool(tool_name: str, payload: dict, actor: Actor) -> dict:
    try:
        match tool_name:
            case "create_project":
                return {"result": create_project(ProjectCreate.model_validate(payload))}
            case "register_agent":
                agent = create_agent(AgentCreate.model_validate(payload))
                return {"result": agent}
            case "create_task":
                task_payload = TaskCreate.model_validate(payload)
                _validate_subtask(task_payload)
                return {"result": create_task(task_payload)}
            case "assign_task":
                task = _require_task(str(payload["task_id"]))
                task["assigned_to"] = str(payload["assigned_to"])
                task["status"] = TaskStatus.ASSIGNED.value
                return {"result": task}
            case "claim_task":
                task = _require_task(str(payload["task_id"]))
                claim_payload = TaskClaimRequest.model_validate(payload)
                ensure_assigned_worker_can_claim(task.get("assigned_to"), claim_payload.claiming_agent_id)
                task["status"] = TaskStatus.IN_PROGRESS.value
                return {"result": task}
            case "update_task_status":
                task = _require_task(str(payload["task_id"]))
                status_payload = TaskStatusUpdate.model_validate(payload)
                previous = TaskStatus(task["status"])
                task["status"] = status_payload.status.value
                task["blocker_reason"] = status_payload.blocker_reason
                maybe_job = maybe_build_evaluation_job(task["id"], previous, status_payload.status)
                if maybe_job:
                    EVALUATION_QUEUE.append(maybe_job)
                return {"result": task, "evaluation_queued": maybe_job is not None}
            case "submit_completion":
                task = _require_task(str(payload["task_id"]))
                previous = TaskStatus(task["status"])
                task["status"] = TaskStatus.COMPLETED.value
                maybe_job = maybe_build_evaluation_job(task["id"], previous, TaskStatus.COMPLETED)
                if maybe_job:
                    EVALUATION_QUEUE.append(maybe_job)
                return {"result": task, "evaluation_queued": maybe_job is not None}
            case "append_worklog":
                return {"result": create_worklog(WorklogCreate.model_validate(payload))}
            case "create_handover":
                return {"result": create_handover(HandoverCreate.model_validate(payload))}
            case "fetch_project_memory":
                project_id = str(payload["project_id"])
                records = [item for item in MEMORY.values() if item.get("project_id") == project_id]
                return {"result": {"project_id": project_id, "records": records}}
            case "fetch_task_context":
                task_id = str(payload["task_id"])
                task = _require_task(task_id)
                worklogs = [item for item in WORKLOGS.values() if item.get("task_id") == task_id]
                handovers = [item for item in HANDOVERS.values() if item.get("task_id") == task_id]
                memory = [item for item in MEMORY.values() if item.get("task_id") == task_id]
                return {
                    "result": {
                        "task": task,
                        "worklogs": worklogs,
                        "handovers": handovers,
                        "memory": memory,
                    }
                }
            case "request_evaluation":
                evaluation = EvaluationRequest.model_validate(payload)
                job = evaluation.model_dump()
                EVALUATION_QUEUE.append(job)
                return {"result": {"queued": True, "job": job}}
            case _:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"unknown tool: {tool_name}")
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"missing required field: {exc.args[0]}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

