"""MRZ parsing and ICAO 9303 check digits.

The specimen values below are published in ICAO Doc 9303 and in the ICAO
specimen documents. Testing against published vectors rather than against values
this project generated is the whole point: it is verifiable by anyone, and it is
what makes "the check digit implementation is covered by tests against published
ICAO specimen values" a statement rather than a claim.
"""

from __future__ import annotations

import pytest

from modules.common.types import CheckResult, DocumentInput, DocumentType, ExtractedField
from modules.passport import PassportVerifier, parse_mrz
from modules.passport.checkdigit import char_value, check_digit, verify_check_digit
from modules.passport.mrz import MrzFormatError, parse_names

# ICAO Doc 9303 Part 3, specimen "Utopia" passport.
TD3 = (
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
    "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
)

# ICAO Doc 9303 Part 5, specimen TD1 identity card.
TD1 = (
    "I<UTOD231458907<<<<<<<<<<<<<<<\n"
    "7408122F1204159UTO<<<<<<<<<<<6\n"
    "ERIKSSON<<ANNA<MARIA<<<<<<<<<<"
)


# -- the algorithm itself -------------------------------------------------


@pytest.mark.parametrize(
    ("char", "value"),
    [("0", 0), ("9", 9), ("A", 10), ("M", 22), ("Z", 35), ("<", 0)],
)
def test_character_values(char, value):
    assert char_value(char) == value


def test_invalid_character_raises():
    """A stray character means the line was misread, not that it scores zero."""
    with pytest.raises(ValueError):
        char_value("*")


@pytest.mark.parametrize(
    ("field", "expected"),
    [
        ("L898902C3", 6),  # document number
        ("740812", 2),  # date of birth
        ("120415", 9),  # date of expiry
        ("ZE184226B<<<<<", 1),  # optional data
        ("D23145890", 7),  # TD1 document number
        ("<<<<<<<<<<<<<<", 0),  # all filler
    ],
)
def test_published_check_digits(field, expected):
    assert check_digit(field) == expected


def test_composite_check_digit():
    """The composite covers the whole of line 2 and is the hardest to forge."""
    composite = "L898902C36" + "7408122" + "1204159" + "ZE184226B<<<<<1"
    assert check_digit(composite) == 0


def test_filler_check_digit_on_empty_field_is_no_opinion():
    """'<' on an empty optional field is permitted, and is not a failure."""
    assert verify_check_digit("<<<<<<", "<") is None
    assert verify_check_digit("AB1234", "<") is False


# -- TD3 ------------------------------------------------------------------


def test_td3_parses_every_field():
    parsed = parse_mrz(TD3)
    assert parsed.mrz_format == "TD3"
    assert parsed.document_number == "L898902C3"
    assert parsed.surname == "ERIKSSON"
    assert parsed.given_names == "ANNA MARIA"
    assert parsed.nationality == "UTO"
    assert parsed.date_of_birth == "740812"
    assert parsed.sex == "F"
    assert parsed.date_of_expiry == "120415"


def test_td3_all_check_digits_verify():
    parsed = parse_mrz(TD3)
    assert parsed.all_valid
    assert len(parsed.evaluated_checks) == 5
    assert parsed.failed_checks == []


def test_td1_parses_and_verifies():
    parsed = parse_mrz(TD1)
    assert parsed.mrz_format == "TD1"
    assert parsed.document_number == "D23145890"
    assert parsed.surname == "ERIKSSON"
    assert parsed.given_names == "ANNA MARIA"
    assert parsed.all_valid


# -- tampering ------------------------------------------------------------


def test_edited_date_of_birth_breaks_its_check_digit():
    """Change the year of birth without recomputing the digit."""
    # 740812 -> 750812, leaving the printed digit 2 untouched. The correct
    # digit for 750812 is 5, so the field's own check digit catches this.
    tampered = TD3.replace("7408122F", "7508122F")
    parsed = parse_mrz(tampered)
    failed = {c.field_name for c in parsed.failed_checks}
    assert "date_of_birth" in failed
    assert "composite" in failed
    assert not parsed.all_valid


