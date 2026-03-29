from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import AgentRole, AgentStatus, AgentType


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    role: AgentRole
    type: AgentType
    project_id: str | None = None
    capabilities: list[str] = Field(default_factory=list)
    status: AgentStatus = AgentStatus.ACTIVE


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    project_id: str | None = None
    capabilities: list[str] | None = None


class AgentStatusUpdate(BaseModel):
    status: AgentStatus

