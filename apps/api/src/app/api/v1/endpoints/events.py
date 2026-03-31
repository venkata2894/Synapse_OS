from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.auth import _authenticate_agent_token, _verify_clerk_jwt
from app.core.config import settings
from app.services.event_stream import broker

router = APIRouter()


@router.get("/stream")
async def stream_events(
    project_id: str = Query(..., min_length=1),
    actor_id: str | None = Query(default=None),
    token: str | None = Query(default=None),
):
    if token:
        agent_actor = _authenticate_agent_token(token)
        if not agent_actor:
            _verify_clerk_jwt(token)
    elif settings.sentientops_enforce_clerk_jwt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing stream token.")
    elif not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing actor_id for stream.")

    queue = await broker.subscribe(project_id)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: {event.get('type', 'message')}\ndata: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    heartbeat = {
                        "type": "heartbeat",
                        "project_id": project_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    yield f"event: heartbeat\ndata: {json.dumps(heartbeat)}\n\n"
        finally:
            await broker.unsubscribe(project_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
