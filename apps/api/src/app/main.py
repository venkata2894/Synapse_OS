from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.repository import Repository

logger = logging.getLogger(__name__)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    if settings.sentientops_seed_demo_data and not os.getenv("PYTEST_CURRENT_TEST"):
        repo = Repository(session)
        if repo.seed_demo_data():
            logger.info("Loaded SentientOps demo dataset.")
    session.close()
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


@app.middleware("http")
async def request_id_middleware(request, call_next):
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response

if settings.sentientops_enable_mcp:
    try:
        from app.mcp.server import get_mcp_asgi_app

        app.mount("/mcp", get_mcp_asgi_app())
    except Exception as exc:  # pragma: no cover - only hit in missing/invalid optional dependency states
        logger.warning("MCP mount skipped: %s", exc)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "SentientOps API scaffold is running"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):  # pragma: no cover - runtime safety net
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception("Unhandled error [%s]: %s", request_id, exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Unexpected server error.",
                "request_id": request_id,
            }
        },
    )
