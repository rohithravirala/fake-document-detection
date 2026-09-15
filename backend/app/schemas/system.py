"""Health and audit shapes — what the deployment says about itself."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from backend.app.schemas.common import UtcDatetime


class HealthOut(BaseModel):
    """What is running, and which checks this deployment can actually perform.

    ``modules`` is the important field. It is how an officer, or an evaluator,
    can see at a glance that face comparison is unavailable here rather than
    silently skipped.
    """

    status: str
    app: str
    environment: str
    storage: str = Field(description="postgres+pgvector or sqlite")
    execution: str = Field(description="rq-worker or in-process")
    modules: Dict[str, bool] = Field(default_factory=dict)
    ocr_engines: Dict[str, bool] = Field(default_factory=dict)
    aadhaar_certificate: bool = False
    offline_capable: bool = Field(
        default=True,
        description="Whether the decisive checks run with no network at all.",
    )


class ChainStatusOut(BaseModel):
    """Whether the audit log has been altered."""

    intact: bool
    records: int
    head_hash: str
    broken_at: Optional[int] = None
    detail: str


class AuditRecordOut(BaseModel):
    """One record of the hash chain."""

    id: str
    sequence: int
    timestamp: UtcDatetime
    officer_id: str
    action: str
    case_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    payload_hash: str
    previous_hash: str
    record_hash: str
