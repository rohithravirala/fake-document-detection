"""Deployment configuration and officer identity, as they actually are.

Both screens these back — Settings and User Management — exist in the design.
Neither has a real implementation behind it, and the endpoints say so rather
than returning plausible-looking data. A settings page whose toggles do nothing
is worse than an empty one: it tells an operator a control exists.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_session
from backend.app.models.audit import AuditLog
from backend.app.services import audit as audit_service

router = APIRouter(tags=["system"])


@router.get("/settings", summary="Effective configuration")
def settings_view(session: Session = Depends(get_session)) -> Dict[str, Any]:
    from backend.app.services.screening import ensure_modules_loaded
    from modules.aadhaar import signature as aadhaar_signature
    from modules.common.verifier import registry
    from modules.face import compare as face_compare
    from modules.forensics.signals import REPORT_THRESHOLD
    from modules.ocr import engine_availability

    ensure_modules_loaded()
    settings = get_settings()
    chain = audit_service.verify_chain(session)

    return {
        "organisation": {
            "name": "Ministry of Home Affairs",
            "system": settings.app_name,
            "problem_statement": "SIH26188",
            "environment": settings.environment,
        },
        "storage": {
            "backend": settings.storage_mode,
            "execution": settings.execution_mode,
            "upload_dir": str(settings.upload_dir),
            "model_dir": str(settings.model_dir),
            "max_upload_mb": round(settings.max_upload_bytes / 1e6, 1),
        },
        "verification": {
            "face_match_threshold": face_compare.DEFAULT_MATCH,
            "face_no_match_threshold": face_compare.DEFAULT_NO_MATCH,
            "face_min_pixels": face_compare.MIN_FACE_PIXELS,
            "forensic_report_threshold": REPORT_THRESHOLD,
            "note": (
                "Per-document thresholds are not set here. They live in the "
                "verification profiles, which are versioned and editable."
            ),
        },
        "modules": registry.availability(),
        "ocr_engines": engine_availability(),
        "aadhaar_certificate": aadhaar_signature.available(),
        "audit": {
            "intact": chain.intact,
            "records": chain.records,
            "head_hash": chain.head_hash,
        },
        "offline_capable": True,
        # Everything below is in the design and has no implementation. Listed so
        # the interface can show it as not built rather than as a dead toggle.
        "not_implemented": [
            "authentication and sessions",
            "two-factor authentication",
            "password policy and IP allow-listing",
            "notification delivery",
            "backup and restore",
            "log retention policy",
        ],
    }


@router.get("/officers", summary="Officer identity in this deployment")
def officers(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """There is exactly one, and it is hard-coded.

    No authentication system was built — a deliberate non-goal, so that the
    screening logic got the time instead. The audit log already carries an
    officer id on every record, so adding real identities later is a change of
    where that value comes from, not a schema change.
    """
    settings = get_settings()

    rows = session.execute(
        select(AuditLog.officer_id, func.count(), func.max(AuditLog.timestamp)).group_by(
            AuditLog.officer_id
        )
    ).all()

    officers_seen: List[Dict[str, Any]] = [
        {
            "officer_id": officer_id,
            "actions": count,
            "last_action": last.isoformat() if last else None,
            "role": "Verification Officer",
            "source": "hard-coded",
        }
        for officer_id, count, last in rows
    ]

    return {
        "configured_officer": settings.officer_id,
        "officers": officers_seen,
        "authentication": False,
        "note": (
            "No authentication system is built. Every screening is attributed to "
            "the configured officer id. This is a stated non-goal, not an "
            "oversight — see the README."
        ),
    }
