"""Turn a parsed MRZ into checks, and compare it against the printed data page.

Two independent sources of evidence live on a passport:

1.  the MRZ agreeing with **itself**, through its check digits, and
2.  the MRZ agreeing with the **printed** data page.

A forger who edits the printed page breaks (2). A forger who edits the MRZ
breaks (1). Editing both consistently requires recomputing the check digits,
which most do not do.
"""

from __future__ import annotations

import datetime as dt
from typing import List, Optional

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
)
from modules.common.verifier import Verifier
from modules.passport.mrz import MrzFormatError, ParsedMrz, parse_date, parse_mrz

#: Printed field -> MRZ attribute, for the cross-field comparison.
_CROSS_FIELDS = (
    ("passport_number", "document_number", "passport number", Severity.CRITICAL),
    ("date_of_birth", "date_of_birth", "date of birth", Severity.CRITICAL),
    ("date_of_expiry", "date_of_expiry", "date of expiry", Severity.CRITICAL),
    ("nationality", "nationality", "nationality", Severity.HIGH),
    ("sex", "sex", "sex", Severity.MEDIUM),
)

_FIELD_LABELS = {
    "document_number": "document number",
    "date_of_birth": "date of birth",
    "date_of_expiry": "date of expiry",
    "optional_data": "optional data",
    "composite": "composite field covering the whole second line",
}


def _normalise(value: str) -> str:
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())


def _normalise_date(value: str) -> str:
    """Reduce a printed date to the MRZ's ``YYMMDD`` so the two can be compared."""
    raw = (value or "").strip()
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 6:
        return digits
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d.%m.%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return dt.datetime.strptime(raw, fmt).strftime("%y%m%d")
        except ValueError:
            continue
    if len(digits) == 8:
        # Ambiguous ordering; assume DDMMYYYY, the common printed form.
        return digits[6:8] + digits[2:4] + digits[0:2]
    return ""


def checks_from_mrz(parsed: ParsedMrz) -> List[Check]:
    """One check per check digit, plus one summarising the whole MRZ."""
    checks: List[Check] = []

    for field_check in parsed.checks:
        label = _FIELD_LABELS.get(field_check.field_name, field_check.field_name)
        check_id = f"passport.check_digit.{field_check.field_name}"

        if field_check.valid is None:
            checks.append(
                inconclusive(
                    check_id,
                    CheckType.STRUCTURAL,
                    f"The check digit for the {label} is '{field_check.printed_digit}', "
                    "which is not a digit, so it could not be evaluated.",
                    severity=Severity.LOW,
                    evidence=[
                        Evidence(
                            note="check digit not evaluable",
                            observed=field_check.printed_digit,
                            source_field=field_check.field_name,
                        )
                    ],
                    module="passport",
                )
            )
        elif field_check.valid:
            checks.append(
                passed(
                    check_id,
                    CheckType.STRUCTURAL,
                    f"The {label} '{field_check.value}' agrees with its printed "
                    f"check digit {field_check.printed_digit}.",
                    evidence=[
                        Evidence(
                            note="ICAO 9303 check digit verified",
                            expected=str(field_check.computed_digit),
                            observed=field_check.printed_digit,
                            source_field=field_check.field_name,
                        )
                    ],
                    module="passport",
                )
            )
        else:
            checks.append(
                failed(
                    check_id,
                    CheckType.STRUCTURAL,
                    f"The {label} '{field_check.value}' requires check digit "
                    f"{field_check.computed_digit}, but the document prints "
                    f"'{field_check.printed_digit}'. This field was altered after "
                    "the document was issued.",
                    Severity.CRITICAL,
                    evidence=[
                        Evidence(
                            note="ICAO 9303 check digit mismatch",
                            expected=str(field_check.computed_digit),
                            observed=field_check.printed_digit,
                            source_field=field_check.field_name,
                        )
                    ],
                    module="passport",
                )
            )

    return checks


