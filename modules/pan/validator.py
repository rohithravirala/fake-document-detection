"""PAN number structure, and its agreement with the printed name.

A PAN is ``AAAAA9999A``. Three parts of it are not arbitrary:

``[3]`` (4th character)
    The holder category. ``P`` for an individual, ``C`` for a company, and so on.
    Only ten letters are valid; anything else means the number was invented.

``[4]`` (5th character)
    The first letter of the holder's surname (or of the entity name for a
    non-individual). This is the useful one — it ties the number to the printed
    name, so altering the name without re-issuing the card leaves a contradiction.

``[5:9]``
    A four digit serial, and ``[9]`` an alphabetic check character. The check
    character's algorithm is not published, so we deliberately do not claim to
    verify it. Claiming a check we cannot actually perform would be worse than
    not performing it.

No model, no image, no network. This is why PAN is stage 1.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional

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

PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

#: The ten valid holder-category letters and what each one means.
CATEGORIES: Dict[str, str] = {
    "P": "Individual",
    "C": "Company",
    "H": "Hindu Undivided Family",
    "F": "Firm / LLP",
    "A": "Association of Persons",
    "T": "Trust",
    "B": "Body of Individuals",
    "G": "Government",
    "J": "Artificial Juridical Person",
    "L": "Local Authority",
}

#: Category letters where the 5th character refers to a personal surname rather
#: than to an organisation name.
INDIVIDUAL_CATEGORIES = frozenset({"P", "H"})

#: Honorifics and generic tokens that are never a surname, so they are not
#: treated as candidates when matching the 5th character.
_NAME_NOISE = frozenset(
    {
        "MR",
        "MRS",
        "MS",
        "SHRI",
        "SMT",
        "KUM",
        "DR",
        "PROF",
        "LATE",
        "S",
        "O",
        "SO",
        "DO",
        "WO",
    }
)


@dataclass(frozen=True)
class ParsedPan:
    """A syntactically valid PAN, broken into its meaningful parts."""

    raw: str
    normalised: str
    category_code: str
    category_name: str
    surname_initial: str
    serial: str
    check_char: str


def normalise_pan(value: str) -> str:
    """Strip the separators OCR and data entry introduce, and upper-case."""
    return re.sub(r"[\s\-_.]", "", (value or "")).upper()


def parse_pan(value: str) -> Optional[ParsedPan]:
    """Parse a PAN, or return ``None`` if it is not structurally a PAN at all."""
    normalised = normalise_pan(value)
    if not PAN_PATTERN.match(normalised):
        return None
    category_code = normalised[3]
    return ParsedPan(
        raw=value,
        normalised=normalised,
        category_code=category_code,
        category_name=CATEGORIES.get(category_code, "unknown"),
        surname_initial=normalised[4],
        serial=normalised[5:9],
        check_char=normalised[9],
    )


def name_tokens(name: str) -> List[str]:
    """Split a printed name into candidate surname tokens.

    Initials and honorifics are dropped. A single letter is not a surname, and
    "MR" is not a name — treating either as a candidate would let a forged card
    pass on a coincidence.
    """
    cleaned = re.sub(r"[^A-Za-z\s]", " ", (name or "")).upper()
    return [
        token for token in cleaned.split() if len(token) > 1 and token not in _NAME_NOISE
    ]


def validate_pan(pan: str, printed_name: Optional[str] = None) -> List[Check]:
    """Run every PAN check and return them in the order they were evaluated.

    Passing ``printed_name`` enables the surname check, which is the only one of
    these that can catch an edited card. Without it the function still validates
    structure, but says so rather than silently skipping.
    """
    checks: List[Check] = []
    normalised = normalise_pan(pan)

    # -- 1. format ---------------------------------------------------------
    parsed = parse_pan(pan)
    if parsed is None:
        checks.append(
            failed(
                "pan.format",
                CheckType.STRUCTURAL,
                f"The PAN '{normalised or pan}' does not match the mandatory "
                "format of five letters, four digits and one letter.",
                Severity.CRITICAL,
                evidence=[
                    Evidence(
                        note="PAN must be AAAAA9999A",
                        expected="AAAAA9999A",
                        observed=normalised or str(pan),
                        source_field="pan_number",
                    )
                ],
                module="pan",
            )
        )
        return checks

    checks.append(
        passed(
            "pan.format",
            CheckType.STRUCTURAL,
            f"The PAN '{parsed.normalised}' matches the mandatory format of five "
            "letters, four digits and one letter.",
            evidence=[
                Evidence(
                    note="format AAAAA9999A",
                    expected="AAAAA9999A",
                    observed=parsed.normalised,
                    source_field="pan_number",
                )
            ],
            module="pan",
        )
    )

    # -- 2. holder category ------------------------------------------------
    if parsed.category_code not in CATEGORIES:
        checks.append(
            failed(
                "pan.category",
                CheckType.STRUCTURAL,
                f"The fourth character '{parsed.category_code}' is not a valid "
                "holder category. Only P, C, H, F, A, T, B, G, J and L are issued.",
                Severity.CRITICAL,
                evidence=[
                    Evidence(
                        note="fourth character encodes the holder category",
                        expected="one of " + ", ".join(sorted(CATEGORIES)),
                        observed=parsed.category_code,
                        source_field="pan_number",
                    )
                ],
                module="pan",
            )
        )
    else:
        checks.append(
            passed(
                "pan.category",
                CheckType.STRUCTURAL,
                f"The fourth character '{parsed.category_code}' encodes a valid "
                f"holder category: {parsed.category_name}.",
                evidence=[
                    Evidence(
                        note=f"category {parsed.category_code} = {parsed.category_name}",
                        observed=parsed.category_code,
                        source_field="pan_number",
                    )
                ],
                module="pan",
            )
        )

    # -- 3. surname initial ------------------------------------------------
    checks.append(_surname_check(parsed, printed_name))
    return checks


def _surname_check(parsed: ParsedPan, printed_name: Optional[str]) -> Check:
    """Compare the 5th character of the number against the printed name.

    Three outcomes, and the middle one matters. Indian names are written surname
    first as often as surname last, so a match against a non-final token is still
    a match — it just cannot be described as confidently. Forcing a binary answer
    here would reject genuine cards.
    """
    subject = (
        "surname" if parsed.category_code in INDIVIDUAL_CATEGORIES else "entity name"
    )

    if not printed_name or not printed_name.strip():
        return inconclusive(
            "pan.surname_initial",
            CheckType.CROSS_FIELD,
            f"The PAN encodes '{parsed.surname_initial}' as the first letter of "
            f"the {subject}, but no name was read from the card to compare it "
            "against.",
            severity=Severity.MEDIUM,
            evidence=[
                Evidence(
                    note="no printed name available for comparison",
                    expected=parsed.surname_initial,
                    source_field="name",
                )
            ],
            module="pan",
        )

    tokens = name_tokens(printed_name)
    if not tokens:
        return inconclusive(
            "pan.surname_initial",
            CheckType.CROSS_FIELD,
            f"The PAN encodes '{parsed.surname_initial}' as the first letter of "
            f"the {subject}, but the printed name '{printed_name}' could not be "
            "resolved into name words.",
            severity=Severity.MEDIUM,
            evidence=[
                Evidence(
                    note="printed name contained no usable tokens",
                    expected=parsed.surname_initial,
                    observed=printed_name,
                    source_field="name",
                )
            ],
            module="pan",
        )

    initials = [token[0] for token in tokens]
    expected = parsed.surname_initial

    if expected == initials[-1]:
        return passed(
            "pan.surname_initial",
            CheckType.CROSS_FIELD,
            f"The PAN encodes '{expected}' as the first letter of the {subject}, "
            f"and the printed name ends with '{tokens[-1]}'. They agree.",
            evidence=[
                Evidence(
                    note="fifth character matches the final name word",
                    expected=expected,
                    observed=tokens[-1],
                    source_field="name",
                )
            ],
            module="pan",
        )

    if expected in initials:
        matched = tokens[initials.index(expected)]
        return passed(
            "pan.surname_initial",
            CheckType.CROSS_FIELD,
            f"The PAN encodes '{expected}' as the first letter of the {subject}, "
            f"which matches '{matched}' in the printed name. Indian names are "
            "written surname-first as often as surname-last, so this is "
            "consistent.",
            evidence=[
                Evidence(
                    note="fifth character matches a non-final name word",
                    expected=expected,
                    observed=matched,
                    source_field="name",
                )
            ],
            module="pan",
        )

    return failed(
        "pan.surname_initial",
        CheckType.CROSS_FIELD,
        f"The PAN encodes '{expected}' as the first letter of the {subject}, but "
        f"no word in the printed name '{printed_name.strip()}' begins with that "
        "letter. The number and the name do not belong to the same card.",
        Severity.CRITICAL,
        evidence=[
            Evidence(
                note="fifth character matches no word of the printed name",
                expected=expected,
                observed=", ".join(f"{t} ({t[0]})" for t in tokens),
                source_field="name",
            )
        ],
        module="pan",
    )


class PanVerifier(Verifier):
    """Wires :func:`validate_pan` into the module registry."""

    name = "pan"
    doc_types = (DocumentType.PAN,)
    order = 20

    def verify(self, document: DocumentInput) -> ModuleResult:
        pan_number = document.field_value("pan_number")
        printed_name = document.field_value("name")

        if not pan_number:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "pan.number_present",
                        CheckType.STRUCTURAL,
                        "No PAN number could be read from this document, so its "
                        "structure could not be checked.",
                        severity=Severity.HIGH,
                        evidence=[Evidence(note="pan_number field absent")],
                        module=self.name,
                    )
                ],
            )

        checks = validate_pan(pan_number, printed_name)
        fields: List[ExtractedField] = []
        parsed = parse_pan(pan_number)
        if parsed is not None:
            fields.append(
                ExtractedField(
                    name="pan_category",
                    value=parsed.category_name,
                    source="pan",
                    confidence=1.0,
                )
            )
        return ModuleResult(module=self.name, checks=checks, fields=fields)
