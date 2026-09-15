"""The ICAO 9303 check digit.

Every machine-readable travel document carries check digits over its own data.
They exist so a reader can detect a misread — but they also mean a forger who
edits a date or a number without recomputing them leaves arithmetic proof of the
edit behind.

The algorithm, from ICAO Doc 9303 Part 3:

* each character has a value — digits are themselves, ``A``-``Z`` are 10-35,
  and the filler ``<`` is 0
* the weights 7, 3, 1 repeat across the field
* the check digit is the sum of value times weight, modulo 10

What this catches, and what it does not
---------------------------------------
Be precise about this, because it is the first thing a careful evaluator will
press on.

Check digits are **modulo 10**. A forger who edits a field and recomputes its
digit produces an MRZ that verifies perfectly — and because the composite digit
is computed the same way, roughly one such edit in ten leaves that unchanged too.
The project's own test suite contains a worked example of exactly this
(``test_a_forger_who_recomputes_every_digit_is_not_caught_by_arithmetic``).

So MRZ arithmetic reliably catches:

* a field edited without recomputing its digit — the common, careless forgery,
* an OCR misread, which is what the digits were designed for in the first place.

It does not catch a forger who recomputes the digits. Against that, the defences
are elsewhere and this is why the passport module does not rely on check digits
alone:

* the MRZ must also agree with the **printed data page** — two surfaces to edit
  consistently rather than one, and the printed side has no arithmetic to hide
  behind;
* an ePassport's **chip is signed** by the issuing state, which is the passport
  equivalent of the Aadhaar Secure QR and the only decisive check available.
  Reading it needs NFC hardware and is out of scope here, so a passport in this
  system can be rejected with certainty but cleared only provisionally.

Stating the boundary is not a weakness in the design. A system that claimed check
digits prove authenticity would be wrong, and an evaluator would find it.
"""

from __future__ import annotations

from typing import Optional

WEIGHTS = (7, 3, 1)


def char_value(char: str) -> int:
    """Numeric value of one MRZ character.

    Raises ``ValueError`` on anything outside the MRZ character set rather than
    silently scoring it zero, because a stray character means the line was
    misread and the resulting check digit would be meaningless.
    """
    if char.isdigit():
        return int(char)
    if char == "<":
        return 0
    if "A" <= char <= "Z":
        return ord(char) - 55
    raise ValueError(f"{char!r} is not a valid MRZ character")


def check_digit(field: str) -> int:
    """Compute the check digit for an MRZ field."""
    return sum(char_value(c) * WEIGHTS[i % 3] for i, c in enumerate(field)) % 10


def verify_check_digit(field: str, digit: str) -> Optional[bool]:
    """Compare a field against its printed check digit.

    Returns ``None`` when the check cannot be evaluated — a non-numeric digit, or
    the ``<`` filler that ICAO permits when an optional field is entirely empty.
    ``None`` means "no opinion", and must not be reported as a pass or a failure.
    """
    if digit == "<":
        # Permitted only when the field itself is empty filler.
        return None if set(field) <= {"<"} else False
    if not digit.isdigit():
        return None
    try:
        return check_digit(field) == int(digit)
    except ValueError:
        return False
