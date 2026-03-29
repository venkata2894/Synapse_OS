from __future__ import annotations

import pytest

from app.models.enums import TaskStatus
from app.services.policies import (
    PolicyError,
    build_override_audit,
    ensure_assigned_worker_can_claim,
    ensure_single_manager,
    should_queue_evaluation,
    validate_subtask_limits,
)


def test_reject_second_manager_assignment() -> None:
    with pytest.raises(PolicyError):
        ensure_single_manager("manager-a", "manager-b")


def test_reject_claim_by_non_assigned_worker() -> None:
    with pytest.raises(PolicyError):
        ensure_assigned_worker_can_claim("worker-a", "worker-b")


def test_queue_evaluation_on_completion() -> None:
    assert should_queue_evaluation(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED) is True


def test_no_evaluation_if_already_completed() -> None:
    assert should_queue_evaluation(TaskStatus.COMPLETED, TaskStatus.COMPLETED) is False


def test_owner_override_requires_reason_and_audit_payload() -> None:
    record = build_override_audit(
        owner_id="owner-1",
        reason="Evaluator missed blocker context.",
        original_scores={"score_quality": 4},
        override_scores={"score_quality": 6},
    )
    assert record.owner_id == "owner-1"
    assert record.original_scores["score_quality"] == 4
    assert record.override_scores["score_quality"] == 6


def test_subtask_limits_reject_when_depth_reached() -> None:
    with pytest.raises(PolicyError):
        validate_subtask_limits(parent_depth=2, existing_children=0, max_depth=2, max_children=10)

