"""Authentication and session schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Credentials provided by the officer."""

    name: str = Field(..., min_length=2, max_length=100, description="Officer full name")
    email: str = Field(
        ..., min_length=3, max_length=120, description="Officer email address"
    )
    password: str = Field(
        ..., min_length=4, max_length=128, description="Officer password"
    )
    role: str = Field(
        default="Verification Officer",
        description="Assigned officer role/designation",
    )
    badge_number: Optional[str] = Field(
        default=None, description="Optional official badge/credential identifier"
    )


class UserProfile(BaseModel):
    """Authenticated officer profile details."""

    id: str
    name: str
    email: str
    role: str
    badge_number: str
    token: str
    login_time: str
    department: str = "Immigration & Document Fraud Prevention"


class LoginResponse(BaseModel):
    """Authentication outcome."""

    authenticated: bool
    user: UserProfile
    message: str


class SessionInfo(BaseModel):
    """Current session verification."""

    authenticated: bool
    user: Optional[UserProfile] = None
