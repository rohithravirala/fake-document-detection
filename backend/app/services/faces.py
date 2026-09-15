"""Searching prior screenings for the same face.

This is the check that catches what document verification cannot: one person
presenting several identities. Every screening stores an embedding; every
screening is compared against all the ones before it.

Two implementations of the same search, chosen by backend:

**pgvector** — ``ORDER BY embedding <=> $1 LIMIT n`` runs the nearest-neighbour
search inside Postgres. This is why the project needs no separate vector
database.

**Python scan** — on SQLite, every stored embedding is compared in a loop. Same
answers, linear cost. Fine for a demonstration, wrong for a border post, which is
exactly why Postgres is the real deployment target.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import _pgvector_available
from backend.app.models.face import FaceEncounter
from modules.common.types import (
    Check,
    CheckType,
    Evidence,
    Severity,
    failed,
    passed,
)

log = logging.getLogger(__name__)


@dataclass
class Encounter:
    """A prior screening whose face resembles the current one."""

    encounter_id: str
    case_id: str
    similarity: float
    doc_number: Optional[str]
    doc_type: Optional[str]
    name: Optional[str]
    captured_at: Optional[str]


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    import numpy as np

    left = np.asarray(a, dtype="float32")
    right = np.asarray(b, dtype="float32")
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    if denominator == 0.0:
        return 0.0
    return float(np.dot(left, right) / denominator)


def search(
    session: Session,
    embedding: Sequence[float],
    *,
    exclude_case_id: Optional[str] = None,
    limit: int = 5,
    threshold: float = 0.85,
) -> List[Encounter]:
    """Find prior encounters similar to this embedding, most similar first."""
    settings = get_settings()

    if settings.is_postgres and _pgvector_available():
        statement = select(
            FaceEncounter,
            FaceEncounter.embedding.cosine_distance(list(embedding)).label("distance"),
        ).where(FaceEncounter.embedding.is_not(None))
        if exclude_case_id:
            statement = statement.where(FaceEncounter.case_id != exclude_case_id)
        statement = statement.order_by("distance").limit(limit * 4)

        results: List[Encounter] = []
        for row, distance in session.execute(statement).all():
            similarity = 1.0 - float(distance)
            if similarity < threshold:
                continue
            results.append(_to_encounter(row, similarity))
        return results[:limit]

    # SQLite: compare in Python.
    statement = select(FaceEncounter).where(FaceEncounter.embedding.is_not(None))
    if exclude_case_id:
        statement = statement.where(FaceEncounter.case_id != exclude_case_id)

    scored: List[Encounter] = []
    for row in session.execute(statement).scalars().all():
        if not row.embedding:
            continue
        try:
            similarity = _cosine(embedding, row.embedding)
        except Exception:  # noqa: BLE001
            continue
        if similarity >= threshold:
            scored.append(_to_encounter(row, similarity))

    scored.sort(key=lambda e: e.similarity, reverse=True)
    return scored[:limit]


def _to_encounter(row: FaceEncounter, similarity: float) -> Encounter:
    return Encounter(
        encounter_id=row.id,
        case_id=row.case_id,
        similarity=round(similarity, 4),
        doc_number=row.doc_number,
        doc_type=row.doc_type,
        name=row.name,
        captured_at=row.captured_at.isoformat() if row.captured_at else None,
    )


def multiple_identity_check(
    encounters: Sequence[Encounter], current_number: Optional[str]
) -> Optional[Check]:
    """Report a face seen before under a *different* document number.

    Seeing the same face with the same number is a repeat screening of the same
    person, which is normal and is reported as context. Seeing it with a
    different number is the finding.
    """
    if not encounters:
        return None

    conflicting = [
        e
        for e in encounters
        if e.doc_number and current_number and e.doc_number != current_number
    ]

    if conflicting:
        top = conflicting[0]
        listed = ", ".join(
            f"{e.doc_number} ({e.similarity:.2f})" for e in conflicting[:3]
        )
        return failed(
            "face.multiple_identity",
            CheckType.BIOMETRIC,
            f"This face was screened before under a different document number. "
            f"Previous: {listed}. Current: {current_number}. One person is "
            "presenting more than one identity.",
            Severity.CRITICAL,
            evidence=[
                Evidence(
                    note="matching face on a different document number",
                    expected=current_number,
                    observed=top.doc_number,
                    strength=top.similarity,
                    extra={
                        "prior_encounters": [
                            {
                                "case_id": e.case_id,
                                "doc_number": e.doc_number,
                                "doc_type": e.doc_type,
                                "similarity": e.similarity,
                                "captured_at": e.captured_at,
                            }
                            for e in conflicting[:5]
                        ]
                    },
                )
            ],
            module="face",
        )

    top = encounters[0]
    return passed(
        "face.prior_encounters",
        CheckType.BIOMETRIC,
        f"This face has been screened {len(encounters)} time(s) before, each "
        "under the same document number.",
        evidence=[
            Evidence(
                note="prior encounters are consistent",
                observed=str(len(encounters)),
                strength=top.similarity,
                extra={
                    "prior_encounters": [
                        {
                            "case_id": e.case_id,
                            "doc_number": e.doc_number,
                            "similarity": e.similarity,
                            "captured_at": e.captured_at,
                        }
                        for e in encounters[:5]
                    ]
                },
            )
        ],
        module="face",
    )
