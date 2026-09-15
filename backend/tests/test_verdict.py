"""The verdict engine's four invariants.

These are the rules the whole design rests on. If any of them regresses, the
system is still fast and still explainable and is no longer trustworthy, so they
are asserted directly rather than inferred from end-to-end behaviour.
"""

from __future__ import annotations

import pytest

from backend.app.verdict import combine, decide
from modules.common.types import (
    CheckType,
    Severity,
    Verdict,
    failed,
    inconclusive,
    passed,
    retake,
    unavailable,
)

CRYPTO_PASS = passed(
    "a.sig", CheckType.CRYPTOGRAPHIC, "The QR carries a valid UIDAI signature."
)
STRUCT_PASS = passed(
    "p.format", CheckType.STRUCTURAL, "The PAN matches the mandatory format."
)
CROSS_PASS = passed(
    "a.name", CheckType.CROSS_FIELD, "The printed name matches the signed QR."
)
QUALITY_PASS = passed("q.gate", CheckType.QUALITY, "Capture quality is sufficient.")


# -- invariant 1: appearance can never clear ------------------------------


def test_no_authoritative_pass_can_never_clear():
    """A quality pass and a silent forensics run are not evidence of authenticity."""
    result = decide(
        [
            QUALITY_PASS,
            inconclusive(
                "f.summary", CheckType.FORENSIC, "No tampering signal was found."
            ),
        ]
    )
    assert result.verdict is Verdict.REFER


def test_biometric_pass_alone_cannot_clear():
    """A face match proves who is holding the card, not that the card is real."""
    result = decide(
        [QUALITY_PASS, passed("f.live", CheckType.BIOMETRIC, "The faces match.")]
    )
    assert result.verdict is Verdict.REFER


@pytest.mark.parametrize(
    "authoritative",
    [CRYPTO_PASS, STRUCT_PASS, CROSS_PASS],
)
def test_any_authoritative_pass_can_clear(authoritative):
    result = decide([QUALITY_PASS, authoritative])
    assert result.verdict is Verdict.CLEAR
    assert result.reason


# -- invariant 2: forensics can never reject ------------------------------


@pytest.mark.parametrize("severity", [Severity.HIGH, Severity.CRITICAL])
def test_forensic_failure_never_rejects(severity):
    """However strong the signal, a texture statistic does not stop a traveller."""
    result = decide(
        [
            CRYPTO_PASS,
            failed("f.noise", CheckType.FORENSIC, "Noise differs strongly.", severity),
        ]
    )
    assert result.verdict is Verdict.REFER


def test_forensic_failure_alone_refers():
    result = decide(
        [failed("f.ela", CheckType.FORENSIC, "Compression differs.", Severity.HIGH)]
    )
    assert result.verdict is Verdict.REFER


def test_forensics_cannot_be_constructed_as_a_pass():
    """Enforced in the type, not only in the engine."""
    with pytest.raises(ValueError):
        passed("f.clean", CheckType.FORENSIC, "No tampering detected.")


# -- invariant 3: unavailable is not failed -------------------------------


def test_unavailable_check_refers_and_never_rejects():
    result = decide([unavailable("a.sig", CheckType.CRYPTOGRAPHIC, "No certificate.")])
    assert result.verdict is Verdict.REFER


def test_unavailable_alongside_a_pass_still_refers():
    """An incomplete screening is not a clean one."""
    result = decide(
        [CRYPTO_PASS, unavailable("f.face", CheckType.BIOMETRIC, "No face model.")]
    )
    assert result.verdict is Verdict.REFER


# -- invariant 4: unreadable capture asks for a retake --------------------


def test_retake_takes_precedence_over_everything():
    result = decide(
        [
            retake("q.gate", "Image is out of focus. Retake the photograph."),
            CRYPTO_PASS,
            failed("a.name", CheckType.CROSS_FIELD, "Name mismatch.", Severity.CRITICAL),
        ]
    )
    assert result.verdict is Verdict.REFER
    assert result.needs_retake is True
    assert "Retake" in result.reason


# -- rejection ------------------------------------------------------------


@pytest.mark.parametrize("severity", [Severity.CRITICAL, Severity.HIGH])
def test_decisive_failure_rejects(severity):
    reason = "The printed name contradicts the signed QR."
    result = decide(
        [CRYPTO_PASS, failed("a.name", CheckType.CROSS_FIELD, reason, severity)]
    )
    assert result.verdict is Verdict.REJECT
    assert result.reason == reason


