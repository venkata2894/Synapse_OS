from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import Actor, get_current_actor
from app.schemas.agent import AgentCreate, AgentStatusUpdate, AgentUpdate
from app.services.repository import AGENTS, create_agent, update_agent, update_agent_status

router = APIRouter()


@router.get("")
def list_agents(
    project_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    actor: Actor = Depends(get_current_actor),
) -> dict:
    _ = actor
    items = list(AGENTS.values())
    if project_id:
        items = [agent for agent in items if agent.get("project_id") == project_id]
    if role:
        items = [agent for agent in items if agent.get("role") == role]
    items = sorted(items, key=lambda item: item.get("created_at", ""), reverse=True)
    return {"items": items, "count": len(items)}


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
