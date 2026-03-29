from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.enums import TaskStatus


class PolicyError(ValueError):
    pass


def ensure_single_manager(existing_manager_id: str | None, new_manager_id: str) -> None:
    if existing_manager_id and existing_manager_id != new_manager_id:
        raise PolicyError("project already has a manager agent in V1")


def ensure_assigned_worker_can_claim(assigned_to: str | None, claiming_agent_id: str) -> None:
    if not assigned_to:
        raise PolicyError("task cannot be claimed because no assigned worker exists")
    if assigned_to != claiming_agent_id:
        raise PolicyError("only the assigned worker can claim this task in V1")


def should_queue_evaluation(previous_status: TaskStatus, next_status: TaskStatus) -> bool:
    return previous_status != TaskStatus.COMPLETED and next_status == TaskStatus.COMPLETED


def validate_subtask_limits(
    parent_depth: int,
    existing_children: int,
    *,
    max_depth: int,
    max_children: int,
) -> None:
    if parent_depth >= max_depth:
        raise PolicyError("subtask depth limit reached")
    if existing_children >= max_children:
        raise PolicyError("subtask child-count limit reached")


@dataclass
class EvaluationOverrideAuditRecord:
    owner_id: str
    reason: str
    original_scores: dict[str, int]
    override_scores: dict[str, int]
    timestamp: datetime


def build_override_audit(
    *,
    owner_id: str,
    reason: str,
    original_scores: dict[str, int],
    override_scores: dict[str, int],
) -> EvaluationOverrideAuditRecord:
    if not reason.strip():
        raise PolicyError("override reason is required")
    return EvaluationOverrideAuditRecord(
        owner_id=owner_id,
        reason=reason,
        original_scores=original_scores,
        override_scores=override_scores,
        timestamp=datetime.now(timezone.utc),
    )

