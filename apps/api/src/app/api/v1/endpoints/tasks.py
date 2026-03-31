from __future__ import annotations

import logging

from anyio import from_thread
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.schemas.task import (
    TaskAssignRequest,
    TaskClaimRequest,
    TaskCreate,
    TaskDependenciesRequest,
    TaskStatusUpdate,
    TaskTransitionRequest,
)
from app.services.policies import PolicyError, validate_subtask_limits
from app.services.repository import Repository, get_repository
from app.services.workflow import WorkflowError

router = APIRouter()
logger = logging.getLogger(__name__)


def _emit_project_event(repo: Repository, *, payload: dict, event_type: str) -> None:
    project_id = payload.get("project_id")
    if not project_id:
        task_payload = payload.get("task")
        if isinstance(task_payload, dict):
            project_id = task_payload.get("project_id")
    if not project_id:
        return
    try:
        from_thread.run(
            repo.publish_event,
            project_id=project_id,
            event_type=event_type,
            payload=payload,
        )
    except RuntimeError:
        # No running async context (e.g. offline scripts); event stream publish is best effort.
        logger.debug("Skipping project event publish outside request context: %s", event_type)
    except Exception:  # pragma: no cover - defensive runtime guard
        logger.exception("Failed to publish project event: %s", event_type)


@router.get("")
def list_tasks(
    project_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    assigned_to: str | None = Query(default=None),
    limit: int = Query(default=settings.sentientops_default_page_size, ge=1, le=settings.sentientops_max_page_size),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.list_tasks(
        project_id=project_id,
        status_filter=status_filter,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset,
    )


@router.post("")
def create_task_endpoint(
    payload: TaskCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    if payload.parent_task_id:
        try:
            validate_subtask_limits(
                parent_depth=payload.parent_task_depth,
                existing_children=repo.task_children_count(payload.parent_task_id),
                max_depth=settings.sentientops_max_subtask_depth,
                max_children=settings.sentientops_max_subtasks_per_parent,
            )
        except PolicyError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return repo.create_task(payload)


@router.get("/{task_id}")
def get_task_endpoint(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    task = repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    return task


@router.post("/{task_id}/assign")
def assign_task_endpoint(
    task_id: str,
    payload: TaskAssignRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    item = repo.assign_task(task_id, payload.assigned_to, actor_id=actor.actor_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    _emit_project_event(repo, payload={"task": item}, event_type="task.assigned")
    return item


@router.post("/{task_id}/claim")
def claim_task_endpoint(
    task_id: str,
    payload: TaskClaimRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    try:
        item = repo.claim_task(task_id, payload.claiming_agent_id)
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    _emit_project_event(repo, payload={"task": item}, event_type="task.claimed")
    return item


@router.post("/{task_id}/status")
def update_task_status_endpoint(
    task_id: str,
    payload: TaskStatusUpdate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    try:
        result = repo.transition_task(
            task_id=task_id,
            target_status=payload.status.value,
            actor_id=actor.actor_id,
            blocker_reason=payload.blocker_reason,
            metadata={},
        )
    except (WorkflowError, PolicyError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    _emit_project_event(repo, payload=result, event_type="task.transitioned")
    return result["task"]


@router.post("/{task_id}/transition")
def transition_task_endpoint(
    task_id: str,
    payload: TaskTransitionRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    try:
        result = repo.transition_task(
            task_id=task_id,
            target_status=payload.target_status.value,
            actor_id=actor.actor_id,
            reason=payload.reason,
            blocker_reason=payload.blocker_reason,
            metadata=payload.metadata,
            assigned_to=payload.assigned_to,
        )
    except (WorkflowError, PolicyError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    _emit_project_event(repo, payload=result, event_type="task.transitioned")
    return result


@router.post("/{task_id}/dependencies")
def update_dependencies_endpoint(
    task_id: str,
    payload: TaskDependenciesRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    task = repo.update_task_dependencies(task_id, payload.dependencies)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    return task


@router.get("/{task_id}/timeline")
def task_timeline_endpoint(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    timeline = repo.get_task_timeline(task_id)
    if not timeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    return timeline
