from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.v1.endpoints.event_utils import emit_project_event
from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.schemas.worklog import WorklogCreate
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("")
def list_worklogs(
    project_id: str | None = Query(default=None),
    task_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    action_type: str | None = Query(default=None),
    limit: int = Query(default=settings.sentientops_default_page_size, ge=1, le=settings.sentientops_max_page_size),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.list_worklogs(
        project_id=project_id,
        task_id=task_id,
        agent_id=agent_id,
        action_type=action_type,
        limit=limit,
        offset=offset,
    )


@router.post("")
def append_worklog(
    payload: WorklogCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    item = repo.create_worklog(payload)
    task = repo.get_task(payload.task_id)
    if task:
        emit_project_event(
            repo,
            project_id=task.get("project_id"),
            payload={"project_id": task.get("project_id"), "worklog": item},
            event_type="worklog.appended",
        )
    return item
