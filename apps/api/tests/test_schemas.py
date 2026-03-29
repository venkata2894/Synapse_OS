from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.handover import HandoverCreate


def test_handover_requires_all_fields() -> None:
    with pytest.raises(ValidationError):
        HandoverCreate(
            task_id="t1",
            project_id="p1",
            from_agent_id="a1",
            to_agent_id="a2",
            completed_work="",
            pending_work="pending",
            blockers="none",
            risks="low",
            next_steps="next",
            confidence=0.8,
        )

