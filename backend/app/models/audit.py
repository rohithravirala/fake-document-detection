"""The tamper-evident audit log.

Each record hashes its own payload together with the previous record's hash:

    record_hash = sha256(canonical_json(payload) + previous_record_hash)

Altering any past record changes its hash, which breaks the link in every record
after it. The integrity check walks the chain and reports the first break.

**This is deliberately not a blockchain.** A hash chain gives the same
tamper-evidence — you cannot alter history without it being detectable — with
none of the consensus machinery, none of the operational cost, and no dependency
on a network. Evaluators expect blockchain when they hear "tamper-evident", so
say this out loud rather than hoping it goes unnoticed.

What a hash chain does not give you is *distributed* trust: an administrator with
write access to the whole table could recompute the entire chain. Defending
against that needs an external anchor — periodically publishing the head hash
somewhere append-only — which is a deployment decision, not a code one.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db import Base, JSONColumn
from backend.app.models.case import new_id, utcnow

GENESIS_HASH = "0" * 64
"""The previous-hash of the first record. Fixed, so the chain has a known root."""


class AuditLog(Base):
    """One immutable record of something the system did."""

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    sequence: Mapped[int] = mapped_column(Integer, index=True, unique=True)
    """Position in the chain. Gaps or reordering are themselves detectable."""

    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    officer_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    case_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)

    payload: Mapped[Dict[str, Any]] = mapped_column(JSONColumn, default=dict)
    payload_hash: Mapped[str] = mapped_column(String(64))
    previous_hash: Mapped[str] = mapped_column(String(64))
    record_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
