"""Aadhaar verification: signature first, then the card against what was signed.

The order matters and is deliberate:

1.  **Verify the UIDAI signature.** If it verifies, the QR's contents are
    authoritative. If it fails on a Secure QR, the payload was altered and that
    is decisive — nothing else needs to be considered.
2.  **Compare the signed fields against the printed card.** This is where an
    edited card is caught: the forger changed the printed name and could not
    re-sign the QR.
3.  **Check the number's own arithmetic** with Verhoeff, and check that the
    printed number's last four digits match the reference id inside the QR.

A legacy unsigned XML QR skips step 1 entirely and says so. Its field comparison
still has value — it catches a lazy forger — but it can never support CLEAR,
because regenerating an unsigned QR to match an edited card is trivial.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from modules.aadhaar import qr as qr_reader
from modules.aadhaar import signature as signature_module
from modules.aadhaar.secure_qr import AadhaarQrError, AadhaarQrPayload, parse_qr
from modules.aadhaar.verhoeff import validate as verhoeff_valid
from modules.common.types import (
    Check,
    CheckType,
    DocumentInput,
    DocumentType,
    Evidence,
    ExtractedField,
    ModuleResult,
    Severity,
    failed,
    inconclusive,
    passed,
    unavailable,
)
from modules.common.verifier import Verifier

#: signed QR field -> printed field, label, severity if they disagree
CROSS_FIELDS: Tuple[Tuple[str, str, str, Severity], ...] = (
    ("name", "name", "name", Severity.CRITICAL),
    ("dob", "date_of_birth", "date of birth", Severity.CRITICAL),
    ("gender", "gender", "gender", Severity.HIGH),
    ("pincode", "pincode", "PIN code", Severity.HIGH),
    ("state", "state", "state", Severity.MEDIUM),
    ("district", "district", "district", Severity.MEDIUM),
)


def normalise_text(value: str) -> str:
    """Upper-case and strip everything that is not a letter or digit."""
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def name_tokens(value: str) -> List[str]:
    """Name words, ignoring single-letter initials, which OCR invents freely."""
    cleaned = re.sub(r"[^A-Za-z\s]", " ", (value or "")).upper()
    return [t for t in cleaned.split() if len(t) > 1]


def normalise_dob(value: str) -> str:
    """Reduce a date of birth to comparable digits.

    Aadhaar prints ``DD/MM/YYYY`` on most cards and a bare year on some older
    ones, so a year-only value is compared on the year alone rather than being
    called a mismatch.
    """
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 8:
        return digits
    if len(digits) == 4:
        return digits
    return digits


def digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _compare(qr_value: str, printed_value: str, field: str) -> Optional[bool]:
    """Compare one field. ``None`` means not comparable, not a mismatch."""
    if not qr_value or not printed_value:
        return None

    if field == "name":
        qr_words = set(name_tokens(qr_value))
        printed_words = set(name_tokens(printed_value))
        if not qr_words or not printed_words:
            return None
        overlap = qr_words & printed_words
        if not overlap:
            return False
        # Every word of the shorter name must appear in the longer one.
        return overlap in (qr_words, printed_words)

    if field == "dob":
        left, right = normalise_dob(qr_value), normalise_dob(printed_value)
        if not left or not right:
            return None
        if len(left) == 4 or len(right) == 4:
            # One side carries only a year; compare the year alone.
            left_year = left[-4:] if len(left) == 8 else left
            right_year = right[-4:] if len(right) == 8 else right
            return left_year == right_year
        return left == right

    if field == "gender":
        return normalise_text(qr_value)[:1] == normalise_text(printed_value)[:1]

    return normalise_text(qr_value) == normalise_text(printed_value)


def signature_checks(payload: AadhaarQrPayload) -> List[Check]:
    """The cryptographic verdict on the QR itself."""
    if not payload.is_signed:
        return [
            inconclusive(
                "aadhaar.qr_signature",
                CheckType.CRYPTOGRAPHIC,
                "This card carries the older unsigned XML QR code, which any "
                "person can regenerate. Its contents cannot be treated as proof "
                "of authenticity, only as a consistency check.",
                severity=Severity.MEDIUM,
                evidence=[
                    Evidence(
                        note="legacy unsigned QR variant",
                        observed=payload.variant,
                        source_field="qr",
                    )
                ],
                module="aadhaar",
            )
        ]

    outcome = signature_module.verify_signature(payload.signed_data, payload.signature)

    if outcome.could_not_run:
        return [
            unavailable(
                "aadhaar.qr_signature",
                CheckType.CRYPTOGRAPHIC,
                f"The QR carries a UIDAI signature, but it could not be checked: "
                f"{outcome.detail}. The card has been neither cleared nor "
                "rejected by this check.",
                module="aadhaar",
                evidence=[Evidence(note=outcome.detail, source_field="qr")],
            )
        ]

    if outcome.is_valid:
        return [
            passed(
                "aadhaar.qr_signature",
                CheckType.CRYPTOGRAPHIC,
                "The QR code carries a valid UIDAI digital signature. The "
                "demographic data and photograph inside it were issued by UIDAI "
                "and have not been altered since.",
                evidence=[
                    Evidence(
                        note=outcome.detail,
                        expected="valid RSA signature",
                        observed="verified",
                        source_field="qr",
                        extra={
                            "certificate": outcome.certificate_subject,
                            "digest": outcome.digest,
                            "certificate_expiry": outcome.not_valid_after,
                        },
                    )
                ],
                module="aadhaar",
            )
        ]

    return [
        failed(
            "aadhaar.qr_signature",
            CheckType.CRYPTOGRAPHIC,
            "The QR code claims a UIDAI signature, but that signature does not "
            "verify. The QR data was altered after it was issued, or it was never "
            "issued by UIDAI at all.",
            Severity.CRITICAL,
            evidence=[
                Evidence(
                    note=outcome.detail,
                    expected="valid RSA signature",
                    observed="did not verify",
                    source_field="qr",
                )
            ],
            module="aadhaar",
        )
    ]


def cross_field_checks(payload: AadhaarQrPayload, document: DocumentInput) -> List[Check]:
    """Compare each signed field against the same field printed on the card."""
    checks: List[Check] = []
    trusted = "the signed QR" if payload.is_signed else "the QR"

    for qr_field, printed_field, label, severity in CROSS_FIELDS:
        qr_value = payload.fields.get(qr_field, "")
        printed_value = document.field_value(printed_field, source="ocr")
        if printed_value is None:
            printed_value = document.field_value(printed_field)
        if not qr_value or not printed_value:
            continue

        verdict = _compare(qr_value, printed_value, qr_field)
        if verdict is None:
            continue

        check_id = f"aadhaar.qr_vs_printed.{printed_field}"
        if verdict:
            checks.append(
                passed(
                    check_id,
                    CheckType.CROSS_FIELD,
                    f"The {label} printed on the card matches {trusted} ({qr_value}).",
                    evidence=[
                        Evidence(
                            note=f"printed {label} agrees with the QR",
                            expected=qr_value,
                            observed=printed_value,
                            source_field=printed_field,
                        )
                    ],
                    module="aadhaar",
                )
            )
        else:
            checks.append(
                failed(
                    check_id,
                    CheckType.CROSS_FIELD,
                    f"The {label} printed on the card is '{printed_value}', but "
                    f"{trusted} states '{qr_value}'. The printed card contradicts "
                    "the data issued for it.",
                    severity,
                    evidence=[
                        Evidence(
                            note=f"printed {label} contradicts the QR",
                            expected=qr_value,
                            observed=printed_value,
                            source_field=printed_field,
                        )
                    ],
                    module="aadhaar",
                )
            )

    return checks


def number_checks(payload: AadhaarQrPayload, document: DocumentInput) -> List[Check]:
    """Verhoeff arithmetic, and the printed number against the QR reference id."""
    checks: List[Check] = []
    printed_number = document.field_value("aadhaar_number") or ""
    printed_digits = digits_only(printed_number)

    # Many cards print the number masked as XXXX XXXX 9012.
    is_masked = bool(printed_number) and len(printed_digits) == 4

    if len(printed_digits) == 12:
        if verhoeff_valid(printed_digits):
            checks.append(
                passed(
                    "aadhaar.number_checksum",
                    CheckType.STRUCTURAL,
                    "The twelve digit Aadhaar number satisfies its Verhoeff check "
                    "digit, so it is a well-formed number.",
                    evidence=[
                        Evidence(
                            note="Verhoeff checksum valid",
                            observed=f"XXXX XXXX {printed_digits[-4:]}",
                            source_field="aadhaar_number",
                        )
                    ],
                    module="aadhaar",
                )
            )
        else:
            checks.append(
                failed(
                    "aadhaar.number_checksum",
                    CheckType.STRUCTURAL,
                    "The twelve digit Aadhaar number fails its Verhoeff check "
                    "digit. A number issued by UIDAI always satisfies it, so this "
                    "number was never issued.",
                    Severity.CRITICAL,
                    evidence=[
                        Evidence(
                            note="Verhoeff checksum invalid",
                            expected="a valid trailing check digit",
                            observed=f"XXXX XXXX {printed_digits[-4:]}",
                            source_field="aadhaar_number",
                        )
                    ],
                    module="aadhaar",
                )
            )
    elif printed_digits and not is_masked:
        checks.append(
            inconclusive(
                "aadhaar.number_checksum",
                CheckType.STRUCTURAL,
                f"The Aadhaar number read from the card has {len(printed_digits)} "
                "digits rather than twelve, so its check digit could not be "
                "evaluated. This is usually a misread.",
                severity=Severity.MEDIUM,
                evidence=[
                    Evidence(
                        note="unexpected digit count",
                        expected="12 digits",
                        observed=f"{len(printed_digits)} digits",
                        source_field="aadhaar_number",
                    )
                ],
                module="aadhaar",
            )
        )

    # Last four digits against the reference id inside the QR.
    qr_last4 = payload.aadhaar_last4
    if qr_last4 and printed_digits:
        printed_last4 = printed_digits[-4:]
        source = "the signed QR" if payload.is_signed else "the QR"
        if printed_last4 == qr_last4:
            checks.append(
                passed(
                    "aadhaar.number_vs_qr",
                    CheckType.CROSS_FIELD,
                    f"The last four digits of the printed Aadhaar number "
                    f"({printed_last4}) match the reference id in {source}.",
                    evidence=[
                        Evidence(
                            note="printed number agrees with the QR reference id",
                            expected=qr_last4,
                            observed=printed_last4,
                            source_field="aadhaar_number",
                        )
                    ],
                    module="aadhaar",
                )
            )
        else:
            checks.append(
                failed(
                    "aadhaar.number_vs_qr",
                    CheckType.CROSS_FIELD,
                    f"The printed Aadhaar number ends in {printed_last4}, but "
                    f"{source} was issued for a number ending in {qr_last4}. The "
                    "QR on this card belongs to a different Aadhaar number.",
                    Severity.CRITICAL,
                    evidence=[
                        Evidence(
                            note="printed number contradicts the QR reference id",
                            expected=qr_last4,
                            observed=printed_last4,
                            source_field="aadhaar_number",
                        )
                    ],
                    module="aadhaar",
                )
            )

    return checks


def fields_from_payload(payload: AadhaarQrPayload) -> List[ExtractedField]:
    """Expose the QR's contents as extracted fields, tagged with their source.

    The source name is what keeps a signed value and an OCR value distinguishable
    everywhere downstream.
    """
    source = "qr_signed" if payload.is_signed else "qr_unsigned"
    mapping = {
        "name": payload.fields.get("name", ""),
        "date_of_birth": payload.fields.get("dob", ""),
        "gender": payload.fields.get("gender", ""),
        "pincode": payload.fields.get("pincode", ""),
        "state": payload.fields.get("state", ""),
        "district": payload.fields.get("district", ""),
        "care_of": payload.fields.get("care_of", ""),
        "aadhaar_last4": payload.aadhaar_last4,
    }
    return [
        ExtractedField(name=key, value=value, source=source, confidence=1.0)
        for key, value in mapping.items()
        if value
    ]


class AadhaarVerifier(Verifier):
    """Decode the QR, verify its signature, and check the card against it."""

    name = "aadhaar"
    doc_types = (DocumentType.AADHAAR,)
    order = 25

    def available(self) -> bool:
        # The module is useful even without a certificate — the field comparison
        # and Verhoeff checks still run, and the signature check reports itself
        # as unavailable rather than silently passing.
        return True

    def verify(self, document: DocumentInput) -> ModuleResult:
        raw_payload = document.field_value("aadhaar_qr") or document.hints.get(
            "aadhaar_qr"
        )
        qr_bbox = None

        if not raw_payload and document.image_path:
            if not qr_reader.available():
                return ModuleResult(
                    module=self.name,
                    checks=[
                        unavailable(
                            "aadhaar.qr_present",
                            CheckType.CRYPTOGRAPHIC,
                            "No QR decoder is installed in this deployment, so "
                            "the Aadhaar QR could not be read.",
                            module=self.name,
                        )
                    ],
                )
            decodes = qr_reader.decode_file(document.image_path)
            if decodes:
                raw_payload = decodes[0].payload
                qr_bbox = decodes[0].bbox

        if not raw_payload:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "aadhaar.qr_present",
                        CheckType.CRYPTOGRAPHIC,
                        "No QR code could be read from this card. Aadhaar cards "
                        "carry a large, dense QR that often needs a closer or "
                        "sharper photograph.",
                        severity=Severity.HIGH,
                        evidence=[Evidence(note="no QR decoded", region=qr_bbox)],
                        module=self.name,
                    )
                ],
            )

        try:
            payload = parse_qr(raw_payload)
        except AadhaarQrError as exc:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "aadhaar.qr_readable",
                        CheckType.CRYPTOGRAPHIC,
                        f"A QR code was found but its contents are not an Aadhaar "
                        f"payload: {exc}.",
                        severity=Severity.HIGH,
                        evidence=[Evidence(note=str(exc), region=qr_bbox)],
                        module=self.name,
                    )
                ],
            )

        checks = signature_checks(payload)
        checks.extend(cross_field_checks(payload, document))
        checks.extend(number_checks(payload, document))

        if qr_bbox is not None:
            for check in checks:
                for evidence in check.evidence:
                    if evidence.region is None and evidence.source_field == "qr":
                        evidence.region = qr_bbox

        return ModuleResult(
            module=self.name, checks=checks, fields=fields_from_payload(payload)
        )
