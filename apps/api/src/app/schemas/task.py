from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.models.enums import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=2, max_length=255)
    description: str
    created_by: str
    assigned_to: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.BACKLOG
    dependencies: list[str] = Field(default_factory=list)
    acceptance_criteria: str
    context_refs: list[str] = Field(default_factory=list)
    parent_task_id: str | None = None
    parent_task_depth: int = 0


class TaskAssignRequest(BaseModel):
    assigned_to: str


class TaskClaimRequest(BaseModel):
    claiming_agent_id: str


class TaskDependenciesRequest(BaseModel):
    dependencies: list[str] = Field(default_factory=list)


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    blocker_reason: str | None = None

    @model_validator(mode="after")
    def validate_blocker_reason(self) -> "TaskStatusUpdate":
        if self.status == TaskStatus.BLOCKED and not self.blocker_reason:
            raise ValueError("blocked status requires blocker_reason")
        return self

