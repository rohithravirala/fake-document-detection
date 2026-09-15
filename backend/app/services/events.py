"""Publishing check results as they complete, for the live stream.

A screening takes several seconds. The officer should see each check land as it
finishes rather than watching a spinner, so the worker publishes every result and
the SSE endpoint forwards them.

Two transports, chosen by configuration:

**In-memory** — the default. Worker and API are the same process, so an asyncio
queue per subscriber is all that is needed.

**Redis pub/sub** — when RQ workers run in separate processes, events have to
cross a process boundary.

The SSE endpoint also reconciles against the database before it finishes, so a
dropped event delays a row rather than losing it. The stream is a convenience;
the database is the record.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, Set

from backend.app.config import get_settings

log = logging.getLogger(__name__)

CHANNEL_PREFIX = "svaram:case:"


class InMemoryBus:
    """Fan-out to asyncio queues, one per subscriber."""

    def __init__(self) -> None:
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._history: Dict[str, List[Dict[str, Any]]] = {}

    def publish(self, case_id: str, event: Dict[str, Any]) -> None:
        self._history.setdefault(case_id, []).append(event)
        for queue in list(self._subscribers.get(case_id, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover - bounded queues only
                log.warning("dropping event for %s: subscriber queue full", case_id)

    def subscribe(self, case_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        # Replay what already happened, so a client that connects a moment late
        # still sees the whole screening.
        for event in self._history.get(case_id, []):
            queue.put_nowait(event)
        self._subscribers.setdefault(case_id, set()).add(queue)
        return queue

    def unsubscribe(self, case_id: str, queue: asyncio.Queue) -> None:
        subscribers = self._subscribers.get(case_id)
        if subscribers:
            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(case_id, None)

    def forget(self, case_id: str) -> None:
        self._history.pop(case_id, None)


class RedisBus:
    """Cross-process fan-out through Redis pub/sub."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._client = None

    def _connect(self):
        if self._client is None:
            import redis

            self._client = redis.Redis.from_url(self._url)
        return self._client

    def publish(self, case_id: str, event: Dict[str, Any]) -> None:
        try:
            self._connect().publish(CHANNEL_PREFIX + case_id, json.dumps(event))
        except Exception as exc:  # noqa: BLE001 - the database is still the record
            log.warning("could not publish event for %s: %s", case_id, exc)

    async def listen(self, case_id: str) -> AsyncIterator[Dict[str, Any]]:
        import redis.asyncio as aioredis

        client = aioredis.Redis.from_url(self._url)
        pubsub = client.pubsub()
        await pubsub.subscribe(CHANNEL_PREFIX + case_id)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    yield json.loads(message["data"])
                except (ValueError, TypeError):
                    continue
        finally:
            await pubsub.unsubscribe(CHANNEL_PREFIX + case_id)
            await pubsub.close()
            await client.aclose()


_memory_bus = InMemoryBus()
_redis_bus: Optional[RedisBus] = None


def bus():
    """The configured transport."""
    global _redis_bus
    settings = get_settings()
    if not settings.use_queue:
        return _memory_bus
    if _redis_bus is None:
        _redis_bus = RedisBus(settings.redis_url)
    return _redis_bus


def memory_bus() -> InMemoryBus:
    """The in-memory bus, used directly by the SSE endpoint in in-process mode."""
    return _memory_bus


def publish(case_id: str, event: Dict[str, Any]) -> None:
    """Publish one event to whichever transport is configured."""
    bus().publish(case_id, event)
    if get_settings().use_queue:
        # Also keep the in-memory history so a same-process reader can replay.
        _memory_bus.publish(case_id, event)
