from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import WorklogActionType


class WorklogCreate(BaseModel):
    task_id: str
    agent_id: str
    action_type: WorklogActionType
    summary: str
    detailed_log: str
    artifacts: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)

