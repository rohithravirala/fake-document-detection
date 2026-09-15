"""Verification profile shapes.

The profile editor screen posts these. That screen exists to demonstrate that
adding a document type is a configuration change rather than a deployment.
"""

from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel, Field, field_validator

from backend.app.schemas.common import UtcDatetime


class ProfileOut(BaseModel):
    """An active verification profile at its current version."""

    id: str
    doc_type: str
    version: int
    is_active: bool
    profile: Dict[str, Any]
    updated_at: UtcDatetime
    updated_by: str


class ProfileUpdate(BaseModel):
    """A new version of a profile.

    Validated here rather than on save, so an edit that would disable every
    check is refused before it can quietly weaken a deployment.
    """

    profile: Dict[str, Any] = Field(description="The full profile document.")

    @field_validator("profile")
    @classmethod
    def _must_have_modules(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        modules = value.get("modules")
        if modules is not None and not isinstance(modules, list):
            raise ValueError("'modules' must be a list of module names")
        if isinstance(modules, list) and not modules:
            raise ValueError(
                "'modules' cannot be empty — a profile that runs no checks would "
                "silently refer every document of this type"
            )
        quality = value.get("quality")
        if quality is not None and not isinstance(quality, dict):
            raise ValueError("'quality' must be an object of threshold values")
        return value
