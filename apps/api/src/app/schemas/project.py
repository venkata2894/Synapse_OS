from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import ProjectStatus


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str
    objective: str
    owner: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    tags: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    objective: str | None = None
    status: ProjectStatus | None = None
    tags: list[str] | None = None


class ManagerAssignment(BaseModel):
    manager_agent_id: str

