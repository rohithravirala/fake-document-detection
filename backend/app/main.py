"""The FastAPI application.

    uvicorn backend.app.main:app --reload

With nothing configured this starts against SQLite with screening running
in-process, which is enough to exercise the whole system. Setting
``DATABASE_URL`` and ``REDIS_URL`` switches it to Postgres and RQ workers without
any code change.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from backend.app.api import (
    analytics,
    audit,
    auth,
    cases,
    faces,
    health,
    profiles,
    stream,
    system,
)
from backend.app.config import get_settings
from backend.app.db import init_db, session_scope
from backend.app.services import profiles as profile_service
from backend.app.services.screening import ensure_modules_loaded

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare the database and load modules before the first request.

    Modules are loaded at startup rather than lazily so that the first screening
    is not several seconds slower than the rest, and so ``/api/health`` reports
    accurate availability from the moment the process is up.
    """
    settings = get_settings()
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    init_db()
    with session_scope() as session:
        added = profile_service.seed(session)
    if added:
        log.info("seeded %d verification profiles", added)

    ensure_modules_loaded()
    from modules.common.verifier import registry

    log.info(
        "storage=%s execution=%s modules=%s",
        settings.storage_mode,
        settings.execution_mode,
        registry.availability(),
    )
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "AI-based fake identity and document screening. Every document is "
            "checked against its own source of truth — a UIDAI signature, a PAN "
            "structure, an MRZ check digit — before any appearance-based "
            "analysis is considered. The API returns checks with citations, not "
            "probabilities."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(cases.router, prefix="/api")
    app.include_router(stream.router, prefix="/api")
    app.include_router(profiles.router, prefix="/api")
    app.include_router(audit.router, prefix="/api")
    app.include_router(analytics.router, prefix="/api")
    app.include_router(faces.router, prefix="/api")
    app.include_router(system.router, prefix="/api")

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        """Never let an internal error reach the client as a screening outcome."""
        log.exception("unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": (
                    "The request failed inside the server. No screening result "
                    "should be inferred from this."
                ),
                "error": type(exc).__name__,
            },
        )

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "name": settings.app_name,
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
