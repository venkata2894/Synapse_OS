from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.schemas.worklog import WorklogCreate
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.post("")
def append_worklog(
    payload: WorklogCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.create_worklog(payload)
