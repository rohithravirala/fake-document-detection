"""SQLAlchemy models. Importing this module registers every mapper."""

from backend.app.models.audit import AuditLog
from backend.app.models.case import Case, CaseStatus
from backend.app.models.check import CheckRecord
from backend.app.models.document import Document
from backend.app.models.face import FaceEncounter
from backend.app.models.profile import VerificationProfile

__all__ = [
    "AuditLog",
    "Case",
    "CaseStatus",
    "CheckRecord",
    "Document",
    "FaceEncounter",
    "VerificationProfile",
]
