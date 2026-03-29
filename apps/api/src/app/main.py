from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)

if settings.sentientops_enable_mcp:
    try:
        from app.mcp.server import get_mcp_asgi_app

        app.mount("/mcp", get_mcp_asgi_app())
    except Exception as exc:  # pragma: no cover - only hit in missing/invalid optional dependency states
        logger.warning("MCP mount skipped: %s", exc)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "SentientOps API scaffold is running"}
