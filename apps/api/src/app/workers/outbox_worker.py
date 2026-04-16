from __future__ import annotations

import logging
import time

from app.db.session import SessionLocal
from app.models.entities import MemoryEntry
from app.models.enums import MemoryPromotionStatus, MemoryType
from app.schemas.evaluation import EvaluationCreate
from app.services.repository import Repository

logger = logging.getLogger(__name__)


def process_once(*, batch_size: int = 50) -> int:
    session = SessionLocal()
    try:
        repo = Repository(session)
        events = repo.pending_outbox_events(limit=batch_size)
        processed = 0
        for event in events:
            try:
                # Handle evaluation requests
                if event.event_type == "evaluation.requested":
                    task_id = event.payload.get("task_id")
                    project_id = event.payload.get("project_id")
                    if task_id and project_id:
                        task = repo.get_task(task_id)
                        if task and task.get("assigned_to"):
                            # Create a placeholder evaluation for the evaluator to fill
                            # In a real system, this might assign it to a specific evaluator agent
                            repo.create_evaluation(
                                EvaluationCreate(
                                    project_id=project_id,
                                    task_id=task_id,
                                    agent_id=task["assigned_to"],
                                    evaluator_agent_id="agent-evaluator-iris",  # Default for demo
                                    score_completion=0,
                                    score_quality=0,
                                    score_reliability=0,
                                    score_handover=0,
                                    score_context=0,
                                    score_clarity=0,
                                    score_improvement=0,
                                    missed_points=["Pending evaluation"],
                                    strengths=[],
                                    weaknesses=[],
                                    recommendations="Please complete this evaluation.",
                                )
                            )
                            logger.info("Materialized evaluation for task %s", task_id)

                # Handle memory suggestion requests
                elif event.event_type == "memory.suggestion.requested":
                    task_id = event.payload.get("task_id")
                    project_id = event.payload.get("project_id")
                    if task_id and project_id:
                        task = repo.get_task(task_id)
                        if task:
                            # Create a raw memory entry from the task completion
                            repo.db.add(
                                MemoryEntry(
                                    project_id=project_id,
                                    task_id=task_id,
                                    agent_id=task.get("assigned_to"),
                                    memory_type=MemoryType.TASK.value,
                                    title=f"Task Completion: {task['title']}",
                                    content=task.get("description", ""),
                                    source_ref=task_id,
                                    importance=3,
                                    is_curated=False,
                                    promotion_status=MemoryPromotionStatus.SUGGESTED.value,
                                )
                            )
                            logger.info("Created memory suggestion for task %s", task_id)

                repo.mark_outbox_processed(event)
                processed += 1
            except Exception as exc:  # pragma: no cover
                repo.mark_outbox_retry(event, str(exc))
                logger.exception("Outbox event failed: %s", event.id)
        return processed
    finally:
        session.close()


def run_forever(*, poll_interval_seconds: float = 1.0) -> None:
    logger.info("Starting SentientOps outbox worker loop.")
    while True:
        processed = process_once()
        if processed == 0:
            time.sleep(poll_interval_seconds)
