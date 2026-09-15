"""Searching stored face encounters.

The search runs over **embeddings**, never photographs. Nothing biometric is
stored in an image form, so there is nothing here to leak and nothing to show
back — a result names the case it came from, not a face.

The endpoint reports itself unavailable when no face model is installed, rather
than returning an empty result set. "We found no matches" and "we cannot look"
are different answers and the officer has to be able to tell them apart.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_session
from backend.app.models.case import Case
from backend.app.models.face import FaceEncounter
from backend.app.services import faces as face_service
from backend.app.services import storage

router = APIRouter(prefix="/faces", tags=["faces"])


@router.get("/status", summary="Whether face search can run here")
def status(session: Session = Depends(get_session)) -> Dict[str, Any]:
    from modules.face import embedder

    stored = session.execute(select(FaceEncounter)).scalars().all()
    return {
        "available": embedder.available(),
        "requirement": embedder.requirements(),
        "encounters_stored": len(stored),
        "distinct_document_numbers": len({e.doc_number for e in stored if e.doc_number}),
        "note": (
            "Embeddings only. No face image is ever stored, and the model runs "
            "on this machine — nothing biometric leaves the deployment boundary."
        ),
    }


@router.post("/search", summary="Find prior screenings with a similar face")
def search(
    file: UploadFile = File(..., description="A photograph containing one face"),
    threshold: float = Form(0.70),
    limit: int = Form(10),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    from modules.face import embedder

    if not embedder.available():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Face search is not available in this deployment: it needs "
                f"{embedder.requirements()}. No conclusion should be drawn from "
                "the absence of results."
            ),
        )

    try:
        stored = storage.save_stream(file.file, file.filename or "")
    except storage.UnsupportedFile as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    detected = embedder.embed_file(str(stored.path))
    if detected is None:
        raise HTTPException(
            status_code=422, detail="No face could be located in that image."
        )
    if not detected.usable:
        raise HTTPException(
            status_code=422,
            detail=(
                f"The face is only {detected.pixels} pixels across, below the "
                "floor for a meaningful comparison. Use a closer photograph."
            ),
        )

    settings = get_settings()
    matches = face_service.search(
        session,
        detected.embedding,
        limit=min(limit, 50),
        threshold=max(0.0, min(1.0, threshold)),
    )

    results: List[Dict[str, Any]] = []
    for match in matches:
        case = session.get(Case, match.case_id)
        results.append(
            {
                "encounter_id": match.encounter_id,
                "case_id": match.case_id,
                "similarity": match.similarity,
                "doc_type": match.doc_type,
                "doc_number": match.doc_number,
                "name": match.name,
                "captured_at": match.captured_at,
                "verdict": case.verdict if case else None,
            }
        )

    distinct_numbers = {r["doc_number"] for r in results if r["doc_number"]}
    return {
        "face": {
            "bbox": detected.bbox.to_dict(),
            "pixels": detected.pixels,
            "detection_score": round(detected.detection_score, 3),
        },
        "threshold": threshold,
        "matches": results,
        # The finding that matters: one face, more than one document number.
        "multiple_identity": len(distinct_numbers) > 1,
        "distinct_document_numbers": sorted(distinct_numbers),
        "officer_id": settings.officer_id,
    }
