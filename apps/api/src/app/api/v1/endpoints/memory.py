from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.schemas.memory import MemoryFetchRequest, MemoryPromotionRequest, MemorySearchRequest
from app.services.memory import suggest_promotion
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.post("/fetch")
def fetch_memory(
    payload: MemoryFetchRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    items = repo.fetch_memory(project_id=payload.project_id, task_id=payload.task_id, top_k=payload.top_k)
    return {"items": items}


@router.post("/search")
def search_memory(
    payload: MemorySearchRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    items = repo.search_memory(
        project_id=payload.project_id,
        query_text=payload.query,
        task_id=payload.task_id,
        top_k=payload.top_k,
    )
    return {"items": items}


@router.post("/promote")
def promote_memory_endpoint(
    payload: MemoryPromotionRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    promoted = repo.promote_memory(payload)
    promoted["promotion_suggested"] = suggest_promotion(importance=4, confidence=0.8)
    return promoted
