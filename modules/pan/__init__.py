"""PAN structural validation.

The PAN number encodes its own holder category and the first letter of the
holder's surname. A forger who edits the printed name and leaves the number
alone is caught by arithmetic, not by a model.
"""

from modules.common.verifier import registry
from modules.pan.validator import (
    CATEGORIES,
    PAN_PATTERN,
    PanVerifier,
    ParsedPan,
    parse_pan,
    validate_pan,
)

registry.register(PanVerifier())

__all__ = [
    "CATEGORIES",
    "PAN_PATTERN",
    "ParsedPan",
    "PanVerifier",
    "parse_pan",
    "validate_pan",
]
