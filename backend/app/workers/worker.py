"""RQ worker entrypoint.

    python -m backend.app.workers.worker

Only used when ``REDIS_URL`` is set. In the default in-process mode nothing needs
to be started separately.
"""

from __future__ import annotations

import logging
import sys

from backend.app.config import get_settings


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s"
    )
    settings = get_settings()

    if not settings.use_queue:
        print(
            "REDIS_URL is not set, so screening runs inside the API process and "
            "no worker is needed. Set REDIS_URL to run workers separately.",
            file=sys.stderr,
        )
        return 1

    import redis
    from rq import Queue, Worker

    # Modules are loaded up front so the first job does not pay for it.
    from backend.app.services.screening import ensure_modules_loaded

    ensure_modules_loaded()

    connection = redis.Redis.from_url(settings.redis_url)
    worker = Worker(
        [Queue(settings.queue_name, connection=connection)], connection=connection
    )
    worker.work(with_scheduler=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
