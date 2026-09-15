"""The Verhoeff checksum, which every Aadhaar number carries.

An Aadhaar number is twelve digits, and the twelfth is a Verhoeff check digit
over the first eleven. Verhoeff was chosen over a simple modulus because it
catches every single-digit error and every adjacent transposition — exactly the
mistakes a human makes when inventing or mistyping a number.

For us this means a forged card carrying a made-up twelve digit number fails
arithmetic, with no model, no network and no UIDAI lookup. It does not prove the
number was *issued* — only that it is well-formed — so it is reported as a
structural check, not as proof of authenticity.
"""

from __future__ import annotations

from typing import List

# Multiplication table for the dihedral group D5.
_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)

# Permutation table, applied by position.
_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)

# Multiplicative inverse in D5.
_INV = (0, 4, 3, 2, 1, 5, 6, 7, 8, 9)


def _digits(number: str) -> List[int]:
    return [int(ch) for ch in number if ch.isdigit()]


def checksum(number: str) -> int:
    """Verhoeff checksum of a digit string. Zero means the string is valid."""
    c = 0
    for i, digit in enumerate(reversed(_digits(number))):
        c = _D[c][_P[i % 8][digit]]
    return c


def validate(number: str) -> bool:
    """True when the number's trailing check digit is correct."""
    digits = _digits(number)
    if not digits:
        return False
    return checksum("".join(str(d) for d in digits)) == 0


def generate_check_digit(payload: str) -> int:
    """Check digit that would make ``payload`` a valid Verhoeff number.

    Used by the evaluation harness to build synthetic Aadhaar numbers that are
    structurally correct, so the sample set exercises the real code path.
    """
    c = 0
    for i, digit in enumerate(reversed(_digits(payload))):
        c = _D[c][_P[(i + 1) % 8][digit]]
    return _INV[c]
