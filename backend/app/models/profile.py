"""Verification profiles: the document rules that live in data, not in code.

This table is what makes "adding a document type is a configuration change"
literally true rather than a claim. A profile carries the quality thresholds, the
required fields, the face similarity bands and which modules apply — everything
that differs between a PAN card and a passport.

Changing how a document is screened is an edit to a row here. It does not need a
deployment, and it leaves a version behind.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db import Base, JSONColumn
from backend.app.models.case import new_id, utcnow


class VerificationProfile(Base):
    """One document type's screening rules, at one version."""

    __tablename__ = "verification_profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    doc_type: Mapped[str] = mapped_column(String(32), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(default=True, index=True)
    profile: Mapped[Dict[str, Any]] = mapped_column(JSONColumn, default=dict)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    updated_by: Mapped[str] = mapped_column(String(64), default="system")
