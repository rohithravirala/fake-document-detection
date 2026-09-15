"""The vocabulary every module and the backend share.

Read this before writing any module. If a concept is not here, it does not cross
a folder boundary.

Design rules encoded below, in order of importance:

1.  A module returns **checks**, never a verdict and never a bare boolean.
2.  Every check carries a **citation** — the sentence an officer reads out. A
    check that cannot produce one is not a check.
3.  "I could not run" (``UNAVAILABLE``) and "this document failed" (``FAIL``) are
    different results. A missing model must never look like a forgery.
4.  Only an ``AUTHORITATIVE`` check can support CLEAR. Appearance-based evidence
    can raise suspicion; it can never clear a document.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
#  Enumerations
# ---------------------------------------------------------------------------


class DocumentType(str, Enum):
    """Document types the system knows how to screen."""

    AADHAAR = "aadhaar"
    PAN = "pan"
    PASSPORT = "passport"
    VISA = "visa"
    UNKNOWN = "unknown"


class CheckResult(str, Enum):
    """The outcome of a single check.

    ``UNAVAILABLE`` and ``RETAKE`` exist so the system can be honest about its own
    limits instead of guessing. Both route a case to REFER; neither is a failure
    of the document.
    """

    PASS = "pass"
    FAIL = "fail"
    INCONCLUSIVE = "inconclusive"
    UNAVAILABLE = "unavailable"
    RETAKE = "retake"


class CheckType(str, Enum):
    """What kind of evidence a check rests on.

    This is the axis the verdict engine cares about most. It is the difference
    between "the issuing authority's signature verifies" and "this region looks
    like it was pasted".
    """

    CRYPTOGRAPHIC = "cryptographic"
    """A digital signature from the issuing authority verified. Decisive."""

    STRUCTURAL = "structural"
    """The document contradicts itself by arithmetic — a check digit, an encoded
    surname initial. Decisive, and provable on paper."""

    CROSS_FIELD = "cross_field"
    """A field from a trusted source disagrees with the printed text."""

    BIOMETRIC = "biometric"
    """Face comparison. Supports identity, not document authenticity."""

    FORENSIC = "forensic"
    """Appearance-based tampering signal. Suggestive only, never decisive."""

    QUALITY = "quality"
    """Capture quality gate. Governs whether analysis is meaningful at all."""

    POLICY = "policy"
    """Validity windows, expiry, entry rules."""


#: Check types whose PASS is strong enough to support a CLEAR verdict.
#: Nothing outside this set can clear a document, ever.
AUTHORITATIVE: frozenset = frozenset(
    {CheckType.CRYPTOGRAPHIC, CheckType.STRUCTURAL, CheckType.CROSS_FIELD}
)

#: Check types that may support a case but can never establish authenticity on
#: their own. A face match tells you the bearer matches the card; it tells you
#: nothing about whether the card is real.
ADVISORY: frozenset = frozenset({CheckType.FORENSIC, CheckType.BIOMETRIC})

#: Check types that may never return PASS at all.
#:
#: Only forensics. "This region shows no sign of tampering" is not a finding —
#: absence of a detectable signal is not evidence of authenticity, and reporting
#: it as a pass is how an appearance-based system ends up clearing a good
#: forgery. Forensics may return FAIL or INCONCLUSIVE, never PASS.
NEVER_PASSES: frozenset = frozenset({CheckType.FORENSIC})


class Severity(str, Enum):
    """How much weight a failure of this check carries."""

    CRITICAL = "critical"
    """The issuing authority's own signature or arithmetic says the document was
    altered. Rejection is not a judgement call."""

    HIGH = "high"
    """A trusted source contradicts the printed document."""

    MEDIUM = "medium"
    """Suspicious, needs a human."""

    LOW = "low"
    """Worth recording, not worth stopping anyone over."""

    INFO = "info"
    """Context for the examiner. Never affects the verdict."""


_SEVERITY_ORDER: Dict[str, int] = {
    Severity.INFO: 0,
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}


def severity_rank(severity: Severity) -> int:
    """Numeric ordering for severities, so they can be compared and sorted."""
    return _SEVERITY_ORDER[severity]


class Verdict(str, Enum):
    """What the officer is shown. There is no fourth option and no percentage."""

    CLEAR = "clear"
    REJECT = "reject"
    REFER = "refer"


# ---------------------------------------------------------------------------
#  Geometry and evidence
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BBox:
    """A region of the source image, in pixels, origin top-left.

    Every extracted field carries one. This is what lets the frontend crop the
    actual pixels behind a failed check instead of describing them in words.
    """

    x: int
    y: int
    w: int
    h: int

    def as_tuple(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.w, self.h)

    def to_dict(self) -> Dict[str, int]:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> BBox:
        return cls(x=int(data["x"]), y=int(data["y"]), w=int(data["w"]), h=int(data["h"]))

    def scaled(self, factor: float) -> BBox:
        return BBox(
            x=int(self.x * factor),
            y=int(self.y * factor),
            w=int(self.w * factor),
            h=int(self.h * factor),
        )


@dataclass
class Evidence:
    """The pixels and values behind a check, so a human can re-examine it.

    ``expected`` and ``observed`` are what make a citation concrete. "Surname
    mismatch" is an assertion; "number encodes S, card reads KUMAR" is evidence.
    """

    note: str
    region: Optional[BBox] = None
    expected: Optional[str] = None
    observed: Optional[str] = None
    source_field: Optional[str] = None
    strength: Optional[float] = None
    """For forensic signals only: 0.0-1.0. Never present on a decisive check."""

    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"note": self.note}
        if self.region is not None:
            out["region"] = self.region.to_dict()
        for key in ("expected", "observed", "source_field", "strength"):
            value = getattr(self, key)
            if value is not None:
                out[key] = value
        if self.extra:
            out["extra"] = self.extra
        return out


@dataclass
class ExtractedField:
    """One value read off a document, with where it came from and how sure we are.

    ``source`` matters as much as ``value``. A name read by OCR and a name taken
    from a signed QR payload are not interchangeable, and the cross-field checks
    exist precisely to compare them.
    """

    name: str
    value: str
    source: str
    """Which component produced this: ``ocr``, ``qr_signed``, ``mrz``, ``manual``."""

    confidence: float = 1.0
    bbox: Optional[BBox] = None
    raw: Optional[str] = None
    """The value before normalisation, kept for evidence."""

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "name": self.name,
            "value": self.value,
            "source": self.source,
            "confidence": round(self.confidence, 4),
        }
        if self.bbox is not None:
            out["bbox"] = self.bbox.to_dict()
        if self.raw is not None:
            out["raw"] = self.raw
        return out


# ---------------------------------------------------------------------------
#  The check — the unit of everything
# ---------------------------------------------------------------------------


@dataclass
class Check:
    """One verifiable statement about a document.

    Construct these through :func:`passed`, :func:`failed`, :func:`inconclusive`,
    :func:`unavailable` and :func:`retake` rather than by hand, so that the
    invariants below hold everywhere:

    * a FORENSIC check may never be constructed with a PASS result
    * every check has a citation
    """

    check_id: str
    check_type: CheckType
    result: CheckResult
    severity: Severity
    citation: str
    """One sentence, written for an officer, stating what was compared and what
    happened. This is the line printed next to the verdict."""

    evidence: List[Evidence] = field(default_factory=list)
    module: str = ""
    doc_type: Optional[DocumentType] = None
    duration_ms: Optional[float] = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex)

    def __post_init__(self) -> None:
        if not self.citation or not self.citation.strip():
            raise ValueError(
                f"check {self.check_id!r} has no citation; a check that cannot "
                "explain itself is not a check"
            )
        if self.check_type in NEVER_PASSES and self.result is CheckResult.PASS:
            raise ValueError(
                f"check {self.check_id!r} is {self.check_type.value} and cannot "
                "return PASS. Absence of a detectable tampering signal is not "
                "evidence of authenticity. Use INCONCLUSIVE."
            )

    # -- properties the verdict engine reads ------------------------------

    @property
    def is_authoritative(self) -> bool:
        """True when a PASS here can contribute to CLEAR."""
        return self.check_type in AUTHORITATIVE

    @property
    def is_failure(self) -> bool:
        return self.result is CheckResult.FAIL

    @property
    def blocks_clear(self) -> bool:
        """True when this check, whatever else happened, forbids a CLEAR verdict."""
        return self.result in (
            CheckResult.FAIL,
            CheckResult.INCONCLUSIVE,
            CheckResult.UNAVAILABLE,
            CheckResult.RETAKE,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "check_id": self.check_id,
            "check_type": self.check_type.value,
            "result": self.result.value,
            "severity": self.severity.value,
            "citation": self.citation,
            "evidence": [e.to_dict() for e in self.evidence],
            "module": self.module,
            "doc_type": self.doc_type.value if self.doc_type else None,
            "duration_ms": self.duration_ms,
        }


# -- constructors ---------------------------------------------------------


def passed(
    check_id: str,
    check_type: CheckType,
    citation: str,
    *,
    evidence: Optional[List[Evidence]] = None,
    module: str = "",
    severity: Severity = Severity.INFO,
) -> Check:
    """A check that the document satisfied."""
    return Check(
        check_id=check_id,
        check_type=check_type,
        result=CheckResult.PASS,
        severity=severity,
        citation=citation,
        evidence=evidence or [],
        module=module,
    )


def failed(
    check_id: str,
    check_type: CheckType,
    citation: str,
    severity: Severity,
    *,
    evidence: Optional[List[Evidence]] = None,
    module: str = "",
) -> Check:
    """A check the document contradicted. Severity is mandatory here."""
    return Check(
        check_id=check_id,
        check_type=check_type,
        result=CheckResult.FAIL,
        severity=severity,
        citation=citation,
        evidence=evidence or [],
        module=module,
    )


def inconclusive(
    check_id: str,
    check_type: CheckType,
    citation: str,
    *,
    severity: Severity = Severity.MEDIUM,
    evidence: Optional[List[Evidence]] = None,
    module: str = "",
) -> Check:
    """The check ran but the answer is genuinely uncertain.

    An explicit band, not a hedge. Forcing a binary answer out of weak input
    produces confident errors, which are worse than an honest "cannot determine".
    """
    return Check(
        check_id=check_id,
        check_type=check_type,
        result=CheckResult.INCONCLUSIVE,
        severity=severity,
        citation=citation,
        evidence=evidence or [],
        module=module,
    )


def unavailable(
    check_id: str,
    check_type: CheckType,
    citation: str,
    *,
    module: str = "",
    evidence: Optional[List[Evidence]] = None,
    severity: Severity = Severity.MEDIUM,
) -> Check:
    """The check could not run. Never a statement about the document.

    Severity says how much the absence matters. MEDIUM — the default — means a
    real question is left open and the case cannot be cleared. LOW is for a
    module marked ``required = False``, whose absence removes a bonus signal
    rather than a source of truth.
    """
    return Check(
        check_id=check_id,
        check_type=check_type,
        result=CheckResult.UNAVAILABLE,
        severity=severity,
        citation=citation,
        evidence=evidence or [],
        module=module,
    )


def retake(
    check_id: str,
    citation: str,
    *,
    module: str = "",
    evidence: Optional[List[Evidence]] = None,
) -> Check:
    """The capture is too poor to analyse. Ask for another photograph."""
    return Check(
        check_id=check_id,
        check_type=CheckType.QUALITY,
        result=CheckResult.RETAKE,
        severity=Severity.HIGH,
        citation=citation,
        evidence=evidence or [],
        module=module,
    )


# ---------------------------------------------------------------------------
#  Module input and output
# ---------------------------------------------------------------------------


@dataclass
class DocumentInput:
    """What a module is handed.

    ``fields`` carries anything already extracted by an earlier module, which is
    how the Aadhaar module compares signed QR data against the OCR text without
    running OCR itself.
    """

    image_path: Optional[str] = None
    doc_type: DocumentType = DocumentType.UNKNOWN
    document_id: Optional[str] = None
    fields: List[ExtractedField] = field(default_factory=list)
    profile: Dict[str, Any] = field(default_factory=dict)
    """The verification profile for this document type, loaded from the database.
    Thresholds and required fields live here, not in the code."""

    hints: Dict[str, Any] = field(default_factory=dict)

    def field_value(self, name: str, source: Optional[str] = None) -> Optional[str]:
        """Look up an extracted field by name, optionally restricted to a source."""
        for item in self.fields:
            if item.name == name and (source is None or item.source == source):
                return item.value
        return None

    def fields_named(self, name: str) -> List[ExtractedField]:
        return [item for item in self.fields if item.name == name]


@dataclass
class ModuleResult:
    """What a module hands back: checks, anything it extracted, and timing."""

    module: str
    checks: List[Check] = field(default_factory=list)
    fields: List[ExtractedField] = field(default_factory=list)
    duration_ms: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "module": self.module,
            "checks": [c.to_dict() for c in self.checks],
            "fields": [f.to_dict() for f in self.fields],
            "duration_ms": round(self.duration_ms, 2),
            "error": self.error,
        }


class Timer:
    """Small helper so every module reports duration the same way."""

    def __init__(self) -> None:
        self._start = 0.0
        self.elapsed_ms = 0.0

    def __enter__(self) -> Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *exc: Any) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000.0
