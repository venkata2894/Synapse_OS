from __future__ import annotations

from typing import Any

from qdrant_client import QdrantClient

from app.core.config import settings


class QdrantMemoryStore:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)

    def upsert_curated_memory(self, collection: str, points: list[dict[str, Any]]) -> None:
        # Stub for later embedding + vector upsert implementation.
        if not points:
            return

    def search(self, collection: str, query_vector: list[float], limit: int = 10) -> list[dict[str, Any]]:
        # Stub response shape for scaffold.
        _ = (collection, query_vector, limit)
        return []