def test_a_forger_who_recomputes_every_digit_is_not_caught_by_arithmetic():
    """The limit of check digits, asserted rather than glossed over.

    Editing the date of birth to 750812 and writing its correct digit 5 produces
    an MRZ where every digit verifies, including the composite. Check digits are
    modulo 10 and are recomputable by anyone, so they catch careless edits and
    OCR misreads — not a forger who does the arithmetic.

    This is why `PassportVerifier` also compares the MRZ against the printed data
    page, and why a passport can be *rejected* with certainty here but only
    provisionally cleared. See the note in `modules/passport/checkdigit.py`.
    """
    tampered = TD3.replace("7408122F", "7508125F")
    parsed = parse_mrz(tampered)

    assert parsed.all_valid, "a fully recomputed MRZ verifies — this is the point"
    assert parsed.date_of_birth == "750812"

    # The forged value differs from the genuine document, and only a comparison
    # against the printed page or a signed chip can reveal that.
    genuine = parse_mrz(TD3)
    assert genuine.date_of_birth != parsed.date_of_birth


def test_composite_catches_an_edit_that_collides_with_its_field_digit():
    """A single check digit is mod 10, so one edit in ten leaves it unchanged.

    740812 and 850812 both have check digit 2, so an edit between them is
    invisible to the field's own digit. This is precisely why ICAO also defines a
    composite digit over the whole of line 2, and why a system that verified only
    the per-field digits would miss a tenth of single-field forgeries.
    """
    assert check_digit("740812") == check_digit("850812") == 2

    tampered = TD3.replace("7408122F", "8508122F")
    parsed = parse_mrz(tampered)

    field_digits = {
        c.field_name for c in parsed.failed_checks if c.field_name != "composite"
    }
    assert field_digits == set(), "the field digit should collide and pass"
    assert "composite" in {c.field_name for c in parsed.failed_checks}
    assert not parsed.all_valid


def test_edited_expiry_breaks_its_check_digit():
    tampered = TD3.replace("1204159", "1204158")
    parsed = parse_mrz(tampered)
    assert not parsed.all_valid


# -- robustness -----------------------------------------------------------


def test_filler_is_never_stripped():
    """'<' carries field boundaries; stripping it destroys information."""
    parsed = parse_mrz(TD3)
    assert "<" in parsed.lines[0]
    assert parsed.surname != parsed.given_names


def test_name_separator():
    assert parse_names("ERIKSSON<<ANNA<MARIA<<<") == ("ERIKSSON", "ANNA MARIA")
    assert parse_names("SHARMA<<ANITA<<<<<") == ("SHARMA", "ANITA")


@pytest.mark.parametrize(
    "text",
    ["", "not an mrz at all", "P<UTOERIKSSON", "A" * 44],
)
def test_unparseable_input_raises_rather_than_guessing(text):
    with pytest.raises(MrzFormatError):
        parse_mrz(text)


# -- through the verifier -------------------------------------------------


def _run(fields):
    return PassportVerifier().run(
        DocumentInput(
            doc_type=DocumentType.PASSPORT,
            fields=[ExtractedField(k, v, "ocr") for k, v in fields.items()],
        )
    )


def test_printed_page_disagreeing_with_mrz_is_a_critical_failure():
    result = _run({"mrz": TD3, "passport_number": "L898902C9"})
    mismatch = [
        c
        for c in result.checks
        if c.check_id == "passport.mrz_vs_printed.passport_number"
    ]
    assert mismatch and mismatch[0].result is CheckResult.FAIL
    assert "L898902C3" in mismatch[0].citation


def test_missing_mrz_is_inconclusive_not_failed():
    result = _run({"passport_number": "L898902C3"})
    assert result.checks[0].result is CheckResult.INCONCLUSIVE


def test_unparseable_mrz_is_inconclusive_not_failed():
    """A bad capture must never be reported as a forged document."""
    result = _run({"mrz": "GARBAGE TEXT THAT IS NOT AN MRZ AT ALL"})
    assert all(c.result is not CheckResult.FAIL for c in result.checks)
