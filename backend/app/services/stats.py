"""Aggregates for the dashboard and the analytics screen.

Every number here is computed from the cases actually screened. None of it is
seeded, padded or rounded up — a dashboard that flatters the system is worse
than no dashboard, because the first question an evaluator asks is where the
figure came from.

Where a figure cannot honestly be produced (accuracy against real forgeries,
geographic distribution with no location data), the endpoint returns ``None``
and the interface says so rather than inventing one.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.case import Case, CaseStatus
from backend.app.models.check import CheckRecord
from backend.app.models.document import Document
from backend.app.models.face import FaceEncounter

#: check_id prefix -> the reason an officer would recognise. Used for the
#: rejection-reason breakdown, so the chart names causes rather than check ids.
REASON_LABELS = {
    "aadhaar.qr_signature": "Invalid UIDAI signature",
    "aadhaar.qr_vs_printed": "Card contradicts signed data",
    "aadhaar.number_checksum": "Invalid Aadhaar number",
    "aadhaar.number_vs_qr": "QR belongs to another number",
    "pan.format": "Malformed PAN",
    "pan.category": "Invalid holder category",
    "pan.surname_initial": "Number and name disagree",
    "passport.check_digit": "MRZ check digit failed",
    "passport.mrz_vs_printed": "Data page contradicts MRZ",
    "passport.expiry": "Document expired",
    "face.live_vs_document": "Face mismatch",
    "face.printed_vs_signed": "Photograph replaced",
    "face.multiple_identity": "Multiple identities",
    "forensics.": "Tampering signal",
    "ocr.": "Capture quality",
}

#: Labels for checks that did not fail. A check that came back inconclusive or
#: could not run describes a **gap in evidence**, and naming it the same way as a
#: failure is how a dashboard ends up reporting a "tampering signal" on a
#: document where forensics found nothing at all.
UNRESOLVED_LABELS = {
    "aadhaar.qr_signature": "QR not cryptographically signed",
    "aadhaar.qr_present": "No QR could be read",
    "aadhaar.qr_readable": "QR unreadable",
    "aadhaar.number_checksum": "Aadhaar number not read",
    "passport.mrz_present": "No MRZ found",
    "passport.mrz_readable": "MRZ unreadable",
    "passport.check_digit": "Check digit not evaluable",
    "pan.surname_initial": "No name to compare",
    "pan.number_present": "No PAN number read",
    "face.": "Face comparison unavailable",
    "forensics.": "No tampering signal found",
    "ocr.quality": "Capture too poor to analyse",
    "ocr.": "Nothing read from the document",
}


def _label_for(check_id: str, result: str = "fail") -> str:
    """Name the cause. Failures and unresolved checks get different vocabularies."""
    table = REASON_LABELS if result == "fail" else UNRESOLVED_LABELS
    for prefix, label in table.items():
        if check_id.startswith(prefix):
            return label
    return check_id


def _window(days: int) -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)


def _percent_change(current: int, previous: int) -> Optional[float]:
    """Change between two periods, or ``None`` when there is no baseline.

    Returning ``None`` rather than 0 or 100 matters: with one week of data there
    is nothing to compare against, and a made-up "+12%" on a demonstration
    dashboard is exactly the kind of detail that unravels under a question.
    """
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


@dataclass
class Totals:
    total: int = 0
    clear: int = 0
    reject: int = 0
    refer: int = 0
    pending: int = 0
    failed: int = 0

    def to_dict(self) -> Dict[str, Any]:
        decided = self.clear + self.reject + self.refer
        share = lambda n: round(n / decided * 100, 1) if decided else 0.0  # noqa: E731
        return {
            "total": self.total,
            "clear": self.clear,
            "reject": self.reject,
            "refer": self.refer,
            "pending": self.pending,
            "failed": self.failed,
            "clear_share": share(self.clear),
            "reject_share": share(self.reject),
            "refer_share": share(self.refer),
        }


def _totals(session: Session, since: Optional[dt.datetime] = None) -> Totals:
    statement = select(Case.verdict, Case.status, func.count()).group_by(
        Case.verdict, Case.status
    )
    if since is not None:
        statement = statement.where(Case.created_at >= since)

    totals = Totals()
    for verdict, status, count in session.execute(statement).all():
        totals.total += count
        if status == CaseStatus.FAILED:
            totals.failed += count
        elif verdict == "clear":
            totals.clear += count
        elif verdict == "reject":
            totals.reject += count
        elif verdict == "refer":
            totals.refer += count
        else:
            totals.pending += count
    return totals


def overview(session: Session, *, days: int = 30) -> Dict[str, Any]:
    """Headline counters for the dashboard."""
    now = dt.datetime.now(dt.timezone.utc)
    current = _totals(session, _window(days))
    previous_start = now - dt.timedelta(days=days * 2)
    previous_total = session.execute(
        select(func.count())
        .select_from(Case)
        .where(Case.created_at >= previous_start, Case.created_at < _window(days))
    ).scalar_one()

    all_time = _totals(session)
    unique_faces = session.execute(
        select(func.count(func.distinct(FaceEncounter.doc_number)))
    ).scalar_one()

    mean_ms = session.execute(
        select(func.avg(Case.duration_ms)).where(Case.duration_ms.is_not(None))
    ).scalar_one()

    return {
        "window_days": days,
        "period": current.to_dict(),
        "all_time": all_time.to_dict(),
        "change_percent": _percent_change(current.total, previous_total),
        "mean_duration_ms": round(float(mean_ms), 1) if mean_ms is not None else None,
        "unique_identities": unique_faces,
    }


def trend(session: Session, *, days: int = 15) -> List[Dict[str, Any]]:
    """Per-day verdict counts, oldest first. Days with no screenings are zeroed."""
    since = _window(days)
    rows = session.execute(
        select(Case.created_at, Case.verdict).where(Case.created_at >= since)
    ).all()

    buckets: Dict[str, Counter] = {}
    for created_at, verdict in rows:
        if created_at is None:
            continue
        key = created_at.date().isoformat()
        buckets.setdefault(key, Counter())[verdict or "pending"] += 1

    today = dt.datetime.now(dt.timezone.utc).date()
    series = []
    for offset in range(days - 1, -1, -1):
        day = (today - dt.timedelta(days=offset)).isoformat()
        counts = buckets.get(day, Counter())
        series.append(
            {
                "date": day,
                "clear": counts.get("clear", 0),
                "reject": counts.get("reject", 0),
                "refer": counts.get("refer", 0),
            }
        )
    return series


def by_document_type(session: Session) -> List[Dict[str, Any]]:
    rows = session.execute(
        select(Document.doc_type, func.count()).group_by(Document.doc_type)
    ).all()
    total = sum(count for _, count in rows) or 1
    return sorted(
        (
            {
                "doc_type": doc_type,
                "count": count,
                "share": round(count / total * 100, 1),
            }
            for doc_type, count in rows
        ),
        key=lambda row: row["count"],
        reverse=True,
    )


def rejection_reasons(session: Session, *, limit: int = 8) -> List[Dict[str, Any]]:
    """Which checks actually caused rejections, most common first."""
    rows = session.execute(
        select(CheckRecord.check_id, func.count())
        .where(CheckRecord.result == "fail")
        .group_by(CheckRecord.check_id)
    ).all()

    grouped: Counter = Counter()
    for check_id, count in rows:
        grouped[_label_for(check_id, "fail")] += count

    total = sum(grouped.values()) or 1
    return [
        {"reason": reason, "count": count, "share": round(count / total * 100, 1)}
        for reason, count in grouped.most_common(limit)
    ]


def check_outcomes(session: Session) -> Dict[str, int]:
    """Every check ever run, by result. The denominator behind any claim made."""
    rows = session.execute(
        select(CheckRecord.result, func.count()).group_by(CheckRecord.result)
    ).all()
    return dict(rows)


def identity_links(session: Session) -> Dict[str, Any]:
    """Faces seen under more than one document number.

    This is the finding document verification cannot reach on its own: a genuine
    card in the hands of someone already screened under another identity.
    """
    rows = session.execute(
        select(CheckRecord.check_id, func.count())
        .where(CheckRecord.check_id == "face.multiple_identity")
        .group_by(CheckRecord.check_id)
    ).all()
    flagged = rows[0][1] if rows else 0

    encounters = session.execute(
        select(func.count()).select_from(FaceEncounter)
    ).scalar_one()
    distinct_numbers = session.execute(
        select(func.count(func.distinct(FaceEncounter.doc_number)))
    ).scalar_one()

    return {
        "encounters_stored": encounters,
        "distinct_document_numbers": distinct_numbers,
        "flagged": flagged,
    }


def high_risk_cases(session: Session, *, limit: int = 6) -> List[Dict[str, Any]]:
    """Recent rejections and referrals, with the check that caused them."""
    cases = (
        session.execute(
            select(Case)
            .where(Case.verdict.in_(("reject", "refer")))
            .order_by(Case.created_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )

    out: List[Dict[str, Any]] = []
    for case in cases:
        # A rejection always has a failure behind it. A referral often does not —
        # it is referred precisely because nothing decisive was found — so fall
        # back to whatever check left the question open. Using the verdict
        # sentence here instead produced a four-line cell in a table column.
        worst = None
        for document in case.documents:
            for check in document.checks:
                if check.result == "fail":
                    worst = check
                    break
            if worst:
                break
        if worst is None:
            # Forensics is skipped here. It returns INCONCLUSIVE on every
            # document that runs it — that is its normal state, not a cause —
            # so naming it as the reason for a referral would put "no tampering
            # signal found" in a column headed "cause".
            unresolved = [
                check
                for document in case.documents
                for check in document.checks
                if check.result in ("unavailable", "inconclusive", "retake")
                and not check.check_id.startswith("forensics.")
            ]
            worst = unresolved[0] if unresolved else None
        out.append(
            {
                "case_id": case.id,
                "created_at": case.created_at.isoformat() if case.created_at else None,
                "doc_types": [d.doc_type for d in case.documents],
                "verdict": case.verdict,
                "reason": _label_for(worst.check_id, worst.result)
                if worst
                else "No verifiable source of truth",
                "severity": worst.severity if worst else "medium",
            }
        )
    return out


def analytics(session: Session, *, days: int = 15) -> Dict[str, Any]:
    """Everything the analytics screen renders, in one round trip."""
    return {
        "overview": overview(session, days=30),
        "trend": trend(session, days=days),
        "document_types": by_document_type(session),
        "rejection_reasons": rejection_reasons(session),
        "check_outcomes": check_outcomes(session),
        "identity_links": identity_links(session),
        "high_risk": high_risk_cases(session),
        # Stated explicitly rather than omitted: there is no lawful corpus of
        # real forged documents to measure against, so no accuracy figure is
        # published here. The synthetic evaluation set lives in evaluation/.
        "accuracy": None,
        "accuracy_note": (
            "No accuracy figure is published. Measuring against a synthetic set "
            "built alongside the system would say nothing about real forgeries. "
            "See evaluation/ for what is measured."
        ),
        # No location is captured at screening time, so there is nothing to map.
        "geography": None,
        "geography_note": "Screenings carry no location data, so none is shown.",
    }
