from __future__ import annotations

from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    project_id: str
    task_id: str
    agent_id: str
    requested_by: str


class EvaluationCreate(BaseModel):
    project_id: str
    task_id: str
    agent_id: str
    evaluator_agent_id: str
    score_completion: int = Field(ge=0, le=10)
    score_quality: int = Field(ge=0, le=10)
    score_reliability: int = Field(ge=0, le=10)
    score_handover: int = Field(ge=0, le=10)
    score_context: int = Field(ge=0, le=10)
    score_clarity: int = Field(ge=0, le=10)
    score_improvement: int = Field(ge=0, le=10)
    missed_points: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: str


class EvaluationOverrideRequest(BaseModel):
    owner_id: str
    reason: str = Field(min_length=5)
    score_completion: int = Field(ge=0, le=10)
    score_quality: int = Field(ge=0, le=10)
    score_reliability: int = Field(ge=0, le=10)
    score_handover: int = Field(ge=0, le=10)
    score_context: int = Field(ge=0, le=10)
    score_clarity: int = Field(ge=0, le=10)
    score_improvement: int = Field(ge=0, le=10)

