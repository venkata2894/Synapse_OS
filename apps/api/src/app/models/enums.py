from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    pass


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    PAUSED = "paused"


class AgentRole(StrEnum):
    OWNER = "owner"
    MANAGER = "manager"
    WORKER = "worker"
    EVALUATOR = "evaluator"


class AgentType(StrEnum):
    PROJECT_SIDE = "project_side"
    PLATFORM_SIDE = "platform_side"


class AgentStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PAUSED = "paused"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(StrEnum):
    INTAKE = "intake"
    BACKLOG = "backlog"
    READY = "ready"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    AWAITING_HANDOVER = "awaiting_handover"
    UNDER_REVIEW = "under_review"
    EVALUATION = "evaluation"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    REOPENED = "reopened"


class WorklogActionType(StrEnum):
    START = "start"
    PROGRESS = "progress"
    DECISION = "decision"
    ISSUE = "issue"
    OUTPUT = "output"
    HANDOVER = "handover"
    COMPLETION = "completion"
    CORRECTION = "correction"


class MemoryType(StrEnum):
    PROJECT = "project"
    TASK = "task"
    AGENT = "agent"
    HANDOVER = "handover"


class MemoryPromotionStatus(StrEnum):
    RAW = "raw"
    SUGGESTED = "suggested"
    PROMOTED = "promoted"
    REJECTED = "rejected"
