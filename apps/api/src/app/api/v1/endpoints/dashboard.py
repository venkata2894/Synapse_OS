from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(
    project_id: str | None = None,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.get_dashboard_summary(project_id=project_id)
