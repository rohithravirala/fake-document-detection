"""Run the sample set through the real system and score the results.

    python evaluation/run.py                 # table on stdout
    python evaluation/run.py --json out.json # machine-readable, for CI
    python evaluation/run.py --strict        # non-zero exit on any miss

What is measured
----------------
**Verdict accuracy** — did the system reach the outcome the sample was built to
provoke?

**Check accuracy** — did the specific check the sample exercises produce the
expected result? A sample can reach the right verdict for the wrong reason, and
that is a defect worth seeing.

**False clears** — a document that should have been rejected or referred and was
cleared instead. Tracked separately and weighted above everything else, because
it is the only error in this system that lets a forgery through.

**Referral rate** — how often the system declines to decide. High is not a
failure; a system that refers everything is useless, and a system that never
refers is lying. The number is reported so the trade is visible.

Honesty note
------------
These are figures against a synthetic set built by the same people who built the
system. They demonstrate that each claimed check works. They are **not** an
accuracy claim against real forgeries, and should never be quoted as one.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from evaluation.samples import Sample, SampleSet, build  # noqa: E402


@dataclass
class Outcome:
    """What the system said about one sample, against what was expected."""

    name: str
    category: str
    doc_type: str
    expected_verdict: str
    actual_verdict: str
    verdict_ok: bool
    why: str
    reason: str
    duration_ms: float
    check_results: Dict[str, str] = field(default_factory=dict)
    check_misses: Dict[str, str] = field(default_factory=dict)
    checks_ok: bool = True

    @property
    def is_false_clear(self) -> bool:
        """Cleared something that should not have been. The error that matters."""
        return self.actual_verdict == "clear" and self.expected_verdict != "clear"

    @property
    def passed(self) -> bool:
        return self.verdict_ok and self.checks_ok


def evaluate(sample: Sample, profile: Dict[str, Any]) -> Outcome:
    """Screen one sample through the real modules and the real verdict engine."""
    from backend.app.services.screening import run_modules
    from backend.app.verdict import decide
    from modules.common.types import DocumentInput, DocumentType, ExtractedField

    try:
        doc_type = DocumentType(sample.doc_type)
    except ValueError:
        doc_type = DocumentType.UNKNOWN

    document_input = DocumentInput(
        doc_type=doc_type,
        fields=[
            ExtractedField(name=name, value=value, source="ocr", confidence=1.0)
            for name, value in sample.fields.items()
        ],
        profile=profile,
    )

    started = time.perf_counter()
    checks = run_modules(
        document_input, allowed=set(profile.get("modules") or []) or None
    )
    verdict = decide(checks)
    elapsed = (time.perf_counter() - started) * 1000.0

    seen = {check.check_id: check.result.value for check in checks}
    misses = {
        check_id: f"expected {expected}, got {seen.get(check_id, 'not run')}"
        for check_id, expected in sample.expected_checks.items()
        if seen.get(check_id) != expected
    }

    return Outcome(
        name=sample.name,
        category=sample.category,
        doc_type=sample.doc_type,
        expected_verdict=sample.expected_verdict,
        actual_verdict=verdict.verdict.value,
        verdict_ok=verdict.verdict.value == sample.expected_verdict,
        why=sample.why,
        reason=verdict.reason,
        duration_ms=round(elapsed, 2),
        check_results={
            check_id: seen.get(check_id, "not run") for check_id in sample.expected_checks
        },
        check_misses=misses,
        checks_ok=not misses,
    )


def run(sample_set: Optional[SampleSet] = None) -> Dict[str, Any]:
    """Run every sample and assemble the report."""
    from backend.app.services import profiles as profile_service
    from modules.aadhaar import testing as aadhaar_testing

    sample_set = sample_set or build()

    # Provision the synthetic signing certificate so the Aadhaar signature path
    # can actually be exercised. In a real deployment this is the UIDAI cert.
    certificate_dir = Path(tempfile.mkdtemp(prefix="svaram-eval-certs-"))
    certificate = aadhaar_testing.write_certificate(
        certificate_dir, sample_set.certificate_pem
    )
    os.environ["AADHAAR_CERT_PATH"] = str(certificate)

    outcomes: List[Outcome] = []
    for sample in sample_set.samples:
        profile = profile_service.DEFAULT_PROFILES.get(
            sample.doc_type, profile_service.DEFAULT_PROFILES["unknown"]
        )
        outcomes.append(evaluate(sample, profile))

    total = len(outcomes)
    verdict_hits = sum(1 for outcome in outcomes if outcome.verdict_ok)
    check_hits = sum(1 for outcome in outcomes if outcome.checks_ok)
    false_clears = [outcome for outcome in outcomes if outcome.is_false_clear]
    referrals = sum(1 for outcome in outcomes if outcome.actual_verdict == "refer")

    by_category: Dict[str, Dict[str, int]] = {}
    for outcome in outcomes:
        bucket = by_category.setdefault(outcome.category, {"total": 0, "correct": 0})
        bucket["total"] += 1
        bucket["correct"] += int(outcome.verdict_ok)

    return {
        "totals": {
            "samples": total,
            "verdict_correct": verdict_hits,
            "verdict_accuracy": round(verdict_hits / total, 4) if total else 0.0,
            "check_correct": check_hits,
            "check_accuracy": round(check_hits / total, 4) if total else 0.0,
            "false_clears": len(false_clears),
            "referral_rate": round(referrals / total, 4) if total else 0.0,
            "mean_duration_ms": round(sum(o.duration_ms for o in outcomes) / total, 2)
            if total
            else 0.0,
        },
        "by_category": by_category,
        "false_clears": [o.name for o in false_clears],
        "outcomes": [asdict(o) for o in outcomes],
    }


def print_report(report: Dict[str, Any]) -> None:
    totals = report["totals"]
    outcomes = report["outcomes"]

    print("\nSVARAM evaluation — synthetic sample set")
    print("=" * 78)

    for outcome in outcomes:
        mark = "ok  " if outcome["verdict_ok"] and outcome["checks_ok"] else "MISS"
        print(
            f"{mark} {outcome['name']:34} "
            f"{outcome['expected_verdict']:>6} -> {outcome['actual_verdict']:<6} "
            f"{outcome['duration_ms']:>7.1f} ms"
        )
        if not outcome["verdict_ok"]:
            print(f"       expected because: {outcome['why']}")
            print(f"       system said     : {outcome['reason'][:88]}")
        for check_id, detail in outcome["check_misses"].items():
            print(f"       check {check_id}: {detail}")

    print("-" * 78)
    print(
        f"verdict accuracy  {totals['verdict_correct']}/{totals['samples']} "
        f"({totals['verdict_accuracy']:.1%})"
    )
    print(
        f"check accuracy    {totals['check_correct']}/{totals['samples']} "
        f"({totals['check_accuracy']:.1%})"
    )
    print(f"referral rate     {totals['referral_rate']:.1%}")
    print(f"mean screening    {totals['mean_duration_ms']:.1f} ms")
    print(
        f"false clears      {totals['false_clears']}"
        + ("  <-- a forgery would have passed" if totals["false_clears"] else "  (none)")
    )

    print("\nby category")
    for category, counts in sorted(report["by_category"].items()):
        print(f"  {category:14} {counts['correct']}/{counts['total']}")

    print(
        "\nThese are results against a synthetic set built alongside the system.\n"
        "They show each claimed check works. They are not an accuracy claim\n"
        "against real forgeries, and must not be quoted as one."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="write the full report to this path")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="exit non-zero if any sample misses its expected verdict or checks",
    )
    args = parser.parse_args()

    report = run()
    print_report(report)

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2))
        print(f"\nwritten to {args.json}")

    totals = report["totals"]
    # A false clear fails the run regardless of the flag. It is the one error
    # this system exists to prevent.
    if totals["false_clears"]:
        return 1
    if args.strict and (
        totals["verdict_correct"] < totals["samples"]
        or totals["check_correct"] < totals["samples"]
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
