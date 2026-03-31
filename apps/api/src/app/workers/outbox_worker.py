from __future__ import annotations

import logging
import time

from app.db.session import SessionLocal
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
                # This worker is a durable handoff point. Downstream integrations
                # (evaluation engine, memory scoring) can be attached by event type.
                repo.mark_outbox_processed(event)
                processed += 1
            except Exception as exc:  # pragma: no cover - defensive runtime guard
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
