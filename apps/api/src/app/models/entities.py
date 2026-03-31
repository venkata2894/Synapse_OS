from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    AgentRole,
    AgentStatus,
    AgentType,
    MemoryPromotionStatus,
    MemoryType,
    ProjectStatus,
    TaskPriority,
    TaskStatus,
    WorklogActionType,
)


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    objective: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default=ProjectStatus.ACTIVE.value)
    owner: Mapped[str] = mapped_column(String(255))
    manager_agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)


class Agent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agents"

    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default=AgentRole.WORKER.value)
    type: Mapped[str] = mapped_column(String(50), default=AgentType.PROJECT_SIDE.value)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(50), default=AgentStatus.ACTIVE.value)
    memory_profile_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evaluation_profile_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tasks"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    parent_task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(36))
    assigned_to: Mapped[str | None] = mapped_column(String(36), nullable=True)
    priority: Mapped[str] = mapped_column(String(50), default=TaskPriority.MEDIUM.value)
    status: Mapped[str] = mapped_column(String(50), default=TaskStatus.BACKLOG.value)
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    acceptance_criteria: Mapped[str] = mapped_column(Text)
    context_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    blocker_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_task_depth: Mapped[int] = mapped_column(Integer, default=0)
    evaluation_queued: Mapped[bool] = mapped_column(Boolean, default=False)


class Worklog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "worklogs"

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"))
    action_type: Mapped[str] = mapped_column(String(50), default=WorklogActionType.PROGRESS.value)
    summary: Mapped[str] = mapped_column(Text)
    detailed_log: Mapped[str] = mapped_column(Text)
    artifacts: Mapped[list[str]] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Handover(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "handovers"

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    from_agent_id: Mapped[str] = mapped_column(String(36))
    to_agent_id: Mapped[str] = mapped_column(String(36))
    completed_work: Mapped[str] = mapped_column(Text)
    pending_work: Mapped[str] = mapped_column(Text)
    blockers: Mapped[str] = mapped_column(Text)
    risks: Mapped[str] = mapped_column(Text)
    next_steps: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Evaluation(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "evaluations"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"))
    evaluator_agent_id: Mapped[str] = mapped_column(String(36))
    score_completion: Mapped[int] = mapped_column(Integer)
    score_quality: Mapped[int] = mapped_column(Integer)
    score_reliability: Mapped[int] = mapped_column(Integer)
    score_handover: Mapped[int] = mapped_column(Integer)
    score_context: Mapped[int] = mapped_column(Integer)
    score_clarity: Mapped[int] = mapped_column(Integer)
    score_improvement: Mapped[int] = mapped_column(Integer)
    missed_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommendations: Mapped[str] = mapped_column(Text)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class EvaluationOverrideAudit(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "evaluation_override_audit"

    evaluation_id: Mapped[str] = mapped_column(ForeignKey("evaluations.id"))
    owner_id: Mapped[str] = mapped_column(String(255))
    reason: Mapped[str] = mapped_column(Text)
    original_scores: Mapped[dict[str, int]] = mapped_column(JSON)
    override_scores: Mapped[dict[str, int]] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MemoryEntry(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "memory_entries"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    memory_type: Mapped[str] = mapped_column(String(50), default=MemoryType.TASK.value)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    importance: Mapped[int] = mapped_column(Integer, default=3)
    is_curated: Mapped[bool] = mapped_column(Boolean, default=False)
    promotion_status: Mapped[str] = mapped_column(String(50), default=MemoryPromotionStatus.RAW.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProjectProcessConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_process_configs"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True)
    template_name: Mapped[str] = mapped_column(String(120), default="default_v1")
    workflow_stages: Mapped[list[str]] = mapped_column(JSON, default=list)
    transition_matrix: Mapped[dict[str, list[str]]] = mapped_column(JSON, default=dict)
    wip_limits: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)


class TaskTransition(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_transitions"

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    from_status: Mapped[str] = mapped_column(String(50))
    to_status: Mapped[str] = mapped_column(String(50))
    actor_id: Mapped[str] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    transition_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class OutboxEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "outbox_events"

    aggregate_type: Mapped[str] = mapped_column(String(120))
    aggregate_id: Mapped[str] = mapped_column(String(255))
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class IdempotencyRecord(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "idempotency_records"

    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    response: Mapped[dict[str, object]] = mapped_column(JSON)
    stored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
