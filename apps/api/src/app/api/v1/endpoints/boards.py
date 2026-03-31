from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("/{project_id}")
def get_board(
    project_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    project = repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return repo.get_board(project_id)
