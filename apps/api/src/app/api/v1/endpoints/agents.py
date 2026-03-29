from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.schemas.agent import AgentCreate, AgentStatusUpdate, AgentUpdate
from app.services.repository import AGENTS, create_agent, update_agent, update_agent_status

router = APIRouter()


@router.post("")
def create_agent_endpoint(payload: AgentCreate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    return create_agent(payload)


@router.patch("/{agent_id}")
def update_agent_endpoint(agent_id: str, payload: AgentUpdate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    if agent_id not in AGENTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent not found")
    return update_agent(agent_id, payload)


@router.post("/{agent_id}/status")
def update_agent_status_endpoint(
    agent_id: str,
    payload: AgentStatusUpdate,
    actor: Actor = Depends(get_current_actor),
) -> dict:
    _ = actor
    if agent_id not in AGENTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agent not found")
    return update_agent_status(agent_id, payload)

