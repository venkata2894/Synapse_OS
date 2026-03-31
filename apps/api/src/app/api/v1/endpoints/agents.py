from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.schemas.agent import AgentCreate, AgentStatusUpdate, AgentUpdate
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("")
def list_agents(
    project_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    limit: int = Query(default=settings.sentientops_default_page_size, ge=1, le=settings.sentientops_max_page_size),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.list_agents(project_id=project_id, role=role, limit=limit, offset=offset)


@router.post("")
def create_agent_endpoint(
    payload: AgentCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.create_agent(payload)


@router.patch("/{agent_id}")
def update_agent_endpoint(
    agent_id: str,
    payload: AgentUpdate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    updated = repo.update_agent(agent_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent not found")
    return updated


@router.post("/{agent_id}/status")
def update_agent_status_endpoint(
    agent_id: str,
    payload: AgentStatusUpdate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    updated = repo.update_agent_status(agent_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent not found")
    return updated
