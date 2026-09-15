"""Verification profiles: the per-document-type rules, stored as data.

The claim this supports is that adding a document type is a configuration change
rather than an engineering one. That is only true if the things that actually
differ between document types live in a row rather than in an ``if`` — quality
thresholds, required fields, face bands, which modules apply.

The defaults below are the seed. They are editable through the API and the
profile editor screen, and each edit produces a new version.
"""

from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.profile import VerificationProfile
from modules.common.types import DocumentType

DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    DocumentType.PAN.value: {
        "label": "Permanent Account Number card",
        "modules": ["ocr", "pan", "forensics"],
        "required_fields": ["pan_number", "name"],
        "quality": {
            "min_sharpness": 60.0,
            "min_short_edge": 600,
            "max_clipped_ratio": 0.25,
        },
        "notes": (
            "The PAN number encodes the holder category and the surname initial. "
            "No image analysis is needed for the decisive check."
        ),
    },
    DocumentType.AADHAAR.value: {
        "label": "Aadhaar card",
        "modules": ["ocr", "aadhaar", "face", "forensics"],
        "required_fields": ["aadhaar_number", "name"],
        "quality": {
            # The Secure QR is dense, so a sharper capture is required than for
            # a card that is only read as text.
            "min_sharpness": 90.0,
            "min_short_edge": 800,
            "max_clipped_ratio": 0.20,
        },
        "face": {"match_threshold": 0.85, "no_match_threshold": 0.60},
        "notes": (
            "The Secure QR is signed by UIDAI and is the source of truth. The "
            "printed card is checked against it."
        ),
    },
    DocumentType.PASSPORT.value: {
        "label": "Passport",
        "modules": ["ocr", "passport", "face", "forensics"],
        "required_fields": ["mrz"],
        "quality": {
            "min_sharpness": 80.0,
            "min_short_edge": 800,
            "max_clipped_ratio": 0.20,
        },
        "face": {"match_threshold": 0.85, "no_match_threshold": 0.60},
        "ocr_engine": None,
        "notes": (
            "The MRZ carries check digits over the document number, dates and a "
            "composite. It must also agree with the printed data page."
        ),
    },
    DocumentType.VISA.value: {
        "label": "Visa",
        "modules": ["ocr", "passport", "forensics"],
        "required_fields": [],
        "quality": {
            "min_sharpness": 60.0,
            "min_short_edge": 600,
            "max_clipped_ratio": 0.30,
        },
        "notes": (
            "Most visa stickers have no cryptographic source of truth, so a visa "
            "can rarely be cleared automatically. This is expected, not a gap."
        ),
    },
    DocumentType.UNKNOWN.value: {
        "label": "Unclassified document",
        "modules": ["ocr", "forensics"],
        "required_fields": [],
        "quality": {
            "min_sharpness": 50.0,
            "min_short_edge": 500,
            "max_clipped_ratio": 0.35,
        },
        "notes": (
            "Nothing here can be verified against an issuing authority, so the "
            "outcome will be REFER unless the type is identified."
        ),
    },
}


def seed(session: Session, *, updated_by: str = "system") -> int:
    """Insert any default profile that is not already present."""
    existing = set(
        session.execute(
            select(VerificationProfile.doc_type).where(
                VerificationProfile.is_active.is_(True)
            )
        )
        .scalars()
        .all()
    )
    added = 0
    for doc_type, profile in DEFAULT_PROFILES.items():
        if doc_type in existing:
            continue
        session.add(
            VerificationProfile(
                doc_type=doc_type,
                version=1,
                is_active=True,
                profile=profile,
                updated_by=updated_by,
            )
        )
        added += 1
    session.flush()
    return added


def load(session: Session, doc_type: str) -> Dict[str, Any]:
    """The active profile for a document type, falling back to the default."""
    row = session.execute(
        select(VerificationProfile)
        .where(
            VerificationProfile.doc_type == doc_type,
            VerificationProfile.is_active.is_(True),
        )
        .order_by(VerificationProfile.version.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is not None:
        return dict(row.profile or {})
    return dict(
        DEFAULT_PROFILES.get(doc_type, DEFAULT_PROFILES[DocumentType.UNKNOWN.value])
    )


def list_active(session: Session) -> List[VerificationProfile]:
    return list(
        session.execute(
            select(VerificationProfile)
            .where(VerificationProfile.is_active.is_(True))
            .order_by(VerificationProfile.doc_type.asc())
        )
        .scalars()
        .all()
    )


def update(
    session: Session, doc_type: str, profile: Dict[str, Any], *, updated_by: str
) -> VerificationProfile:
    """Supersede the active profile with a new version.

    The previous version is deactivated rather than overwritten, so a screening
    can always be traced back to the rules that were in force when it ran.
    """
    current = session.execute(
        select(VerificationProfile)
        .where(
            VerificationProfile.doc_type == doc_type,
            VerificationProfile.is_active.is_(True),
        )
        .order_by(VerificationProfile.version.desc())
        .limit(1)
    ).scalar_one_or_none()

    next_version = (current.version + 1) if current else 1
    if current is not None:
        current.is_active = False

    created = VerificationProfile(
        doc_type=doc_type,
        version=next_version,
        is_active=True,
        profile=profile,
        updated_by=updated_by,
    )
    session.add(created)
    session.flush()
    return created
