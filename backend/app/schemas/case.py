"""Case, document and check response shapes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from backend.app.schemas.common import UtcDatetime


class BBoxOut(BaseModel):
    """A region of the source image, for the evidence crop."""

    x: int
    y: int
    w: int
    h: int


class EvidenceOut(BaseModel):
    """What a check compared, and where on the image it found it."""

    note: str
    region: Optional[BBoxOut] = None
    expected: Optional[str] = None
    observed: Optional[str] = None
    source_field: Optional[str] = None
    strength: Optional[float] = Field(
        default=None,
        description="Forensic signals only, 0-1. Never present on a decisive check.",
    )
    extra: Dict[str, Any] = Field(default_factory=dict)


class CheckOut(BaseModel):
    """One verifiable statement about a document."""

    id: str
    check_id: str
    check_type: str = Field(
        description="cryptographic | structural | cross_field | biometric | "
        "forensic | quality | policy"
    )
    result: str = Field(description="pass | fail | inconclusive | unavailable | retake")
    severity: str
    citation: str = Field(description="The sentence shown to the officer.")
    module: str
    sequence: int = 0
    evidence: List[EvidenceOut] = Field(default_factory=list)
    duration_ms: Optional[float] = None


class DocumentOut(BaseModel):
    """One document in a case, with everything read from it."""

    id: str
    doc_type: str
    filename: Optional[str] = None
    image_hash: Optional[str] = None
    image_url: Optional[str] = None
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    bboxes: Dict[str, Any] = Field(default_factory=dict)
    checks: List[CheckOut] = Field(default_factory=list)


class VerdictOut(BaseModel):
    """The verdict and the single sentence beside it."""

    verdict: str = Field(description="clear | reject | refer")
    reason: str
    needs_retake: bool = False
    counts: Dict[str, int] = Field(default_factory=dict)


class CaseCreated(BaseModel):
    """Returned immediately on submit, before any screening has run."""

    case_id: str
    status: str
    documents: int
    stream_url: str = Field(description="Subscribe here for live check results.")


class CaseSummary(BaseModel):
    """One row of the case list."""

    id: str
    created_at: UtcDatetime
    completed_at: Optional[UtcDatetime] = None
    officer_id: str
    status: str
    verdict: Optional[str] = None
    reason: Optional[str] = None
    duration_ms: Optional[float] = None
    document_count: int = 0
    doc_types: List[str] = Field(default_factory=list)


class CaseDetail(CaseSummary):
    """A full case, with its documents and every check."""

    error: Optional[str] = None
    documents: List[DocumentOut] = Field(default_factory=list)
