from __future__ import annotations

from datetime import datetime, timezone

IDEMPOTENCY_CACHE: dict[str, dict] = {}


def get_cached_response(idempotency_key: str) -> dict | None:
    return IDEMPOTENCY_CACHE.get(idempotency_key)


def store_response(idempotency_key: str, response: dict) -> None:
    IDEMPOTENCY_CACHE[idempotency_key] = {
        "response": response,
        "stored_at": datetime.now(timezone.utc).isoformat(),
    }

