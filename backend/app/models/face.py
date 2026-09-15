"""Face encounters — the table that catches one person using several identities.

What is stored here is an **embedding**, never a photograph. An embedding is a
512-dimensional vector; it is not reversible into a usable image. The model that
produced it ran locally and no biometric left the machine.

The reason this table exists at all: verifying a document proves the document is
real. It does not prove the person holding it has only one. Comparing every
screening against every prior screening is what surfaces the same face presenting
under two different numbers.
"""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base, EmbeddingColumn
from backend.app.models.case import new_id, utcnow

if TYPE_CHECKING:
    from backend.app.models.case import Case


class FaceEncounter(Base):
    """One face seen at one screening, stored for later comparison."""

    __tablename__ = "face_encounters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), index=True
    )
    captured_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    embedding: Mapped[Optional[List[float]]] = mapped_column(
        EmbeddingColumn, nullable=True
    )
    source: Mapped[str] = mapped_column(String(32), default="document")
    """``document``, ``live`` or ``qr_signed`` — which image this came from."""

    doc_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    doc_number: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    case: Mapped[Case] = relationship(back_populates="face_encounters")
