from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.schemas.memory import MemoryFetchRequest, MemoryPromotionRequest, MemorySearchRequest
from app.services.memory import suggest_promotion
from app.services.repository import MEMORY, promote_memory

router = APIRouter()


@router.post("/fetch")
def fetch_memory(payload: MemoryFetchRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    filtered = [
        item
        for item in MEMORY.values()
        if item.get("project_id") == payload.project_id
        and (payload.task_id is None or item.get("task_id") == payload.task_id)
    ]
    return {"items": filtered[: payload.top_k]}


@router.post("/search")
def search_memory(payload: MemorySearchRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    query = payload.query.lower()
    filtered = [
        item
        for item in MEMORY.values()
        if item.get("project_id") == payload.project_id and query in item.get("content", "").lower()
    ]
    return {"items": filtered[: payload.top_k]}


@router.post("/promote")
def promote_memory_endpoint(payload: MemoryPromotionRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    promoted = promote_memory(payload)
    promoted["promotion_suggested"] = suggest_promotion(importance=4, confidence=0.8)
    return promoted

