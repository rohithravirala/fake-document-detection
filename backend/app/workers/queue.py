"""Getting screening work off the request thread.

A full screening takes three to eight seconds. Holding an HTTP request open for
that long is bad practice and makes the live check stream impossible, so submit
returns a ``case_id`` immediately and the work happens elsewhere.

"Elsewhere" is one of two places:

**An RQ worker**, when ``REDIS_URL`` is set. The real deployment.

**A background task in this process**, when it is not. The zero-setup path — a
teammate can clone and run without Docker, and the behaviour is identical apart
from not surviving a restart.

RQ rather than Celery: it is enough at this scale and costs far less setup time.
Celery is the better long-term choice and is a swap of this one file.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from backend.app.config import get_settings

log = logging.getLogger(__name__)

_queue = None


def get_queue():
    """The RQ queue, or ``None`` when running in-process."""
    global _queue
    settings = get_settings()
    if not settings.use_queue:
        return None
    if _queue is None:
        import redis
        from rq import Queue

        _queue = Queue(
            settings.queue_name,
            connection=redis.Redis.from_url(settings.redis_url),
            default_timeout=300,
        )
    return _queue


def enqueue(case_id: str, background_tasks: Optional[Any] = None) -> str:
    """Schedule a screening. Returns how it was scheduled, for the response.

    ``background_tasks`` is FastAPI's, used only in the in-process mode. Passing
    it keeps the request from blocking while still running the job in this
    process.
    """
    from backend.app.workers.jobs import run_screening

    queue = get_queue()
    if queue is not None:
        queue.enqueue(run_screening, case_id, job_id=f"screening:{case_id}")
        return "rq-worker"

    if background_tasks is not None:
        background_tasks.add_task(run_screening, case_id)
        return "in-process-background"

    run_screening(case_id)
    return "in-process-sync"
