"""A screening: one person, one or more documents, one verdict."""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base

if TYPE_CHECKING:
    from backend.app.models.document import Document
    from backend.app.models.face import FaceEncounter


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class CaseStatus(str, enum.Enum):
    """Where a screening is in its lifecycle."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class Case(Base):
    """One screening event.

    ``verdict`` is deliberately nullable and stays null until every check has
    run. A partially-screened case has no verdict — not a provisional one.
    """

    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    completed_at: Mapped[Optional[dt.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    officer_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, native_enum=False, length=16),
        default=CaseStatus.QUEUED,
        index=True,
    )

    verdict: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    """The single sentence shown beside the verdict."""

    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    documents: Mapped[List[Document]] = relationship(
        back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    face_encounters: Mapped[List[FaceEncounter]] = relationship(
        back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
