"""The orchestrator: run a case end to end.

The sequence, and why it is this sequence:

1.  **OCR first, always.** Everything downstream compares against what it
    produces, so it runs before any other module and its output is merged into
    the input the others receive.
2.  **Each remaining module in registry order**, filtered by the document type's
    profile. A module that is not installed reports UNAVAILABLE and the case
    continues — one missing dependency must not stop a screening.
3.  **Persist and publish each check as it lands**, so the officer watches the
    screening happen rather than watching a spinner.
4.  **Face search across prior screenings**, which is the only check that looks
    beyond the document in hand.
5.  **Decide, then write the audit record**, in the same transaction as the work
    it describes.

Nothing in this file decides whether a document is genuine. It collects checks
and hands them to the verdict engine.
"""

from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.models.case import Case, CaseStatus
from backend.app.models.check import CheckRecord
from backend.app.models.document import Document
from backend.app.models.face import FaceEncounter
from backend.app.services import audit, events, faces, profiles
from backend.app.verdict import VerdictResult, combine, decide
from modules.common.types import (
    Check,
    DocumentInput,
    DocumentType,
    ExtractedField,
    ModuleResult,
)
from modules.common.verifier import load_all, registry

log = logging.getLogger(__name__)

#: Field names that identify a document, used for the face encounter record.
_NUMBER_FIELDS = ("aadhaar_number", "pan_number", "passport_number", "document_number")

_registry_loaded = False


def ensure_modules_loaded() -> None:
    """Import every module package once, so the registry is populated."""
    global _registry_loaded
    if not _registry_loaded:
        load_all()
        _registry_loaded = True


def _to_document_type(value: str) -> DocumentType:
    try:
        return DocumentType(value)
    except ValueError:
        return DocumentType.UNKNOWN


def _event(target_case: str, kind: str, **payload: Any) -> None:
    """Publish one stream event.

    The first parameter is deliberately not called ``case_id``: several callers
    pass ``case_id=`` inside the payload, and a matching parameter name would
    swallow it as the positional argument instead.
    """
    events.publish(target_case, {"type": kind, **payload})


def _persist_check(
    session: Session, document: Document, check: Check, sequence: int
) -> CheckRecord:
    record = CheckRecord(
        document_id=document.id,
        sequence=sequence,
        check_id=check.check_id,
        check_type=check.check_type.value,
        result=check.result.value,
        severity=check.severity.value,
        citation=check.citation,
        module=check.module,
        evidence=[e.to_dict() for e in check.evidence],
        duration_ms=check.duration_ms,
    )
    session.add(record)
    return record


def _selected_modules(profile: Dict[str, Any]) -> Optional[set]:
    names = profile.get("modules")
    return set(names) if names else None


def run_modules(
    document_input: DocumentInput,
    *,
    allowed: Optional[set] = None,
    on_check: Optional[Callable[[Check], None]] = None,
    on_module: Optional[Callable[[str, str, ModuleResult], None]] = None,
) -> List[Check]:
    """Run every applicable module against one input and return its checks.

    Shared deliberately between the screening service and the evaluation
    harness, so the harness measures the code that actually runs rather than a
    reimplementation of it that could drift away from it silently.

    Fields extracted by one module are appended to ``document_input`` before the
    next runs. That is how the Aadhaar module compares signed QR data against
    text the OCR module read, without running OCR itself.
    """
    ensure_modules_loaded()

    collected: List[Check] = []
    verifiers = [
        verifier
        for verifier in registry.for_document(document_input.doc_type)
        if allowed is None or verifier.name in allowed
    ]

    for verifier in verifiers:
        if on_module is not None:
            on_module("start", verifier.name, ModuleResult(module=verifier.name))

        result = verifier.run(document_input)
        if result.fields:
            document_input.fields.extend(result.fields)

        for check in result.checks:
            collected.append(check)
            if on_check is not None:
                on_check(check)

        if on_module is not None:
            on_module("complete", verifier.name, result)

    return collected


