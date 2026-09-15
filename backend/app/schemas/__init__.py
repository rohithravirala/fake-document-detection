"""Request and response shapes. These are the API contract in executable form.

Anything the frontend reads is defined here. When one of these changes,
``docs/API_CONTRACT.md`` and ``frontend/src/api/types.ts`` change with it.
"""

from backend.app.schemas.case import (
    CaseCreated,
    CaseDetail,
    CaseSummary,
    CheckOut,
    DocumentOut,
    EvidenceOut,
    VerdictOut,
)
from backend.app.schemas.profile import ProfileOut, ProfileUpdate
from backend.app.schemas.system import AuditRecordOut, ChainStatusOut, HealthOut

__all__ = [
    "AuditRecordOut",
    "CaseCreated",
    "CaseDetail",
    "CaseSummary",
    "ChainStatusOut",
    "CheckOut",
    "DocumentOut",
    "EvidenceOut",
    "HealthOut",
    "ProfileOut",
    "ProfileUpdate",
    "VerdictOut",
]
