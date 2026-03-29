from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models.enums import TaskStatus
from app.services.policies import should_queue_evaluation


def maybe_build_evaluation_job(task_id: str, previous: TaskStatus, next_status: TaskStatus) -> dict | None:
    if not should_queue_evaluation(previous, next_status):
        return None
    return {
        "job_id": str(uuid4()),
        "task_id": task_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

