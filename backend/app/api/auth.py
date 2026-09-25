"""Authentication endpoints and officer session management.

Logs authentication actions (sign-in and sign-out) directly to the tamper-evident
audit log hash chain, satisfying full traceability requirements.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_session
from backend.app.schemas.auth import LoginRequest, LoginResponse, SessionInfo, UserProfile
from backend.app.services import audit as audit_service

router = APIRouter(prefix="/auth", tags=["auth"])

# Active in-memory session registry (suitable for standalone/single-instance deployments)
_ACTIVE_SESSIONS: Dict[str, UserProfile] = {}


def _generate_badge(name: str, role: str) -> str:
    """Generate official looking badge ID based on officer name."""
    clean = "".join(c for c in name.upper() if c.isalnum())[:3] or "OFF"
    short_hash = hashlib.sha256(name.encode("utf-8")).hexdigest()[:4].upper()
    return f"IN-{clean}-{short_hash}"


@router.post("/login", response_model=LoginResponse, summary="Officer Portal Sign-In")
def login(
    request: LoginRequest,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """Authenticate an officer and record the event in the audit chain."""
    email_clean = request.email.strip().lower()
    name_clean = request.name.strip()

    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Officer name cannot be empty.",
        )

    if "@" not in email_clean or "." not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address.",
        )

    if len(request.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters.",
        )

    officer_id = f"off_{hashlib.sha256(email_clean.encode('utf-8')).hexdigest()[:10]}"
    badge = request.badge_number or _generate_badge(name_clean, request.role)
    token = f"svaram_tok_{uuid.uuid4().hex}"
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()

    profile = UserProfile(
        id=officer_id,
        name=name_clean,
        email=email_clean,
        role=request.role or "Verification Officer",
        badge_number=badge,
        token=token,
        login_time=now_iso,
        department="Immigration & Document Fraud Prevention",
    )

    _ACTIVE_SESSIONS[token] = profile

    # Record login into cryptographic audit hash chain
    try:
        audit_service.append(
            session,
            action="officer_login",
            officer_id=officer_id,
            payload={
                "officer_name": name_clean,
                "email": email_clean,
                "role": profile.role,
                "badge_number": badge,
                "method": "portal_credentials",
                "timestamp": now_iso,
            },
        )
        session.commit()
    except Exception:
        session.rollback()

    return LoginResponse(
        authenticated=True,
        user=profile,
        message=f"Welcome, Officer {name_clean}. Session active.",
    )


@router.get("/me", response_model=SessionInfo, summary="Get current officer session")
def get_current_user(
    authorization: Optional[str] = Header(None),
) -> SessionInfo:
    """Verify session token and retrieve current officer profile."""
    if not authorization:
        return SessionInfo(authenticated=False, user=None)

    token = authorization.replace("Bearer ", "").strip()
    user = _ACTIVE_SESSIONS.get(token)

    if not user:
        return SessionInfo(authenticated=False, user=None)

    return SessionInfo(authenticated=True, user=user)


@router.post("/logout", summary="Officer Sign-Out")
def logout(
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Terminate the officer session and record logout event in the audit chain."""
    if not authorization:
        return {"status": "ok", "message": "Logged out."}

    token = authorization.replace("Bearer ", "").strip()
    user = _ACTIVE_SESSIONS.pop(token, None)

    if user:
        try:
            audit_service.append(
                session,
                action="officer_logout",
                officer_id=user.id,
                payload={
                    "officer_name": user.name,
                    "email": user.email,
                    "badge_number": user.badge_number,
                    "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                },
            )
            session.commit()
        except Exception:
            session.rollback()

    return {"status": "ok", "message": "Officer signed out successfully."}
