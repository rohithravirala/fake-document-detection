"""A persisted check. One row per verifiable statement about a document."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base, JSONColumn
from backend.app.models.case import new_id

if TYPE_CHECKING:
    from backend.app.models.document import Document


class CheckRecord(Base):
    """The stored form of :class:`modules.common.types.Check`.

    ``citation`` is not optional in the model either — the column is non-nullable
    because a check that cannot explain itself has no business being recorded.
    """

    __tablename__ = "checks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    """Order the checks ran in, so the stream and the stored case agree."""

    check_id: Mapped[str] = mapped_column(String(128), index=True)
    check_type: Mapped[str] = mapped_column(String(32), index=True)
    result: Mapped[str] = mapped_column(String(16), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    module: Mapped[str] = mapped_column(String(32), index=True)
    evidence: Mapped[List[Dict[str, Any]]] = mapped_column(JSONColumn, default=list)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    document: Mapped[Document] = relationship(back_populates="checks")
