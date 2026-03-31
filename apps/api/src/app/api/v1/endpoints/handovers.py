from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.schemas.handover import HandoverCreate
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.post("")
def create_handover_endpoint(
    payload: HandoverCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.create_handover(payload)


@router.get("/{task_id}")
def get_handover_context(
    task_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    timeline = repo.get_task_timeline(task_id)
    if not timeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task not found")
    return {
        "task_id": task_id,
        "worklogs": timeline["worklogs"],
        "handovers": timeline["handovers"],
    }
