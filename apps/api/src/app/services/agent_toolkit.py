from __future__ import annotations

from fastapi import HTTPException, status

from app.core.auth import Actor
from app.core.config import settings
from app.schemas.agent import AgentCreate
from app.schemas.evaluation import EvaluationRequest
from app.schemas.handover import HandoverCreate
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskClaimRequest, TaskCreate, TaskTransitionRequest
from app.schemas.worklog import WorklogCreate
from app.services.policies import PolicyError, validate_subtask_limits
from app.services.repository import Repository
from app.services.workflow import WorkflowError


TOOL_MANIFEST: list[dict[str, str]] = [
    {"name": "create_project", "description": "Create a new project registry record."},
    {"name": "register_agent", "description": "Register a manager/worker/evaluator agent."},
    {"name": "create_task", "description": "Create a new task with acceptance criteria."},
    {"name": "assign_task", "description": "Assign a task to a worker."},
    {"name": "claim_task", "description": "Claim a task as assigned worker."},
    {"name": "transition_task", "description": "Transition task using workflow guardrails."},
    {"name": "update_task_status", "description": "Legacy alias for transition_task."},
    {"name": "submit_completion", "description": "Legacy shortcut to complete a task."},
    {"name": "append_worklog", "description": "Append structured execution worklog for a task."},
    {"name": "create_handover", "description": "Create structured handover payload."},
    {"name": "fetch_project_memory", "description": "Return project-scoped memory records."},
    {"name": "fetch_task_context", "description": "Return task timeline and memory context."},
    {"name": "request_evaluation", "description": "Queue evaluation job for a task."},
]


def get_tool_manifest() -> dict:
    return {
        "kind": "agent_tool_manifest",
        "version": "v1",
        "tool_count": len(TOOL_MANIFEST),
        "tools": TOOL_MANIFEST,
    }


def execute_tool(tool_name: str, payload: dict, actor: Actor, repo: Repository) -> dict:
    try:
        match tool_name:
            case "create_project":
                return {"result": repo.create_project(ProjectCreate.model_validate(payload))}
            case "register_agent":
                return {"result": repo.create_agent(AgentCreate.model_validate(payload))}
            case "create_task":
                task_payload = TaskCreate.model_validate(payload)
                if task_payload.parent_task_id:
                    validate_subtask_limits(
                        parent_depth=task_payload.parent_task_depth,
                        existing_children=repo.task_children_count(task_payload.parent_task_id),
                        max_depth=settings.sentientops_max_subtask_depth,
                        max_children=settings.sentientops_max_subtasks_per_parent,
                    )
                return {"result": repo.create_task(task_payload)}
            case "assign_task":
                task_id = str(payload.get("task_id", ""))
                assigned_to = str(payload.get("assigned_to", ""))
                result = repo.assign_task(task_id, assigned_to, actor_id=actor.actor_id)
                if not result:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": result}
            case "claim_task":
                claim_payload = TaskClaimRequest.model_validate(payload)
                task_id = str(payload.get("task_id", ""))
                result = repo.claim_task(task_id, claim_payload.claiming_agent_id)
                if not result:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": result}
            case "transition_task":
                task_id = str(payload.get("task_id", ""))
                transition_payload = TaskTransitionRequest.model_validate(payload)
                result = repo.transition_task(
                    task_id=task_id,
                    target_status=transition_payload.target_status.value,
                    actor_id=actor.actor_id,
                    reason=transition_payload.reason,
                    blocker_reason=transition_payload.blocker_reason,
                    metadata=transition_payload.metadata,
                    assigned_to=transition_payload.assigned_to,
                )
                if not result:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": result["task"], "transition": result["transition"], "evaluation_queued": result["evaluation_queued"]}
            case "update_task_status":
                task_id = str(payload.get("task_id", ""))
                target_status = str(payload.get("status", ""))
                result = repo.transition_task(
                    task_id=task_id,
                    target_status=target_status,
                    actor_id=actor.actor_id,
                    blocker_reason=payload.get("blocker_reason"),
                    metadata={},
                )
                if not result:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": result["task"], "transition": result["transition"], "evaluation_queued": result["evaluation_queued"]}
            case "submit_completion":
                task_id = str(payload.get("task_id", ""))
                result = repo.transition_task(
                    task_id=task_id,
                    target_status="completed",
                    actor_id=actor.actor_id,
                    metadata={},
                )
                if not result:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": result["task"], "transition": result["transition"], "evaluation_queued": result["evaluation_queued"]}
            case "append_worklog":
                return {"result": repo.create_worklog(WorklogCreate.model_validate(payload))}
            case "create_handover":
                return {"result": repo.create_handover(HandoverCreate.model_validate(payload))}
            case "fetch_project_memory":
                project_id = str(payload["project_id"])
                records = repo.fetch_memory(project_id=project_id, top_k=int(payload.get("top_k", 20)))
                return {"result": {"project_id": project_id, "records": records}}
            case "fetch_task_context":
                task_id = str(payload["task_id"])
                timeline = repo.get_task_timeline(task_id)
                if not timeline:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
                return {"result": timeline}
            case "request_evaluation":
                evaluation = EvaluationRequest.model_validate(payload)
                event = repo.enqueue_outbox_event(
                    aggregate_type="task",
                    aggregate_id=evaluation.task_id,
                    project_id=evaluation.project_id,
                    event_type="evaluation.requested",
                    payload=evaluation.model_dump(),
                )
                repo.db.commit()
                return {"result": {"queued": True, "job": evaluation.model_dump(), "outbox_event_id": event["id"]}}
            case _:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"unknown tool: {tool_name}")
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"missing required field: {exc.args[0]}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
