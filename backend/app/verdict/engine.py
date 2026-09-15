"""Turning a list of checks into one verdict and one sentence.

There are exactly three outcomes, and no percentage anywhere.

``REJECT``
    Something decisive says this document was altered or is not valid. The
    officer can point at the failing check and read its citation aloud.

``CLEAR``
    At least one authoritative check passed and nothing contradicts it. An
    authoritative check is one resting on a signature from the issuing authority,
    on the document's own arithmetic, or on two parts of the document agreeing.

``REFER``
    Everything else. Not a hedge — a statement that the machine's evidence does
    not reach a conclusion, and a human examiner is required.

Four invariants are enforced here, and they are the substance of the design:

1.  **Appearance can never clear a document.** CLEAR requires an authoritative
    PASS. Absence of detected tampering is not evidence of authenticity, so a
    document with no verifiable source of truth can only ever be REFER.

2.  **Forensics can never reject a document.** A forensic FAIL raises REFER at
    most, whatever severity the module assigned it. The module caps itself too;
    this is the second lock on the same door, because the consequence of getting
    it wrong is a traveller stopped on the strength of a texture statistic.

3.  **"Could not run" is not "failed".** An UNAVAILABLE check pushes a case to
    REFER, never toward REJECT. A missing model must never look like a forgery.

4.  **An unreadable capture is answered with RETAKE, not a verdict.** Judging a
    blurred photograph is worse than asking for another one.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from modules.common.types import (
    AUTHORITATIVE,
    Check,
    CheckResult,
    CheckType,
    Severity,
    Verdict,
    severity_rank,
)

#: Severities at which a non-forensic failure is decisive.
REJECT_SEVERITIES = frozenset({Severity.CRITICAL, Severity.HIGH})


@dataclass
class VerdictResult:
    """The verdict, the sentence beside it, and the checks that produced it."""

    verdict: Verdict
    reason: str
    """One sentence, written for an officer. This is the whole explanation."""

    decisive_checks: List[Check] = field(default_factory=list)
    """The checks that actually determined the outcome, most severe first."""

    counts: Dict[str, int] = field(default_factory=dict)
    needs_retake: bool = False

    def to_dict(self) -> Dict[str, object]:
        return {
            "verdict": self.verdict.value,
            "reason": self.reason,
            "needs_retake": self.needs_retake,
            "counts": dict(self.counts),
            "decisive_checks": [c.to_dict() for c in self.decisive_checks],
        }


def _tally(checks: Sequence[Check]) -> Dict[str, int]:
    counts = {result.value: 0 for result in CheckResult}
    for check in checks:
        counts[check.result.value] += 1
    return counts


def _by_severity(checks: Sequence[Check]) -> List[Check]:
    return sorted(checks, key=lambda c: severity_rank(c.severity), reverse=True)


def decide(checks: Sequence[Check]) -> VerdictResult:
    """Apply the rules, in the order they are allowed to fire."""
    checks = list(checks)
    counts = _tally(checks)

    if not checks:
        return VerdictResult(
            verdict=Verdict.REFER,
            reason=(
                "No checks were performed on this document, so it has been "
                "neither cleared nor rejected."
            ),
            counts=counts,
        )

    # -- 1. an unreadable capture is answered before anything else ---------
    retakes = [c for c in checks if c.result is CheckResult.RETAKE]
    if retakes:
        return VerdictResult(
            verdict=Verdict.REFER,
            reason=retakes[0].citation,
            decisive_checks=retakes,
            counts=counts,
            needs_retake=True,
        )

    failures = [c for c in checks if c.result is CheckResult.FAIL]

    # -- 2. decisive failures, excluding forensics -------------------------
    # Invariant 2: a forensic signal may never drive a rejection, regardless of
    # the severity the module gave it.
    decisive = _by_severity(
        [
            c
            for c in failures
            if c.check_type is not CheckType.FORENSIC and c.severity in REJECT_SEVERITIES
        ]
    )
    if decisive:
        return VerdictResult(
            verdict=Verdict.REJECT,
            reason=decisive[0].citation,
            decisive_checks=decisive,
            counts=counts,
        )

    # -- 3. nothing authoritative passed -> cannot clear --------------------
    authoritative_passes = [
        c
        for c in checks
        if c.result is CheckResult.PASS and c.check_type in AUTHORITATIVE
    ]
    unavailable = [c for c in checks if c.result is CheckResult.UNAVAILABLE]
    inconclusive = [c for c in checks if c.result is CheckResult.INCONCLUSIVE]

    if not authoritative_passes:
        if unavailable:
            reason = (
                f"{unavailable[0].citation} No source of truth was available for "
                "this document, so it cannot be cleared automatically."
            )
            decisive_checks = _by_severity(unavailable)
        else:
            reason = (
                "This document carries nothing that can be verified against its "
                "issuing authority — no signature, no check digits and no "
                "internal cross-reference. Appearance alone cannot establish that "
                "it is genuine, so it needs a human examiner."
            )
            decisive_checks = _by_severity(inconclusive + failures)[:3]
        return VerdictResult(
            verdict=Verdict.REFER,
            reason=reason,
            decisive_checks=decisive_checks,
            counts=counts,
        )

    # -- 4. something authoritative passed, but open questions remain -------
    #
    # Two filters here, and both are load-bearing.
    #
    # A FORENSIC check can never return PASS — that is enforced in the type — so
    # "no tampering signal was found" arrives as INCONCLUSIVE on every single
    # document. Treating that as an open question would make CLEAR unreachable
    # for anything that ran forensics at all, which is everything. A forensic
    # FAIL is still an open question; a forensic non-finding is not.
    #
    # Severity then separates a real gap from a cosmetic one. A module marked
    # `required = False` reports its absence at LOW, because losing a bonus
    # signal is not the same as losing a source of truth.
    forensic_failures = [c for c in failures if c.check_type is CheckType.FORENSIC]
    minor_failures = [c for c in failures if c.check_type is not CheckType.FORENSIC]
    blocking_unavailable = [
        c
        for c in unavailable
        if severity_rank(c.severity) >= severity_rank(Severity.MEDIUM)
    ]
    blocking_inconclusive = [
        c
        for c in inconclusive
        if c.check_type is not CheckType.FORENSIC
        and severity_rank(c.severity) >= severity_rank(Severity.MEDIUM)
    ]
    open_items = _by_severity(
        minor_failures + forensic_failures + blocking_unavailable + blocking_inconclusive
    )

    if open_items:
        top = open_items[0]
        if top.result is CheckResult.FAIL and top.check_type is CheckType.FORENSIC:
            reason = (
                f"{top.citation} The document's own verification checks passed, so "
                "this is a question for an examiner rather than a rejection."
            )
        elif top.result is CheckResult.UNAVAILABLE:
            reason = (
                f"{top.citation} Other checks passed, but this one could not be "
                "completed, so the screening is not conclusive."
            )
        else:
            reason = top.citation
        return VerdictResult(
            verdict=Verdict.REFER,
            reason=reason,
            decisive_checks=open_items[:5],
            counts=counts,
        )

    # -- 5. clear ----------------------------------------------------------
    strongest = sorted(
        authoritative_passes,
        key=lambda c: (
            c.check_type is CheckType.CRYPTOGRAPHIC,
            c.check_type is CheckType.STRUCTURAL,
        ),
        reverse=True,
    )[0]
    # Count only what actually passed. Saying "all N checks passed" when some
    # were inconclusive would be the one inaccurate sentence in a system whose
    # entire value rests on its sentences being exact.
    passes = counts.get(CheckResult.PASS.value, 0)
    return VerdictResult(
        verdict=Verdict.CLEAR,
        reason=(
            f"{strongest.citation} "
            f"{passes} of {len(checks)} checks passed and none contradicted them."
        ),
        decisive_checks=authoritative_passes,
        counts=counts,
    )


def combine(results: Sequence[VerdictResult]) -> VerdictResult:
    """Combine per-document verdicts into one composite for the case.

    The worst outcome wins, because a case with one forged document is not
    half-cleared. Order of precedence: REJECT, then REFER, then CLEAR.
    """
    results = list(results)
    if not results:
        return VerdictResult(
            verdict=Verdict.REFER,
            reason="No documents were submitted with this case.",
        )
    if len(results) == 1:
        return results[0]

    for verdict in (Verdict.REJECT, Verdict.REFER):
        matching = [r for r in results if r.verdict is verdict]
        if matching:
            worst = matching[0]
            noun = "document" if len(matching) == 1 else "documents"
            prefix = (
                f"{len(matching)} of {len(results)} {noun} in this case "
                f"{'was' if len(matching) == 1 else 'were'} "
                f"{'rejected' if verdict is Verdict.REJECT else 'referred'}. "
            )
            return VerdictResult(
                verdict=verdict,
                reason=prefix + worst.reason,
                decisive_checks=[c for r in matching for c in r.decisive_checks][:5],
                counts={
                    key: sum(r.counts.get(key, 0) for r in results)
                    for key in results[0].counts
                },
                needs_retake=any(r.needs_retake for r in results),
            )

    return VerdictResult(
        verdict=Verdict.CLEAR,
        reason=(
            f"All {len(results)} documents in this case passed every check "
            "performed on them."
        ),
        decisive_checks=[c for r in results for c in r.decisive_checks][:5],
        counts={
            key: sum(r.counts.get(key, 0) for r in results) for key in results[0].counts
        },
    )
