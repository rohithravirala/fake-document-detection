"""The Verhoeff checksum carried by every Aadhaar number.

Verhoeff's property is that it catches all single-digit errors and all adjacent
transpositions. Those are exactly the mistakes made when a number is invented or
mistyped, so the tests below check the property rather than a handful of values.
"""

from __future__ import annotations

import pytest

from modules.aadhaar.verhoeff import checksum, generate_check_digit, validate


def build(prefix: str) -> str:
    return prefix + str(generate_check_digit(prefix))


PREFIXES = ["23456789012", "99887766554", "10000000000", "45678901234"]


@pytest.mark.parametrize("prefix", PREFIXES)
def test_generated_numbers_validate(prefix):
    number = build(prefix)
    assert len(number) == 12
    assert validate(number)
    assert checksum(number) == 0


@pytest.mark.parametrize("prefix", PREFIXES)
def test_every_single_digit_error_is_caught(prefix):
    number = build(prefix)
    for position in range(12):
        for replacement in "0123456789":
            if replacement == number[position]:
                continue
            corrupted = number[:position] + replacement + number[position + 1 :]
            assert not validate(corrupted), f"missed single-digit error at {position}"


@pytest.mark.parametrize("prefix", PREFIXES)
def test_every_adjacent_transposition_is_caught(prefix):
    number = build(prefix)
    for position in range(11):
        if number[position] == number[position + 1]:
            continue  # swapping identical digits changes nothing
        swapped = (
            number[:position]
            + number[position + 1]
            + number[position]
            + number[position + 2 :]
        )
        assert not validate(swapped), f"missed transposition at {position}"


def test_obvious_invented_numbers_fail():
    """Sequential and repeated digits, the two shapes a forger reaches for."""
    assert not validate("123456789012")
    assert not validate("111111111111")
    assert not validate("987654321098")


def test_all_zeros_is_rejected():
    """Verhoeff's permutation table means twelve zeros do not sum to zero.

    Worth an explicit test: a plain mod-10 checksum would accept this, and
    000000000000 is exactly the kind of placeholder that reaches a form field.
    """
    assert not validate("000000000000")


def test_structural_validity_is_not_proof_of_issuance():
    """What this check does and does not establish.

    A number can satisfy Verhoeff and never have been issued by UIDAI — the
    checksum is generatable by anyone, as `generate_check_digit` demonstrates.
    That is why the check is reported as STRUCTURAL and can only ever contribute
    to a rejection, never to a clearance. Only the signed QR can establish that a
    card is genuine.
    """
    invented = build("86420864208")
    assert validate(invented)  # well formed, and entirely made up
    assert len(invented) == 12


def test_empty_input_is_not_valid():
    assert not validate("")
    assert not validate("abcd")
