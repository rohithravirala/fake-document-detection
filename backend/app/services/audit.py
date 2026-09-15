"""The hash-chained audit log.

Every screening writes records here, and each record commits to the one before
it. Altering a past record changes its hash, which no longer matches what the
next record recorded as its ``previous_hash`` — so the break is detectable, and
:func:`verify_chain` reports exactly where it starts.

Canonical serialisation matters more than it looks. Two JSON encodings of the
same data must produce the same hash, or the chain reports false breaks on every
re-read. So payloads are serialised with sorted keys, no insignificant
whitespace, and ASCII escaping — fixed here and nowhere else.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.audit import GENESIS_HASH, AuditLog


def canonical_json(payload: Any) -> str:
    """Serialise deterministically. The hash depends on this being stable."""
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str
    )


def hash_payload(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def chain_hash(payload_hash: str, previous_hash: str) -> str:
    """The record hash: this record's payload committed to the chain so far."""
    return hashlib.sha256((payload_hash + previous_hash).encode("utf-8")).hexdigest()


@dataclass
class ChainStatus:
    """The result of walking the chain end to end."""

    intact: bool
    records: int
    head_hash: str = GENESIS_HASH
    broken_at: Optional[int] = None
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intact": self.intact,
            "records": self.records,
            "head_hash": self.head_hash,
            "broken_at": self.broken_at,
            "detail": self.detail,
        }


def head(session: Session) -> Optional[AuditLog]:
    """The most recent record, or ``None`` on an empty chain."""
    return session.execute(
        select(AuditLog).order_by(AuditLog.sequence.desc()).limit(1)
    ).scalar_one_or_none()


def append(
    session: Session,
    *,
    action: str,
    officer_id: str,
    payload: Dict[str, Any],
    case_id: Optional[str] = None,
) -> AuditLog:
    """Append one record, linked to the current head.

    The caller commits. Appending inside the same transaction as the work being
    recorded is what keeps the log and the data consistent — a screening that
    rolls back must not leave an audit record claiming it happened.
    """
    previous = head(session)
    previous_hash = previous.record_hash if previous else GENESIS_HASH
    sequence = (previous.sequence + 1) if previous else 1

    payload_hash = hash_payload(payload)
    record = AuditLog(
        sequence=sequence,
        action=action,
        officer_id=officer_id,
        case_id=case_id,
        payload=payload,
        payload_hash=payload_hash,
        previous_hash=previous_hash,
        record_hash=chain_hash(payload_hash, previous_hash),
    )
    session.add(record)
    session.flush()
    return record


def verify_chain(session: Session) -> ChainStatus:
    """Walk the chain and report the first break, if any.

    Three things are checked per record: that the payload still hashes to its
    recorded ``payload_hash`` (the row was not edited), that ``previous_hash``
    matches the actual previous record (nothing was removed or reordered), and
    that ``record_hash`` is consistent with both (the hash itself was not
    rewritten to cover an edit).
    """
    total = session.execute(select(func.count()).select_from(AuditLog)).scalar_one()
    records: Sequence[AuditLog] = (
        session.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
        .scalars()
        .all()
    )

    previous_hash = GENESIS_HASH
    for index, record in enumerate(records, start=1):
        if record.sequence != index:
            return ChainStatus(
                intact=False,
                records=total,
                broken_at=record.sequence,
                detail=(
                    f"record {record.id} has sequence {record.sequence} but is in "
                    f"position {index}; a record was removed or reordered"
                ),
            )

        recomputed_payload = hash_payload(record.payload)
        if recomputed_payload != record.payload_hash:
            return ChainStatus(
                intact=False,
                records=total,
                broken_at=record.sequence,
                detail=(
                    f"record {record.sequence} payload no longer matches its "
                    "recorded hash; the stored data was edited"
                ),
            )

        if record.previous_hash != previous_hash:
            return ChainStatus(
                intact=False,
                records=total,
                broken_at=record.sequence,
                detail=(
                    f"record {record.sequence} links to a previous hash that does "
                    "not match the record before it"
                ),
            )

        if record.record_hash != chain_hash(recomputed_payload, previous_hash):
            return ChainStatus(
                intact=False,
                records=total,
                broken_at=record.sequence,
                detail=(
                    f"record {record.sequence} hash is inconsistent with its own "
                    "payload and predecessor"
                ),
            )

        previous_hash = record.record_hash

    return ChainStatus(
        intact=True,
        records=total,
        head_hash=previous_hash,
        detail=(
            f"all {total} records verify against the chain"
            if total
            else "the log is empty"
        ),
    )