def test_medium_failure_refers_rather_than_rejects():
    result = decide(
        [
            CRYPTO_PASS,
            failed("a.state", CheckType.CROSS_FIELD, "State differs.", Severity.MEDIUM),
        ]
    )
    assert result.verdict is Verdict.REFER


def test_most_severe_failure_supplies_the_reason():
    high = failed("x", CheckType.CROSS_FIELD, "High severity problem.", Severity.HIGH)
    critical = failed("y", CheckType.STRUCTURAL, "Critical problem.", Severity.CRITICAL)
    result = decide([high, critical])
    assert result.reason == "Critical problem."


# -- general --------------------------------------------------------------


def test_no_checks_refers():
    result = decide([])
    assert result.verdict is Verdict.REFER


def test_every_verdict_carries_a_reason():
    for checks in ([], [CRYPTO_PASS], [CRYPTO_PASS, CROSS_PASS]):
        assert decide(checks).reason.strip()


def test_no_percentage_ever_appears_in_a_reason():
    """The interface shows a verdict and a sentence, never a confidence score."""
    results = [
        decide([CRYPTO_PASS]),
        decide([failed("f.n", CheckType.FORENSIC, "Noise differs.", Severity.HIGH)]),
        decide([unavailable("a.sig", CheckType.CRYPTOGRAPHIC, "No certificate.")]),
    ]
    for result in results:
        assert "%" not in result.reason


# -- combining documents --------------------------------------------------


def test_worst_document_decides_the_case():
    clear = decide([CRYPTO_PASS])
    reject = decide(
        [failed("a.n", CheckType.CROSS_FIELD, "Mismatch.", Severity.CRITICAL)]
    )
    assert combine([clear, reject]).verdict is Verdict.REJECT


def test_a_referred_document_prevents_a_clear_case():
    clear = decide([CRYPTO_PASS])
    refer = decide([unavailable("a.sig", CheckType.CRYPTOGRAPHIC, "No certificate.")])
    assert combine([clear, refer]).verdict is Verdict.REFER


def test_all_clear_documents_give_a_clear_case():
    clear = decide([CRYPTO_PASS])
    assert combine([clear, decide([STRUCT_PASS])]).verdict is Verdict.CLEAR


def test_empty_case_refers():
    assert combine([]).verdict is Verdict.REFER


# -- regression -----------------------------------------------------------


def test_forensic_non_finding_does_not_block_a_clear():
    """Regression: CLEAR was unreachable in practice.

    A FORENSIC check can never return PASS, so "no tampering signal was found"
    arrives as INCONCLUSIVE on every document that ran forensics — which, per the
    seeded profiles, is every document. While that counted as an open question,
    no screening could ever be cleared no matter how strong its cryptographic
    evidence was.

    A forensic *failure* must still prevent a clear. A forensic *non-finding*
    must not.
    """
    quiet_forensics = inconclusive(
        "forensics.summary",
        CheckType.FORENSIC,
        "Tampering analysis found no significant signal. This is not evidence "
        "that the document is genuine.",
        severity=Severity.LOW,
    )
    assert decide([CRYPTO_PASS, CROSS_PASS, quiet_forensics]).verdict is Verdict.CLEAR

    loud_forensics = failed(
        "forensics.copy_move", CheckType.FORENSIC, "A block was copied.", Severity.MEDIUM
    )
    assert decide([CRYPTO_PASS, CROSS_PASS, loud_forensics]).verdict is Verdict.REFER


def test_an_optional_module_being_absent_does_not_block_a_clear():
    """`required = False` modules report their absence at LOW severity."""
    optional_missing = unavailable(
        "face.available",
        CheckType.POLICY,
        "Face comparison is not installed in this deployment.",
        severity=Severity.LOW,
    )
    assert decide([CRYPTO_PASS, optional_missing]).verdict is Verdict.CLEAR


def test_a_required_module_being_absent_still_blocks_a_clear():
    """Losing a source of truth is not the same as losing a bonus signal."""
    required_missing = unavailable(
        "aadhaar.qr_signature",
        CheckType.CRYPTOGRAPHIC,
        "No UIDAI certificate is provisioned.",
        severity=Severity.MEDIUM,
    )
    assert decide([STRUCT_PASS, required_missing]).verdict is Verdict.REFER
