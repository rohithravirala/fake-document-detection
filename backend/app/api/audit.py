"""Reading the audit log and checking that it has not been altered."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db import get_session
from backend.app.models.audit import AuditLog
from backend.app.schemas.system import AuditRecordOut, ChainStatusOut
from backend.app.services import audit as audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=List[AuditRecordOut], summary="Audit records")
def list_records(
    session: Session = Depends(get_session),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[AuditRecordOut]:
    rows = (
        session.execute(
            select(AuditLog)
            .order_by(AuditLog.sequence.desc())
            .limit(limit)
            .offset(offset)
        )
        .scalars()
        .all()
    )
    return [
        AuditRecordOut(
            id=row.id,
            sequence=row.sequence,
            timestamp=row.timestamp,
            officer_id=row.officer_id,
            action=row.action,
            case_id=row.case_id,
            payload=row.payload or {},
            payload_hash=row.payload_hash,
            previous_hash=row.previous_hash,
            record_hash=row.record_hash,
        )
        for row in rows
    ]


@router.get(
    "/verify",
    response_model=ChainStatusOut,
    summary="Verify the hash chain end to end",
)
def verify(session: Session = Depends(get_session)) -> ChainStatusOut:
    """Walk the chain and report the first break, if there is one.

    This is the endpoint to run in a demonstration immediately after editing a
    row by hand: it names the exact record where history stops adding up.
    """
    status = audit_service.verify_chain(session)
    return ChainStatusOut(**status.to_dict())
