from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.repository import seed_demo_data

logger = logging.getLogger(__name__)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    if settings.sentientops_seed_demo_data and not os.getenv("PYTEST_CURRENT_TEST"):
        if seed_demo_data():
            logger.info("Loaded SentientOps demo dataset.")
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=app_lifespan)

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
