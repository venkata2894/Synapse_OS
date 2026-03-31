from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from app.core.auth import Actor, get_current_actor
from app.services.agent_toolkit import execute_tool, get_tool_manifest
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("/manifest")
def agent_tool_manifest(
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = repo
    manifest = get_tool_manifest()
    return {"actor": actor.model_dump(), **manifest}


@router.post("/{tool_name}")
def call_agent_tool(
    tool_name: str,
    payload: dict,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    if idempotency_key:
        cached = repo.get_cached_response(idempotency_key)
        if cached:
            return {"idempotency_reused": True, **cached}

    result = execute_tool(tool_name, payload, actor, repo)
    response = {"tool": tool_name, "actor": actor.model_dump(), **result}
    if idempotency_key:
        repo.store_cached_response(idempotency_key, response)
    return response


@router.post("/batch/call")
def call_agent_tools_batch(
    payload: list[dict],
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    results = []
    for item in payload:
        tool_name = str(item.get("tool_name", ""))
        tool_payload = item.get("payload", {})
        result = execute_tool(tool_name, tool_payload, actor, repo)
        results.append({"tool": tool_name, **result})
    return {"actor": actor.model_dump(), "count": len(results), "results": results}
