from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("/templates/default")
def get_default_template(
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.get_default_process_template()