def screen_document(session: Session, case: Case, document: Document) -> VerdictResult:
    """Run every applicable module against one document and persist the results."""
    ensure_modules_loaded()

    doc_type = _to_document_type(document.doc_type)
    profile = profiles.load(session, doc_type.value)
    allowed = _selected_modules(profile)

    document_input = DocumentInput(
        image_path=document.image_path,
        doc_type=doc_type,
        document_id=document.id,
        fields=[
            ExtractedField(
                name=name,
                value=str(value),
                source="manual",
                confidence=1.0,
            )
            for name, value in (document.extracted_fields or {}).items()
            if value is not None and name != "raw_text"
        ],
        profile=profile,
    )

    collected: List[Check] = []
    sequence = 0

    verifiers = [
        verifier
        for verifier in registry.for_document(doc_type)
        if allowed is None or verifier.name in allowed
    ]

    _event(
        case.id,
        "document.start",
        document_id=document.id,
        doc_type=doc_type.value,
        modules=[v.name for v in verifiers],
    )

    for verifier in verifiers:
        _event(case.id, "module.start", document_id=document.id, module=verifier.name)
        result = verifier.run(document_input)

        # Later modules compare against what earlier ones extracted.
        if result.fields:
            document_input.fields.extend(result.fields)

        for check in result.checks:
            sequence += 1
            collected.append(check)
            _persist_check(session, document, check, sequence)
            _event(
                case.id,
                "check",
                document_id=document.id,
                sequence=sequence,
                check=check.to_dict(),
            )

        _event(
            case.id,
            "module.complete",
            document_id=document.id,
            module=verifier.name,
            duration_ms=round(result.duration_ms, 1),
            error=result.error,
        )

    # -- prior encounters, if a face was embedded ---------------------------
    face_checks = _screen_faces(session, case, document, document_input)
    for check in face_checks:
        sequence += 1
        collected.append(check)
        _persist_check(session, document, check, sequence)
        _event(
            case.id,
            "check",
            document_id=document.id,
            sequence=sequence,
            check=check.to_dict(),
        )

    # -- persist what was extracted ----------------------------------------
    #
    # First write wins, and that is the whole point. OCR runs first, so this
    # keeps what was *printed on the document*; the QR-signed and MRZ values
    # arrive later under the same field names and must not overwrite it.
    #
    # Letting them overwrite is subtly wrong in the one place it matters most:
    # the officer's screen would show the signed name beside a card that reads
    # something else, which is exactly the contradiction the screening exists to
    # surface. The trusted values are not lost — every cross-field check carries
    # them as `evidence.expected`.
    extracted: Dict[str, str] = {}
    for item in document_input.fields:
        if item.name in ("face_embedding", "live_face_embedding"):
            continue
        extracted.setdefault(item.name, item.value)
    document.extracted_fields = extracted
    document.bboxes = {
        item.name: item.bbox.to_dict()
        for item in document_input.fields
        if item.bbox is not None
    }

    verdict = decide(collected)
    _event(
        case.id,
        "document.complete",
        document_id=document.id,
        verdict=verdict.verdict.value,
        reason=verdict.reason,
    )
    return verdict


def _screen_faces(
    session: Session, case: Case, document: Document, document_input: DocumentInput
) -> List[Check]:
    """Store this screening's embedding and compare it against prior ones."""
    settings = get_settings()

    raw = document_input.field_value("face_embedding")
    if not raw:
        return []

    try:
        embedding = [float(v) for v in raw.split(",") if v]
    except ValueError:
        return []
    if not embedding:
        return []

    doc_number = None
    for name in _NUMBER_FIELDS:
        doc_number = document_input.field_value(name)
        if doc_number:
            break

    found = faces.search(
        session,
        embedding,
        exclude_case_id=case.id,
        limit=settings.face_search_limit,
        threshold=settings.face_search_threshold,
    )

    session.add(
        FaceEncounter(
            case_id=case.id,
            embedding=embedding,
            source="document",
            doc_type=document.doc_type,
            doc_number=doc_number,
            name=document_input.field_value("name"),
        )
    )

    check = faces.multiple_identity_check(found, doc_number)
    return [check] if check is not None else []


def run_case(session: Session, case_id: str) -> Case:
    """Screen every document in a case and record the composite verdict."""
    started = time.perf_counter()
    case = session.get(Case, case_id)
    if case is None:
        raise LookupError(f"case {case_id} not found")

    case.status = CaseStatus.RUNNING
    session.flush()
    _event(case.id, "case.start", case_id=case.id, documents=len(case.documents))

    try:
        results = [
            screen_document(session, case, document) for document in case.documents
        ]
        composite = combine(results)

        case.verdict = composite.verdict.value
        case.reason = composite.reason
        case.status = CaseStatus.COMPLETE
        case.completed_at = dt.datetime.now(dt.timezone.utc)
        case.duration_ms = (time.perf_counter() - started) * 1000.0

        audit.append(
            session,
            action="screening.complete",
            officer_id=case.officer_id,
            case_id=case.id,
            payload={
                "case_id": case.id,
                "verdict": composite.verdict.value,
                "reason": composite.reason,
                "documents": [
                    {
                        "id": d.id,
                        "doc_type": d.doc_type,
                        "image_hash": d.image_hash,
                        "checks": len(d.checks),
                    }
                    for d in case.documents
                ],
                "counts": composite.counts,
            },
        )

        _event(
            case.id,
            "case.complete",
            case_id=case.id,
            verdict=composite.verdict.value,
            reason=composite.reason,
            duration_ms=round(case.duration_ms, 1),
            needs_retake=composite.needs_retake,
        )
        return case

    except Exception as exc:  # noqa: BLE001
        log.exception("screening failed for case %s", case_id)
        case.status = CaseStatus.FAILED
        case.error = f"{type(exc).__name__}: {exc}"
        case.completed_at = dt.datetime.now(dt.timezone.utc)
        # A crash is not a verdict. The case has no verdict at all, which the
        # interface shows as an error rather than as a result.
        _event(case.id, "case.failed", case_id=case.id, error=case.error)
        raise
