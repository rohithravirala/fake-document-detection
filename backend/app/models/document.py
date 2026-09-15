"""One document within a case, and what was read off it."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base, JSONColumn
from backend.app.models.case import new_id

if TYPE_CHECKING:
    from backend.app.models.case import Case
    from backend.app.models.check import CheckRecord


class Document(Base):
    """An uploaded document image and the fields extracted from it.

    ``extracted_fields`` and ``bboxes`` are JSON because they differ completely
    between document types. ``image_hash`` is the SHA-256 of the bytes as
    uploaded, which is what the audit chain commits to — so the record proves
    which image was screened.
    """

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), index=True
    )
    doc_type: Mapped[str] = mapped_column(String(32), index=True)
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True)

    extracted_fields: Mapped[Dict[str, Any]] = mapped_column(JSONColumn, default=dict)
    bboxes: Mapped[Dict[str, Any]] = mapped_column(JSONColumn, default=dict)

    case: Mapped[Case] = relationship(back_populates="documents")
    checks: Mapped[List[CheckRecord]] = relationship(
        back_populates="document", cascade="all, delete-orphan", lazy="selectin"
    )
