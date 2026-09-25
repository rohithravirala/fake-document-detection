"""Tampering signals: what they are and what they are explicitly not.

Every technique in this package returns a :class:`Signal` — a strength between
0 and 1 and a region — never a verdict. The verdict engine may combine signals
into a REFER; it may never combine them into a CLEAR.

This is not a limitation to apologise for, it is the design. Three reasons no
deep-learning forgery classifier appears anywhere in this package:

* **Explainability.** An officer must be able to see why. A network's activation
  is not a reason an officer can act on or defend afterwards.
* **No lawful training corpus.** There is no legitimate dataset of real forged
  Indian identity documents to train on.
* **Meaningless accuracy.** A model trained on fakes we generated ourselves,
  evaluated on fakes we generated ourselves, produces a number that says nothing
  about the forgeries it would actually meet.

So forensics here is classical, inspectable image analysis, applied only where
no source of truth exists to check against.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from modules.common.types import BBox


@dataclass
class Signal:
    """One tampering indication, with its strength and where it was found."""

    kind: str
    strength: float
    """0.0 to 1.0. Not a probability of forgery — a measure of how far this
    region departs from the rest of the image."""

    note: str
    region: Optional[BBox] = None
    detail: Dict[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.strength = max(0.0, min(1.0, float(self.strength)))

    def to_dict(self) -> Dict[str, object]:
        out: Dict[str, object] = {
            "type": self.kind,
            "strength": round(self.strength, 3),
            "note": self.note,
        }
        if self.region is not None:
            out["region"] = self.region.to_dict()
        if self.detail:
            out["detail"] = self.detail
        return out


#: Strength at or above which a signal is reported as a failure rather than as
#: context. Tuned conservatively: a false REFER costs an officer thirty seconds,
#: a false REJECT costs a traveller their journey.
REPORT_THRESHOLD = 0.55


@dataclass
class TamperRiskSummary:
    """Summary of tampering signals across all forensic detectors."""

    risk_level: str  # "clean", "low_risk", "suspicious", "high_risk"
    max_strength: float
    reportable_count: int
    total_signals: int
    signals: List[Signal]
    recommendation: str

    def to_dict(self) -> Dict[str, object]:
        return {
            "risk_level": self.risk_level,
            "max_strength": round(self.max_strength, 3),
            "reportable_count": self.reportable_count,
            "total_signals": self.total_signals,
            "recommendation": self.recommendation,
            "signals": [s.to_dict() for s in self.signals],
        }


def aggregate_tampering_risk(signals: List[Signal]) -> TamperRiskSummary:
    """Aggregate individual forensic signals into an officer-facing tampering summary."""
    if not signals:
        return TamperRiskSummary(
            risk_level="clean",
            max_strength=0.0,
            reportable_count=0,
            total_signals=0,
            signals=[],
            recommendation="No anomalous forensic signals detected. Proceed with standard verification.",
        )

    max_str = max(s.strength for s in signals)
    reportable = [s for s in signals if s.strength >= REPORT_THRESHOLD]

    if any(s.strength >= 0.80 for s in signals) or len(reportable) >= 2:
        level = "high_risk"
        rec = (
            "Multiple or high-confidence tampering anomalies detected. "
            "Mandatory physical inspection required."
        )
    elif reportable:
        level = "suspicious"
        rec = (
            "Forensic signals suggest potential manipulation. "
            "Refer to questioned-document examiner."
        )
    else:
        level = "low_risk"
        rec = (
            "Minor signal variance within normal parameters. "
            "Document appears unaltered by classical techniques."
        )

    return TamperRiskSummary(
        risk_level=level,
        max_strength=max_str,
        reportable_count=len(reportable),
        total_signals=len(signals),
        signals=signals,
        recommendation=rec,
    )
