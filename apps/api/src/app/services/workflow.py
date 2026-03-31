from __future__ import annotations

from dataclasses import dataclass

from app.models.enums import TaskStatus


class WorkflowError(ValueError):
    pass


WORKFLOW_STAGES: list[str] = [
    TaskStatus.INTAKE.value,
    TaskStatus.READY.value,
    TaskStatus.ASSIGNED.value,
    TaskStatus.IN_PROGRESS.value,
    TaskStatus.AWAITING_HANDOVER.value,
    TaskStatus.UNDER_REVIEW.value,
    TaskStatus.EVALUATION.value,
    TaskStatus.COMPLETED.value,
]

# Side statuses that can be entered from most active states.
SIDE_STATUSES: set[str] = {TaskStatus.BLOCKED.value, TaskStatus.REOPENED.value}

TRANSITION_MATRIX: dict[str, set[str]] = {
    TaskStatus.INTAKE.value: {TaskStatus.READY.value, TaskStatus.BLOCKED.value},
    TaskStatus.BACKLOG.value: {TaskStatus.READY.value, TaskStatus.BLOCKED.value},
    TaskStatus.READY.value: {TaskStatus.ASSIGNED.value, TaskStatus.BLOCKED.value},
    TaskStatus.ASSIGNED.value: {TaskStatus.IN_PROGRESS.value, TaskStatus.BLOCKED.value},
    TaskStatus.IN_PROGRESS.value: {
        TaskStatus.AWAITING_HANDOVER.value,
        TaskStatus.UNDER_REVIEW.value,
        TaskStatus.BLOCKED.value,
    },
    TaskStatus.AWAITING_HANDOVER.value: {TaskStatus.UNDER_REVIEW.value, TaskStatus.BLOCKED.value},
    TaskStatus.UNDER_REVIEW.value: {TaskStatus.EVALUATION.value, TaskStatus.REOPENED.value, TaskStatus.BLOCKED.value},
    TaskStatus.EVALUATION.value: {TaskStatus.COMPLETED.value, TaskStatus.REOPENED.value},
    TaskStatus.COMPLETED.value: {TaskStatus.REOPENED.value},
    TaskStatus.BLOCKED.value: {
        TaskStatus.READY.value,
        TaskStatus.ASSIGNED.value,
        TaskStatus.IN_PROGRESS.value,
        TaskStatus.AWAITING_HANDOVER.value,
        TaskStatus.UNDER_REVIEW.value,
        TaskStatus.EVALUATION.value,
        TaskStatus.REOPENED.value,
    },
    TaskStatus.REOPENED.value: {TaskStatus.READY.value, TaskStatus.ASSIGNED.value, TaskStatus.IN_PROGRESS.value},
}

DEFAULT_WIP_LIMITS: dict[str, int] = {
    TaskStatus.INTAKE.value: 50,
    TaskStatus.READY.value: 50,
    TaskStatus.ASSIGNED.value: 30,
    TaskStatus.IN_PROGRESS.value: 20,
    TaskStatus.AWAITING_HANDOVER.value: 20,
    TaskStatus.UNDER_REVIEW.value: 15,
    TaskStatus.EVALUATION.value: 15,
    TaskStatus.COMPLETED.value: 999,
    TaskStatus.BLOCKED.value: 999,
    TaskStatus.REOPENED.value: 999,
}


@dataclass
class ProcessTemplate:
    name: str
    workflow_stages: list[str]
    transition_matrix: dict[str, list[str]]
    wip_limits: dict[str, int]


def default_template() -> ProcessTemplate:
    return ProcessTemplate(
        name="default_v1",
        workflow_stages=WORKFLOW_STAGES,
        transition_matrix={status: sorted(next_statuses) for status, next_statuses in TRANSITION_MATRIX.items()},
        wip_limits=DEFAULT_WIP_LIMITS.copy(),
    )


def can_transition(from_status: str, to_status: str) -> bool:
    allowed = TRANSITION_MATRIX.get(from_status, set())
    return to_status in allowed


def validate_transition_requirements(*, from_status: str, to_status: str, blocker_reason: str | None) -> None:
    if not can_transition(from_status, to_status):
        raise WorkflowError(f"Illegal transition: {from_status} -> {to_status}")
    if to_status == TaskStatus.BLOCKED.value and not (blocker_reason or "").strip():
        raise WorkflowError("Transition to blocked requires blocker_reason.")
