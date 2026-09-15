"""Passport and visa verification through the machine readable zone."""

from modules.common.verifier import registry
from modules.passport.checkdigit import char_value, check_digit, verify_check_digit
from modules.passport.mrz import MrzFormatError, ParsedMrz, parse_mrz
from modules.passport.verifier import PassportVerifier

registry.register(PassportVerifier())

__all__ = [
    "MrzFormatError",
    "ParsedMrz",
    "PassportVerifier",
    "char_value",
    "check_digit",
    "parse_mrz",
    "verify_check_digit",
]
