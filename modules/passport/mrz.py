"""Machine-readable zone parsing for TD1, TD2 and TD3 documents.

The MRZ is the most verifiable thing on a passport, because it restates the data
page in a form that carries its own check digits. If the printed expiry says 2030
and the MRZ says 2020, one of them was edited.

Two rules govern this file:

* **Never strip the ``<`` filler.** It carries field boundaries and separates the
  surname from the given names. Stripping it destroys information.
* **Never guess at a malformed line.** A line of the wrong length is reported as
  unreadable, not parsed on a best-effort basis. A best-effort parse of a
  misread MRZ produces confident nonsense.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from modules.passport.checkdigit import verify_check_digit

MRZ_CHARS = re.compile(r"^[A-Z0-9<]+$")

#: line count and line length for each supported format
FORMATS: Dict[str, Tuple[int, int]] = {
    "TD1": (3, 30),
    "TD2": (2, 36),
    "TD3": (2, 44),
}


@dataclass
class FieldCheck:
    """One check digit, and whether the field it covers agrees with it."""

    field_name: str
    value: str
    printed_digit: str
    computed_digit: Optional[int]
    valid: Optional[bool]
    """``None`` means the digit could not be evaluated, not that it failed."""


@dataclass
class ParsedMrz:
    """Everything an MRZ states, plus whether it agrees with itself."""

    mrz_format: str
    lines: List[str]
    document_code: str = ""
    issuing_state: str = ""
    surname: str = ""
    given_names: str = ""
    document_number: str = ""
    nationality: str = ""
    date_of_birth: str = ""
    sex: str = ""
    date_of_expiry: str = ""
    optional_data: str = ""
    checks: List[FieldCheck] = field(default_factory=list)

    @property
    def full_name(self) -> str:
        return " ".join(part for part in (self.given_names, self.surname) if part)

    @property
    def failed_checks(self) -> List[FieldCheck]:
        return [c for c in self.checks if c.valid is False]

    @property
    def evaluated_checks(self) -> List[FieldCheck]:
        return [c for c in self.checks if c.valid is not None]

    @property
    def all_valid(self) -> bool:
        """True only when at least one digit was evaluated and none failed."""
        evaluated = self.evaluated_checks
        return bool(evaluated) and all(c.valid for c in evaluated)

    def to_dict(self) -> Dict[str, object]:
        return {
            "format": self.mrz_format,
            "document_code": self.document_code,
            "issuing_state": self.issuing_state,
            "surname": self.surname,
            "given_names": self.given_names,
            "document_number": self.document_number,
            "nationality": self.nationality,
            "date_of_birth": self.date_of_birth,
            "sex": self.sex,
            "date_of_expiry": self.date_of_expiry,
            "optional_data": self.optional_data,
            "checks": [
                {
                    "field": c.field_name,
                    "value": c.value,
                    "printed": c.printed_digit,
                    "computed": c.computed_digit,
                    "valid": c.valid,
                }
                for c in self.checks
            ],
        }


class MrzFormatError(ValueError):
    """The text handed in is not a well-formed MRZ."""


# ---------------------------------------------------------------------------
#  Normalisation
# ---------------------------------------------------------------------------

#: Substitutions for the confusions general OCR makes on OCR-B glyphs. Applied
#: only when a line is otherwise the right length, so we correct a misread rather
#: than manufacture a valid-looking line out of a wrong one.
_OCR_CONFUSIONS = str.maketrans({"«": "<", "≪": "<", "|": "<", "¦": "<", " ": "<"})


def normalise_lines(text: str) -> List[str]:
    """Split raw OCR output into candidate MRZ lines.

    Upper-cases, maps the usual OCR-B confusions onto ``<``, and drops lines too
    short to be part of any MRZ.
    """
    raw_lines = [ln.strip() for ln in (text or "").replace("\r", "\n").split("\n")]
    lines: List[str] = []
    for line in raw_lines:
        candidate = line.upper().translate(_OCR_CONFUSIONS)
        candidate = re.sub(r"[^A-Z0-9<]", "", candidate)
        if len(candidate) >= 28:
            lines.append(candidate)
    return lines


def detect_format(lines: List[str]) -> Optional[str]:
    """Identify the MRZ format from line count and length, or return ``None``."""
    for name, (count, length) in FORMATS.items():
        if len(lines) == count and all(len(ln) == length for ln in lines):
            return name
    return None


def parse_names(chunk: str) -> Tuple[str, str]:
    """Split the name field into surname and given names.

    ``ERIKSSON<<ANNA<MARIA<<<`` becomes ``("ERIKSSON", "ANNA MARIA")``. The double
    filler is the separator; single fillers are spaces; trailing fillers are
    padding.
    """
    surname_part, _, given_part = chunk.partition("<<")
    surname = surname_part.replace("<", " ").strip()
    given = re.sub(r"<+", " ", given_part).strip()
    return surname, given


def parse_date(value: str, *, is_expiry: bool) -> Optional[dt.date]:
    """Turn ``YYMMDD`` into a date, resolving the century.

    The MRZ stores two digits, so the century has to be inferred. A date of birth
    cannot be in the future, and an expiry is not decades in the past — those two
    facts resolve it in almost every real case.
    """
    if len(value) != 6 or not value.isdigit():
        return None
    year_2, month, day = int(value[0:2]), int(value[2:4]), int(value[4:6])
    today = dt.date.today()
    current_2 = today.year % 100

    if is_expiry:
        # Expiry: assume this century unless that puts it implausibly far back.
        year = 2000 + year_2
        if year < today.year - 20:
            year += 100
    else:
        # Birth: never in the future.
        year = 2000 + year_2
        if year_2 > current_2:
            year = 1900 + year_2

    try:
        return dt.date(year, month, day)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
#  Format-specific parsers
# ---------------------------------------------------------------------------


def _parse_td3(lines: List[str]) -> ParsedMrz:
    l1, l2 = lines
    parsed = ParsedMrz(mrz_format="TD3", lines=list(lines))
    parsed.document_code = l1[0:2].replace("<", "")
    parsed.issuing_state = l1[2:5].replace("<", "")
    parsed.surname, parsed.given_names = parse_names(l1[5:44])

    parsed.document_number = l2[0:9].replace("<", "")
    parsed.nationality = l2[10:13].replace("<", "")
    parsed.date_of_birth = l2[13:19]
    parsed.sex = l2[20].replace("<", "")
    parsed.date_of_expiry = l2[21:27]
    parsed.optional_data = l2[28:42].replace("<", "")

    composite = l2[0:10] + l2[13:20] + l2[21:43]
    parsed.checks = _build_checks(
        [
            ("document_number", l2[0:9], l2[9]),
            ("date_of_birth", l2[13:19], l2[19]),
            ("date_of_expiry", l2[21:27], l2[27]),
            ("optional_data", l2[28:42], l2[42]),
            ("composite", composite, l2[43]),
        ]
    )
    return parsed


def _parse_td2(lines: List[str]) -> ParsedMrz:
    l1, l2 = lines
    parsed = ParsedMrz(mrz_format="TD2", lines=list(lines))
    parsed.document_code = l1[0:2].replace("<", "")
    parsed.issuing_state = l1[2:5].replace("<", "")
    parsed.surname, parsed.given_names = parse_names(l1[5:36])

    parsed.document_number = l2[0:9].replace("<", "")
    parsed.nationality = l2[10:13].replace("<", "")
    parsed.date_of_birth = l2[13:19]
    parsed.sex = l2[20].replace("<", "")
    parsed.date_of_expiry = l2[21:27]
    parsed.optional_data = l2[28:35].replace("<", "")

    composite = l2[0:10] + l2[13:20] + l2[21:35]
    parsed.checks = _build_checks(
        [
            ("document_number", l2[0:9], l2[9]),
            ("date_of_birth", l2[13:19], l2[19]),
            ("date_of_expiry", l2[21:27], l2[27]),
            ("composite", composite, l2[35]),
        ]
    )
    return parsed


def _parse_td1(lines: List[str]) -> ParsedMrz:
    l1, l2, l3 = lines
    parsed = ParsedMrz(mrz_format="TD1", lines=list(lines))
    parsed.document_code = l1[0:2].replace("<", "")
    parsed.issuing_state = l1[2:5].replace("<", "")
    parsed.document_number = l1[5:14].replace("<", "")
    parsed.optional_data = (l1[15:30] + l2[18:29]).replace("<", "")

    parsed.date_of_birth = l2[0:6]
    parsed.sex = l2[7].replace("<", "")
    parsed.date_of_expiry = l2[8:14]
    parsed.nationality = l2[15:18].replace("<", "")
    parsed.surname, parsed.given_names = parse_names(l3)

    composite = l1[5:30] + l2[0:7] + l2[8:15] + l2[18:29]
    parsed.checks = _build_checks(
        [
            ("document_number", l1[5:14], l1[14]),
            ("date_of_birth", l2[0:6], l2[6]),
            ("date_of_expiry", l2[8:14], l2[14]),
            ("composite", composite, l2[29]),
        ]
    )
    return parsed


def _build_checks(specs: List[Tuple[str, str, str]]) -> List[FieldCheck]:
    from modules.passport.checkdigit import check_digit

    results: List[FieldCheck] = []
    for name, value, printed in specs:
        valid = verify_check_digit(value, printed)
        try:
            computed: Optional[int] = check_digit(value)
        except ValueError:
            computed = None
        results.append(
            FieldCheck(
                field_name=name,
                value=value,
                printed_digit=printed,
                computed_digit=computed,
                valid=valid,
            )
        )
    return results


_PARSERS = {"TD1": _parse_td1, "TD2": _parse_td2, "TD3": _parse_td3}


def parse_mrz(text: str) -> ParsedMrz:
    """Parse an MRZ from raw text.

    Raises :class:`MrzFormatError` when the input is not a recognisable MRZ. The
    caller turns that into an "unreadable" check — never into a failed one.
    """
    lines = normalise_lines(text)
    if not lines:
        raise MrzFormatError("no machine-readable zone found in the text")

    mrz_format = detect_format(lines)
    if mrz_format is None:
        shape = ", ".join(str(len(ln)) for ln in lines)
        raise MrzFormatError(
            f"{len(lines)} line(s) of length {shape} match no known MRZ format "
            "(TD1 is 3x30, TD2 is 2x36, TD3 is 2x44)"
        )

    for line in lines:
        if not MRZ_CHARS.match(line):
            raise MrzFormatError("MRZ contains characters outside A-Z, 0-9 and <")

    return _PARSERS[mrz_format](lines)
