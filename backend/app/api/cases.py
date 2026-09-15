"""Submitting and reading screenings.

``POST /api/cases`` returns a ``case_id`` immediately and does not wait for the
screening. That is not an optimisation — a full screening takes seconds, and
holding the request open would make the live check stream impossible.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_session
from backend.app.models.case import Case, CaseStatus
from backend.app.models.check import CheckRecord
from backend.app.models.document import Document
from backend.app.schemas.case import (
    CaseCreated,
    CaseDetail,
    CaseSummary,
    CheckOut,
    DocumentOut,
)
from backend.app.services import audit, storage
from backend.app.workers import enqueue
from modules.common.types import DocumentType

log = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["cases"])


def _valid_doc_type(value: Optional[str]) -> str:
    if not value:
        return DocumentType.UNKNOWN.value
    try:
        return DocumentType(value.lower()).value
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"'{value}' is not a document type this system screens. "
                f"Accepted: {', '.join(t.value for t in DocumentType)}"
            ),
        ) from exc


def _create_case(session: Session, officer_id: str) -> Case:
    case = Case(officer_id=officer_id, status=CaseStatus.QUEUED)
    session.add(case)
    session.flush()
    return case


@router.post("", response_model=CaseCreated, status_code=202, summary="Submit documents")
def submit(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="One or more document images"),
    doc_types: Optional[List[str]] = Form(
        None, description="Document type per file, in the same order"
    ),
    session: Session = Depends(get_session),
) -> CaseCreated:
    """Accept documents, queue the screening, return the case id at once."""
    settings = get_settings()
    if not files:
        raise HTTPException(status_code=422, detail="no files were uploaded")

    case = _create_case(session, settings.officer_id)
    stored_any = False

    for index, upload in enumerate(files):
        declared = doc_types[index] if doc_types and index < len(doc_types) else None
        doc_type = _valid_doc_type(declared)
        try:
            stored = storage.save_stream(upload.file, upload.filename or "")
        except storage.UnsupportedFile as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        session.add(
            Document(
                case_id=case.id,
                doc_type=doc_type,
                filename=upload.filename,
                image_path=str(stored.path),
                image_hash=stored.sha256,
                extracted_fields={},
                bboxes={},
            )
        )
        stored_any = True

    if not stored_any:
        raise HTTPException(status_code=422, detail="no usable documents were uploaded")

    audit.append(
        session,
        action="case.submitted",
        officer_id=case.officer_id,
        case_id=case.id,
        payload={"case_id": case.id, "documents": len(files)},
    )
    session.commit()

    enqueue(case.id, background_tasks)
    return CaseCreated(
        case_id=case.id,
        status=CaseStatus.QUEUED.value,
        documents=len(files),
        stream_url=f"/api/cases/{case.id}/stream",
    )


@router.post(
    "/manual",
    response_model=CaseCreated,
    status_code=202,
    summary="Submit field values without an image",
)
def submit_manual(
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any] = Body(
        ...,
        examples=[
            {
                "documents": [
                    {
                        "doc_type": "pan",
                        "fields": {"pan_number": "ABCPK1234X", "name": "RAHUL KUMAR"},
                    }
                ]
            }
        ],
    ),
    session: Session = Depends(get_session),
) -> CaseCreated:
    """Screen field values directly, with no image.

    This is how the validators are demonstrated on a machine with no OCR engine
    installed, and how the evaluation harness drives known inputs through the
    real code path rather than through a mock.
    """
    settings = get_settings()
    documents = payload.get("documents") or []
    if not documents:
        raise HTTPException(status_code=422, detail="'documents' must not be empty")

    case = _create_case(session, settings.officer_id)
    for entry in documents:
        fields = entry.get("fields") or {}
        if not isinstance(fields, dict):
            raise HTTPException(status_code=422, detail="'fields' must be an object")
        session.add(
            Document(
                case_id=case.id,
                doc_type=_valid_doc_type(entry.get("doc_type")),
                filename=None,
                image_path=None,
                image_hash=None,
                extracted_fields={k: str(v) for k, v in fields.items()},
                bboxes={},
            )
        )

    audit.append(
        session,
        action="case.submitted",
        officer_id=case.officer_id,
        case_id=case.id,
        payload={"case_id": case.id, "documents": len(documents), "source": "manual"},
    )
    session.commit()

    enqueue(case.id, background_tasks)
    return CaseCreated(
        case_id=case.id,
        status=CaseStatus.QUEUED.value,
        documents=len(documents),
        stream_url=f"/api/cases/{case.id}/stream",
    )


def _check_out(record: CheckRecord) -> CheckOut:
    return CheckOut(
        id=record.id,
        check_id=record.check_id,
        check_type=record.check_type,
        result=record.result,
        severity=record.severity,
        citation=record.citation,
        module=record.module,
        sequence=record.sequence,
        evidence=record.evidence or [],
        duration_ms=record.duration_ms,
    )


def _document_out(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        doc_type=document.doc_type,
        filename=document.filename,
        image_hash=document.image_hash,
        image_url=(
            f"/api/cases/{document.case_id}/documents/{document.id}/image"
            if document.image_path
            else None
        ),
        extracted_fields=document.extracted_fields or {},
        bboxes=document.bboxes or {},
        checks=[_check_out(c) for c in sorted(document.checks, key=lambda c: c.sequence)],
    )


@router.get("", response_model=List[CaseSummary], summary="Case history")
def list_cases(
    session: Session = Depends(get_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    verdict: Optional[str] = Query(None, description="clear | reject | refer"),
    status: Optional[str] = Query(None),
) -> List[CaseSummary]:
    statement = select(Case).order_by(Case.created_at.desc())
    if verdict:
        statement = statement.where(Case.verdict == verdict.lower())
    if status:
        statement = statement.where(Case.status == status.lower())
    statement = statement.limit(limit).offset(offset)

    cases = session.execute(statement).scalars().all()
    return [
        CaseSummary(
            id=case.id,
            created_at=case.created_at,
            completed_at=case.completed_at,
            officer_id=case.officer_id,
            status=case.status.value,
            verdict=case.verdict,
            reason=case.reason,
            duration_ms=case.duration_ms,
            document_count=len(case.documents),
            doc_types=[d.doc_type for d in case.documents],
        )
        for case in cases
    ]


@router.get("/{case_id}", response_model=CaseDetail, summary="One case with its checks")
def get_case(case_id: str, session: Session = Depends(get_session)) -> CaseDetail:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"case {case_id} not found")

    return CaseDetail(
        id=case.id,
        created_at=case.created_at,
        completed_at=case.completed_at,
        officer_id=case.officer_id,
        status=case.status.value,
        verdict=case.verdict,
        reason=case.reason,
        duration_ms=case.duration_ms,
        error=case.error,
        document_count=len(case.documents),
        doc_types=[d.doc_type for d in case.documents],
        documents=[_document_out(d) for d in case.documents],
    )


@router.get(
    "/{case_id}/documents/{document_id}/image",
    summary="The stored image, for evidence crops",
)
def get_image(
    case_id: str, document_id: str, session: Session = Depends(get_session)
) -> FileResponse:
    """Serve the screened image so the frontend can crop evidence from it."""
    document = session.get(Document, document_id)
    if document is None or document.case_id != case_id or not document.image_path:
        raise HTTPException(status_code=404, detail="image not found")

    from pathlib import Path

    path = Path(document.image_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="image file is missing from storage")
    return FileResponse(path)