def checks_against_printed(parsed: ParsedMrz, document: DocumentInput) -> List[Check]:
    """Compare each MRZ field against the same field read off the printed page."""
    checks: List[Check] = []

    for printed_name, mrz_attr, label, severity in _CROSS_FIELDS:
        printed_value = document.field_value(printed_name, source="ocr")
        if printed_value is None:
            printed_value = document.field_value(printed_name)
        mrz_value = getattr(parsed, mrz_attr, "")
        if not printed_value or not mrz_value:
            continue

        if "date" in printed_name:
            left, right = _normalise_date(printed_value), _normalise(mrz_value)
        else:
            left, right = _normalise(printed_value), _normalise(mrz_value)

        if not left:
            continue

        check_id = f"passport.mrz_vs_printed.{printed_name}"
        if left == right:
            checks.append(
                passed(
                    check_id,
                    CheckType.CROSS_FIELD,
                    f"The {label} printed on the data page matches the machine "
                    f"readable zone ({mrz_value}).",
                    evidence=[
                        Evidence(
                            note="printed data page agrees with the MRZ",
                            expected=mrz_value,
                            observed=printed_value,
                            source_field=printed_name,
                        )
                    ],
                    module="passport",
                )
            )
        else:
            checks.append(
                failed(
                    check_id,
                    CheckType.CROSS_FIELD,
                    f"The {label} printed on the data page is '{printed_value}', "
                    f"but the machine readable zone states '{mrz_value}'. The two "
                    "halves of the same document disagree.",
                    severity,
                    evidence=[
                        Evidence(
                            note="printed data page contradicts the MRZ",
                            expected=mrz_value,
                            observed=printed_value,
                            source_field=printed_name,
                        )
                    ],
                    module="passport",
                )
            )

    # Name is compared separately: OCR word order on the printed page is not
    # reliable, so we compare the set of name words rather than the exact string.
    printed_name_value = document.field_value("name")
    if printed_name_value and parsed.full_name:
        printed_words = {
            w for w in printed_name_value.upper().replace(",", " ").split() if w.isalpha()
        }
        mrz_words = {w for w in parsed.full_name.upper().split() if w.isalpha()}
        if mrz_words and printed_words:
            overlap = printed_words & mrz_words
            if overlap in (mrz_words, printed_words):
                checks.append(
                    passed(
                        "passport.mrz_vs_printed.name",
                        CheckType.CROSS_FIELD,
                        f"The name printed on the data page matches the machine "
                        f"readable zone ({parsed.full_name}).",
                        evidence=[
                            Evidence(
                                note="name words agree",
                                expected=parsed.full_name,
                                observed=printed_name_value,
                                source_field="name",
                            )
                        ],
                        module="passport",
                    )
                )
            elif not overlap:
                checks.append(
                    failed(
                        "passport.mrz_vs_printed.name",
                        CheckType.CROSS_FIELD,
                        f"The name printed on the data page is "
                        f"'{printed_name_value}', but the machine readable zone "
                        f"states '{parsed.full_name}'. No part of the two names "
                        "agrees.",
                        Severity.CRITICAL,
                        evidence=[
                            Evidence(
                                note="printed name contradicts the MRZ name",
                                expected=parsed.full_name,
                                observed=printed_name_value,
                                source_field="name",
                            )
                        ],
                        module="passport",
                    )
                )
            else:
                checks.append(
                    inconclusive(
                        "passport.mrz_vs_printed.name",
                        CheckType.CROSS_FIELD,
                        f"The printed name '{printed_name_value}' and the machine "
                        f"readable zone name '{parsed.full_name}' agree only in "
                        f"part ({', '.join(sorted(overlap))}). This is common with "
                        "transliteration, but an examiner should confirm it.",
                        severity=Severity.MEDIUM,
                        evidence=[
                            Evidence(
                                note="partial name agreement",
                                expected=parsed.full_name,
                                observed=printed_name_value,
                                source_field="name",
                            )
                        ],
                        module="passport",
                    )
                )

    return checks


def expiry_check(parsed: ParsedMrz, today: Optional[dt.date] = None) -> Optional[Check]:
    """Whether the document is still valid on the day it is presented.

    This is a policy check, not an authenticity one: an expired passport is
    genuine and expired. It is reported with HIGH severity because the officer
    must act on it, but it says nothing about forgery.
    """
    today = today or dt.date.today()
    expiry = parse_date(parsed.date_of_expiry, is_expiry=True)
    if expiry is None:
        return None
    if expiry >= today:
        return passed(
            "passport.expiry",
            CheckType.POLICY,
            f"The document is valid until {expiry.isoformat()}.",
            evidence=[
                Evidence(
                    note="expiry in the future",
                    observed=expiry.isoformat(),
                    source_field="date_of_expiry",
                )
            ],
            module="passport",
        )
    return failed(
        "passport.expiry",
        CheckType.POLICY,
        f"The document expired on {expiry.isoformat()}. It is genuine only as a "
        "record; it is not valid for travel.",
        Severity.HIGH,
        evidence=[
            Evidence(
                note="expiry in the past",
                expected=f"on or after {today.isoformat()}",
                observed=expiry.isoformat(),
                source_field="date_of_expiry",
            )
        ],
        module="passport",
    )


def fields_from_mrz(parsed: ParsedMrz) -> List[ExtractedField]:
    """Expose the MRZ values as extracted fields for the rest of the pipeline."""
    mapping = {
        "passport_number": parsed.document_number,
        "name": parsed.full_name,
        "surname": parsed.surname,
        "given_names": parsed.given_names,
        "nationality": parsed.nationality,
        "date_of_birth": parsed.date_of_birth,
        "date_of_expiry": parsed.date_of_expiry,
        "sex": parsed.sex,
        "issuing_state": parsed.issuing_state,
    }
    return [
        ExtractedField(name=key, value=value, source="mrz", confidence=1.0)
        for key, value in mapping.items()
        if value
    ]


class PassportVerifier(Verifier):
    """MRZ check digits, MRZ against the printed page, and validity."""

    name = "passport"
    doc_types = (DocumentType.PASSPORT, DocumentType.VISA)
    order = 30

    def verify(self, document: DocumentInput) -> ModuleResult:
        mrz_text = document.field_value("mrz") or document.hints.get("mrz", "")
        if not mrz_text:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "passport.mrz_present",
                        CheckType.STRUCTURAL,
                        "No machine readable zone was found on this document, so "
                        "none of its check digits could be verified.",
                        severity=Severity.HIGH,
                        evidence=[Evidence(note="mrz field absent")],
                        module=self.name,
                    )
                ],
            )

        try:
            parsed = parse_mrz(mrz_text)
        except MrzFormatError as exc:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "passport.mrz_readable",
                        CheckType.STRUCTURAL,
                        f"The machine readable zone could not be parsed: {exc}. "
                        "This usually means a poor capture rather than a forgery.",
                        severity=Severity.HIGH,
                        evidence=[Evidence(note=str(exc), observed=mrz_text[:120])],
                        module=self.name,
                    )
                ],
            )

        checks = checks_from_mrz(parsed)
        checks.extend(checks_against_printed(parsed, document))
        validity = expiry_check(parsed)
        if validity is not None:
            checks.append(validity)

        return ModuleResult(
            module=self.name, checks=checks, fields=fields_from_mrz(parsed)
        )
