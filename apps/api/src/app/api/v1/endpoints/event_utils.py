from __future__ import annotations

import logging
from functools import partial

from anyio import from_thread

from app.services.repository import Repository

logger = logging.getLogger(__name__)


def emit_project_event(repo: Repository, *, project_id: str | None, event_type: str, payload: dict) -> None:
    if not project_id:
        return
    try:
        from_thread.run(
            partial(
                repo.publish_event,
                project_id=project_id,
                event_type=event_type,
                payload=payload,
            )
        )
    except RuntimeError:
        logger.debug("Skipping project event publish outside request context: %s", event_type)
    except Exception:  # pragma: no cover - defensive runtime guard
        logger.exception("Failed to publish project event: %s", event_type)
