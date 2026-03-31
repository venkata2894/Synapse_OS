from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import MemoryType


class MemoryFetchRequest(BaseModel):
    project_id: str
    task_id: str | None = None
    agent_id: str | None = None
    top_k: int = Field(default=10, ge=1, le=100)


class MemorySearchRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=3)
    task_id: str | None = None
    top_k: int = Field(default=10, ge=1, le=100)


class MemoryPromotionRequest(BaseModel):
    memory_id: str
    project_id: str
    task_id: str | None = None
    agent_id: str | None = None
    memory_type: MemoryType
    title: str
    content: str
    source_ref: str | None = None
    approved_by: str
