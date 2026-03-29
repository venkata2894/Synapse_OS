from __future__ import annotations

from pydantic import BaseModel, Field


class HandoverCreate(BaseModel):
    task_id: str
    project_id: str
    from_agent_id: str
    to_agent_id: str
    completed_work: str = Field(min_length=1)
    pending_work: str = Field(min_length=1)
    blockers: str = Field(min_length=1)
    risks: str = Field(min_length=1)
    next_steps: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)

