from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.models.enums import TaskStatus
from app.schemas.task import (
    TaskAssignRequest,
    TaskClaimRequest,
    TaskCreate,
    TaskDependenciesRequest,
    TaskStatusUpdate,
)
from app.services.evaluation import maybe_build_evaluation_job
from app.services.policies import PolicyError, ensure_assigned_worker_can_claim, validate_subtask_limits
from app.services.repository import EVALUATION_QUEUE, TASKS, TASK_CHILDREN, create_task

router = APIRouter()


@router.post("")
def create_task_endpoint(payload: TaskCreate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    if payload.parent_task_id:
        try:
            validate_subtask_limits(
                parent_depth=payload.parent_task_depth,
                existing_children=len(TASK_CHILDREN.get(payload.parent_task_id, [])),
                max_depth=settings.sentientops_max_subtask_depth,
                max_children=settings.sentientops_max_subtasks_per_parent,
            )
        except PolicyError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return create_task(payload)


@router.post("/{task_id}/assign")
def assign_task_endpoint(task_id: str, payload: TaskAssignRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    task["assigned_to"] = payload.assigned_to
    task["status"] = TaskStatus.ASSIGNED.value
    return task


@router.post("/{task_id}/claim")
def claim_task_endpoint(task_id: str, payload: TaskClaimRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    try:
        ensure_assigned_worker_can_claim(task.get("assigned_to"), payload.claiming_agent_id)
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    task["status"] = TaskStatus.IN_PROGRESS.value
    return task


@router.post("/{task_id}/status")
def update_task_status_endpoint(
    task_id: str,
    payload: TaskStatusUpdate,
    actor: Actor = Depends(get_current_actor),
) -> dict:
    _ = actor
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    previous = TaskStatus(task["status"])
    task["status"] = payload.status.value
    task["blocker_reason"] = payload.blocker_reason
    maybe_job = maybe_build_evaluation_job(task_id, previous, payload.status)
    if maybe_job:
        EVALUATION_QUEUE.append(maybe_job)
    task["evaluation_queued"] = maybe_job is not None
    return task


@router.post("/{task_id}/dependencies")
def update_dependencies_endpoint(
    task_id: str,
    payload: TaskDependenciesRequest,
    actor: Actor = Depends(get_current_actor),
) -> dict:
    _ = actor
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    task["dependencies"] = payload.dependencies
    return task
