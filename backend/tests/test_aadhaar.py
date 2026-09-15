"""Aadhaar Secure QR parsing and UIDAI signature verification.

No real Aadhaar QR is in this repository and the UIDAI signing key is obviously
not available, so the cryptographic path is exercised the only honest way: a
throwaway RSA key signs a payload assembled in the real byte layout, and it is
verified through the same code that runs in production.

That proves the parser, the byte offsets, the decompression and the verification
call. It is **not** a claim that a real Aadhaar card has been verified — swapping
in the real UIDAI certificate changes the key and nothing else.
"""

from __future__ import annotations

import pytest

from modules.aadhaar import AadhaarVerifier, parse_qr, testing
from modules.aadhaar import signature as signature_module
from modules.common.types import CheckResult, DocumentInput, DocumentType, ExtractedField

LEGACY_XML = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<PrintLetterBarcodeData uid="234567890124" name="ANITA SHARMA" gender="F" '
    'yob="1990" co="S/O RAMESH SHARMA" vtc="HYDERABAD" dist="HYDERABAD" '
    'state="TELANGANA" pc="500032"/>'
)


@pytest.fixture()
def signed_qr(tmp_path, monkeypatch):
    """A synthetic signed QR, with its certificate provisioned."""
    generated = testing.generate()
    certificate = testing.write_certificate(tmp_path, generated.certificate_pem)
    monkeypatch.setenv("AADHAAR_CERT_PATH", str(certificate))
    return generated


def run(fields, **hints):
    return AadhaarVerifier().run(
        DocumentInput(
            doc_type=DocumentType.AADHAAR,
            fields=[ExtractedField(k, v, "ocr") for k, v in fields.items()],
            hints=hints,
        )
    )


def check(result, check_id):
    for item in result.checks:
        if item.check_id == check_id:
            return item
    return None


# -- parsing --------------------------------------------------------------


def test_secure_qr_parses_from_big_integer_text(signed_qr):
    """Real QR codes carry the payload as one very long decimal integer."""
    payload = parse_qr(signed_qr.payload_text)
    assert payload.variant == "secure"
    assert payload.is_signed
    assert payload.fields["name"] == "ANITA SHARMA"
    assert payload.fields["state"] == "TELANGANA"
    assert payload.aadhaar_last4 == "9012"
    assert payload.photo


def test_legacy_xml_is_parsed_but_never_signed():
    payload = parse_qr(LEGACY_XML)
    assert payload.variant == "legacy_xml"
    assert not payload.is_signed
    assert payload.fields["name"] == "ANITA SHARMA"


def test_truncated_payload_raises_rather_than_guessing():
    from modules.aadhaar.secure_qr import AadhaarQrError

    with pytest.raises(AadhaarQrError):
        parse_qr("12345")


# -- signature ------------------------------------------------------------


def test_valid_signature_verifies(signed_qr):
    payload = parse_qr(signed_qr.payload_text)
    outcome = signature_module.verify_signature(payload.signed_data, payload.signature)
    assert outcome.is_valid
    assert "SHA256" in outcome.detail


def test_one_byte_edited_after_signing_fails_verification(tmp_path, monkeypatch):
    """The central claim of the project, asserted directly."""
    corrupted = testing.generate(corrupt=True)
    certificate = testing.write_certificate(tmp_path, corrupted.certificate_pem)
    monkeypatch.setenv("AADHAAR_CERT_PATH", str(certificate))

    payload = parse_qr(corrupted.payload_text)
    assert payload.fields["name"].startswith("X")  # the edit landed

    outcome = signature_module.verify_signature(payload.signed_data, payload.signature)
    assert outcome.status == "invalid"


def test_missing_certificate_is_unavailable_not_invalid(signed_qr, monkeypatch):
    """A missing certificate must never look like a forged card."""
    monkeypatch.setenv("AADHAAR_CERT_PATH", "/nonexistent/uidai.cer")
    monkeypatch.setattr(
        signature_module, "CERT_DIR", __import__("pathlib").Path("/nonexistent")
    )

    payload = parse_qr(signed_qr.payload_text)
    outcome = signature_module.verify_signature(payload.signed_data, payload.signature)
    assert outcome.could_not_run
    assert outcome.status != "invalid"


# -- through the verifier -------------------------------------------------


def test_genuine_card_passes_every_cross_field_check(signed_qr):
    result = run(
        {
            "aadhaar_qr": signed_qr.payload_text,
            "name": "ANITA SHARMA",
            "date_of_birth": "12/05/1990",
            "gender": "Female",
            "pincode": "500032",
            "state": "Telangana",
        }
    )
    assert check(result, "aadhaar.qr_signature").result is CheckResult.PASS
    assert all(
        c.result is CheckResult.PASS
        for c in result.checks
        if c.check_id.startswith("aadhaar.qr_vs_printed")
    )


def test_edited_printed_name_contradicts_the_signed_qr(signed_qr):
    """The forgery this system exists to catch."""
    result = run(
        {
            "aadhaar_qr": signed_qr.payload_text,
            "name": "PRIYA VERMA",
            "date_of_birth": "12/05/1990",
        }
    )
    assert check(result, "aadhaar.qr_signature").result is CheckResult.PASS
    mismatch = check(result, "aadhaar.qr_vs_printed.name")
    assert mismatch.result is CheckResult.FAIL
    assert "ANITA SHARMA" in mismatch.citation and "PRIYA VERMA" in mismatch.citation


def test_qr_belonging_to_a_different_number_is_caught(signed_qr):
    """A genuine QR photographed onto someone else's card."""
    result = run(
        {
            "aadhaar_qr": signed_qr.payload_text,
            "name": "ANITA SHARMA",
            "aadhaar_number": "2345 6789 0124",  # ends 0124, QR says 9012
        }
    )
    mismatch = check(result, "aadhaar.number_vs_qr")
    assert mismatch.result is CheckResult.FAIL
    assert "9012" in mismatch.citation


def test_invalid_verhoeff_number_is_a_critical_structural_failure(signed_qr):
    result = run(
        {"aadhaar_qr": signed_qr.payload_text, "aadhaar_number": "1234 5678 9012"}
    )
    assert check(result, "aadhaar.number_checksum").result is CheckResult.FAIL


def test_legacy_xml_is_never_treated_as_proof():
    """An unsigned QR can be regenerated by anyone, so it cannot clear a card."""
    result = run({"aadhaar_qr": LEGACY_XML, "name": "ANITA SHARMA"})
    signature_check = check(result, "aadhaar.qr_signature")
    assert signature_check.result is CheckResult.INCONCLUSIVE
    assert "regenerate" in signature_check.citation


def test_no_qr_is_inconclusive_not_failed():
    result = run({"name": "ANITA SHARMA"})
    assert result.checks[0].result is CheckResult.INCONCLUSIVE


def test_date_of_birth_year_only_cards_compare_on_the_year(signed_qr):
    """Older cards print only a year of birth. That is not a mismatch."""
    result = run({"aadhaar_qr": signed_qr.payload_text, "date_of_birth": "1990"})
    assert check(result, "aadhaar.qr_vs_printed.date_of_birth").result is CheckResult.PASS
