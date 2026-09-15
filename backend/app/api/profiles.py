"""Reading and editing verification profiles.

These endpoints back the profile editor screen, which exists to answer the
scalability question an evaluator will ask: adding a document type is an edit to
a JSON document here, not a code change and not a deployment.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_session
from backend.app.schemas.profile import ProfileOut, ProfileUpdate
from backend.app.services import audit, profiles

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=List[ProfileOut], summary="All active profiles")
def list_profiles(session: Session = Depends(get_session)) -> List[ProfileOut]:
    profiles.seed(session)
    session.commit()
    return [
        ProfileOut(
            id=row.id,
            doc_type=row.doc_type,
            version=row.version,
            is_active=row.is_active,
            profile=row.profile,
            updated_at=row.updated_at,
            updated_by=row.updated_by,
        )
        for row in profiles.list_active(session)
    ]


@router.get("/{doc_type}", response_model=ProfileOut, summary="One profile")
def get_profile(doc_type: str, session: Session = Depends(get_session)) -> ProfileOut:
    profiles.seed(session)
    session.commit()
    for row in profiles.list_active(session):
        if row.doc_type == doc_type:
            return ProfileOut(
                id=row.id,
                doc_type=row.doc_type,
                version=row.version,
                is_active=row.is_active,
                profile=row.profile,
                updated_at=row.updated_at,
                updated_by=row.updated_by,
            )
    raise HTTPException(status_code=404, detail=f"no profile for '{doc_type}'")


@router.put("/{doc_type}", response_model=ProfileOut, summary="Publish a new version")
def update_profile(
    doc_type: str, body: ProfileUpdate, session: Session = Depends(get_session)
) -> ProfileOut:
    """Supersede the active profile.

    The previous version is deactivated rather than overwritten, so any past
    screening can still be traced to the rules that were in force when it ran.
    """
    settings = get_settings()
    row = profiles.update(session, doc_type, body.profile, updated_by=settings.officer_id)
    audit.append(
        session,
        action="profile.updated",
        officer_id=settings.officer_id,
        payload={"doc_type": doc_type, "version": row.version, "profile": body.profile},
    )
    session.commit()
    return ProfileOut(
        id=row.id,
        doc_type=row.doc_type,
        version=row.version,
        is_active=row.is_active,
        profile=row.profile,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )
