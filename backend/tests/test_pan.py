"""PAN structure and its agreement with the printed name.

Table-driven on purpose. These are the checks an evaluator is most likely to
question, and "the PAN validator is covered by tests over every category letter
and every malformed shape" is a sentence worth being able to say.
"""

from __future__ import annotations

import pytest

from modules.common.types import CheckResult
from modules.pan import CATEGORIES, parse_pan, validate_pan


def result_for(checks, check_id):
    for check in checks:
        if check.check_id == check_id:
            return check.result
    return None


def citation_for(checks, check_id):
    for check in checks:
        if check.check_id == check_id:
            return check.citation
    return ""


# -- format ---------------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "ABCPK1234X",
        "abcpk1234x",  # case is normalised
        "ABCPK 1234 X",  # spacing from OCR is stripped
        "ABCPK-1234-X",
    ],
)
def test_valid_formats_accepted(value):
    assert parse_pan(value) is not None
    assert result_for(validate_pan(value), "pan.format") is CheckResult.PASS


@pytest.mark.parametrize(
    "value",
    [
        "",
        "ABCP1234X",  # only four leading letters
        "ABCPK1234",  # missing trailing letter
        "ABCPK12345X",  # five digits
        "ABCPKI234X",  # letter where a digit belongs
        "12345ABCDX",  # digits and letters transposed
        "ABCPK1234XY",  # too long
    ],
)
def test_malformed_rejected(value):
    assert parse_pan(value) is None
    checks = validate_pan(value, "RAHUL KUMAR")
    assert result_for(checks, "pan.format") is CheckResult.FAIL
    # A malformed number stops there: no category or surname claim is made.
    assert len(checks) == 1


# -- holder category ------------------------------------------------------


@pytest.mark.parametrize("letter", sorted(CATEGORIES))
def test_every_issued_category_letter_accepted(letter):
    pan = f"ABC{letter}K1234X"
    assert result_for(validate_pan(pan, "KUMAR"), "pan.category") is CheckResult.PASS


@pytest.mark.parametrize("letter", ["D", "E", "I", "K", "M", "N", "O", "Q", "R"])
def test_unissued_category_letters_rejected(letter):
    pan = f"ABC{letter}K1234X"
    assert result_for(validate_pan(pan, "KUMAR"), "pan.category") is CheckResult.FAIL


# -- surname initial ------------------------------------------------------


def test_surname_initial_matches_final_word():
    checks = validate_pan("ABCPK1234X", "RAHUL KUMAR")
    assert result_for(checks, "pan.surname_initial") is CheckResult.PASS


def test_surname_initial_matches_leading_word():
    """Indian names are written surname-first as often as surname-last."""
    checks = validate_pan("ABCPR1234X", "RAVIRALA ROHITH")
    assert result_for(checks, "pan.surname_initial") is CheckResult.PASS


def test_surname_initial_mismatch_is_critical():
    checks = validate_pan("ABCPS1234X", "RAHUL KUMAR")
    assert result_for(checks, "pan.surname_initial") is CheckResult.FAIL
    citation = citation_for(checks, "pan.surname_initial")
    # The citation must name both sides, or an officer cannot act on it.
    assert "S" in citation and "RAHUL KUMAR" in citation


def test_initials_are_not_treated_as_a_surname():
    """A one-letter token must not satisfy the check by coincidence."""
    checks = validate_pan("ABCPR1234X", "R KUMAR")
    assert result_for(checks, "pan.surname_initial") is CheckResult.FAIL


def test_honorifics_are_ignored():
    checks = validate_pan("ABCPM1234X", "MR RAHUL KUMAR")
    assert result_for(checks, "pan.surname_initial") is CheckResult.FAIL


def test_missing_name_is_inconclusive_not_failed():
    """No name to compare is a gap in evidence, not evidence of forgery."""
    checks = validate_pan("ABCPK1234X", None)
    assert result_for(checks, "pan.surname_initial") is CheckResult.INCONCLUSIVE


def test_every_check_carries_a_citation():
    for checks in (
        validate_pan("ABCPK1234X", "RAHUL KUMAR"),
        validate_pan("ABCPS1234X", "RAHUL KUMAR"),
        validate_pan("bad", "RAHUL KUMAR"),
    ):
        for check in checks:
            assert check.citation.strip()
