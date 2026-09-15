"""Aadhaar verification: Secure QR decoding and UIDAI signature verification."""

from modules.aadhaar.secure_qr import AadhaarQrError, AadhaarQrPayload, parse_qr
from modules.aadhaar.verhoeff import generate_check_digit
from modules.aadhaar.verhoeff import validate as verhoeff_validate
from modules.aadhaar.verifier import AadhaarVerifier
from modules.common.verifier import registry

registry.register(AadhaarVerifier())

__all__ = [
    "AadhaarQrError",
    "AadhaarQrPayload",
    "AadhaarVerifier",
    "generate_check_digit",
    "parse_qr",
    "verhoeff_validate",
]
