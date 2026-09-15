"""Engine, session and the two column types that differ between backends.

Only two things actually change between Postgres and SQLite, and both are
isolated here so no model or service has to care:

``JSONColumn``
    ``JSONB`` on Postgres, plain ``JSON`` on SQLite. Extracted fields, bounding
    boxes, evidence and profiles all differ completely between document types —
    a passport has MRZ fields, a PAN has none — so forcing them into columns
    would mean a wide, mostly-null table.

``EmbeddingColumn``
    ``vector(512)`` on Postgres so similarity search runs in SQL, and a JSON
    array on SQLite where the search is a scan in Python. Same results, different
    speed.
"""

from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from typing import Any, Iterator, List, Optional

from sqlalchemy import JSON, Text, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from backend.app.config import get_settings

log = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 512


class Base(DeclarativeBase):
    """Declarative base for every model."""


class JSONColumn(TypeDecorator):
    """JSONB on Postgres, JSON elsewhere."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB

            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class EmbeddingColumn(TypeDecorator):
    """A 512-dimensional face embedding.

    Stored as ``vector(512)`` where pgvector is available, and as a JSON array
    otherwise. The Python value is a list of floats in both cases.
    """

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and _pgvector_available():
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(EMBEDDING_DIMENSIONS))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Optional[List[float]], dialect) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql" and _pgvector_available():
            return list(value)
        return json.dumps([float(v) for v in value])

    def process_result_value(self, value: Any, dialect) -> Optional[List[float]]:
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return [float(v) for v in json.loads(value)]
            except (ValueError, TypeError):
                return None
        return [float(v) for v in value]


def _pgvector_available() -> bool:
    try:
        import pgvector.sqlalchemy  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def build_engine() -> Engine:
    """Create the engine for whichever backend is configured."""
    settings = get_settings()
    url = settings.resolved_database_url

    if url.startswith("sqlite"):
        engine = create_engine(
            url,
            future=True,
            echo=False,
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record):  # noqa: ANN001
            cursor = dbapi_connection.cursor()
            # WAL so the SSE reader is not blocked by the worker writing.
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        return engine

    return create_engine(url, future=True, echo=False, pool_pre_ping=True)


engine: Engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Create tables, and the pgvector extension where it applies.

    Alembic owns migrations for a real deployment. This exists so the SQLite path
    and the test suite work from a clean checkout with no migration step.
    """
    from backend.app import models  # noqa: F401  - registers the mappers

    settings = get_settings()
    if settings.is_postgres and _pgvector_available():
        from sqlalchemy import text

        with engine.begin() as connection:
            try:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as exc:  # noqa: BLE001
                log.warning("could not enable pgvector: %s", exc)

    Base.metadata.create_all(bind=engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope for workers and scripts."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
