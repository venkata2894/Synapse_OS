from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.schemas.handover import HandoverCreate
from app.services.repository import HANDOVERS, WORKLOGS, create_handover

router = APIRouter()


@router.post("")
def create_handover_endpoint(payload: HandoverCreate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    return create_handover(payload)


@router.get("/tasks/{task_id}/timeline")
def task_timeline(task_id: str, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    worklogs = [item for item in WORKLOGS.values() if item["task_id"] == task_id]
    handovers = [item for item in HANDOVERS.values() if item["task_id"] == task_id]
    timeline = sorted(
        worklogs + handovers,
        key=lambda item: item.get("timestamp", ""),
    )
    return {"task_id": task_id, "timeline": timeline}

