from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CheckResult(BaseModel):
    category: str
    name: str
    status: CheckStatus
    severity: Severity
    detail: str
    evidence_refs: list[str] = Field(default_factory=list)


class JourneyStep(BaseModel):
    phase: str
    status: CheckStatus
    detail: str
    evidence_refs: list[str] = Field(default_factory=list)


class FinalAssessment(BaseModel):
    summary: str
    friction_score: int = Field(ge=1, le=10)
    agent_seamlessness_score: int = Field(ge=1, le=10)
    working_well: list[str] = Field(default_factory=list)
    broken: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    recommended_next_actions: list[str] = Field(default_factory=list)


class UATReport(BaseModel):
    run_id: str
    scenario: str
    started_at: str
    finished_at: str
    trace_ids: list[str] = Field(default_factory=list)
    summary: str
    friction_score: int = Field(ge=1, le=10)
    agent_seamlessness_score: int = Field(ge=1, le=10)
    journeys: list[JourneyStep] = Field(default_factory=list)
    checks: list[CheckResult] = Field(default_factory=list)
    failures: list[CheckResult] = Field(default_factory=list)
    setup_failures: list[CheckResult] = Field(default_factory=list)
    application_failures: list[CheckResult] = Field(default_factory=list)
    working_well: list[str] = Field(default_factory=list)
    broken: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    recommended_next_actions: list[str] = Field(default_factory=list)
    created_resources: dict[str, Any] = Field(default_factory=dict)
    specialist_notes: dict[str, str] = Field(default_factory=dict)
    evidence_files: list[str] = Field(default_factory=list)
