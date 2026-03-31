from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, project_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers[project_id].add(queue)
            self._subscribers["*"].add(queue)
        return queue

    async def unsubscribe(self, project_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            self._subscribers.get(project_id, set()).discard(queue)
            self._subscribers.get("*", set()).discard(queue)

    async def publish(self, project_id: str | None, event: dict[str, Any]) -> None:
        keys = ["*"]
        if project_id:
            keys.append(project_id)

        async with self._lock:
            targets: list[asyncio.Queue[dict[str, Any]]] = []
            for key in keys:
                targets.extend(self._subscribers.get(key, set()))

        for queue in targets:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                continue


broker = EventBroker()
