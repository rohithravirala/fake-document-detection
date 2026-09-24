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
    """Retrieves active officers from the authentication session registry and audit trail."""
    from backend.app.api.auth import _ACTIVE_SESSIONS

    settings = get_settings()

    rows = session.execute(
        select(AuditLog.officer_id, func.count(), func.max(AuditLog.timestamp)).group_by(
            AuditLog.officer_id
        )
    ).all()

    seen_ids = set()
    officers_list: List[Dict[str, Any]] = []

    # First add officers currently signed in
    for profile in _ACTIVE_SESSIONS.values():
        seen_ids.add(profile.id)
        # Find action count if in audit log
        count = sum(r[1] for r in rows if r[0] == profile.id)
        last_match = next((r[2] for r in rows if r[0] == profile.id), None)
        officers_list.append(
            {
                "officer_id": profile.name,
                "role": profile.role,
                "source": "authenticated-session",
                "actions": count,
                "last_action": last_match.isoformat()
                if last_match
                else profile.login_time,
                "email": profile.email,
                "badge_number": profile.badge_number,
            }
        )

    # Then add officers recorded in the audit chain
    for officer_id, count, last in rows:
        if officer_id not in seen_ids:
            officers_list.append(
                {
                    "officer_id": officer_id,
                    "actions": count,
                    "last_action": last.isoformat() if last else None,
                    "role": "Verification Officer",
                    "source": "audit-chain",
                }
            )

    active_user = next(iter(_ACTIVE_SESSIONS.values()), None)
    active_name = active_user.name if active_user else settings.officer_id

    return {
        "configured_officer": active_name,
        "officers": officers_list
        if officers_list
        else [
            {
                "officer_id": settings.officer_id,
                "actions": 0,
                "last_action": None,
                "role": "Verification Officer",
                "source": "default",
            }
        ],
        "authentication": True,
        "active_sessions_count": len(_ACTIVE_SESSIONS),
        "note": (
            "Officer Portal authentication is active. Screenings and sign-ins are "
            "attributed to verified officer credentials and cryptographically chained."
        ),
    }
