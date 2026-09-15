"""Building synthetic Secure QR payloads, for tests and the evaluation set.

Real Aadhaar QR codes cannot be committed to this repository, and the UIDAI
signing key is obviously not available. So the cryptographic path is exercised
the only honest way: generate a throwaway RSA key, sign a payload assembled in
exactly the real byte layout, and verify it through the same
:mod:`modules.aadhaar.signature` code that runs in production.

That proves the parser, the byte offsets, the decompression and the verification
call are all correct. Swapping in the real UIDAI certificate changes nothing but
the key. It is **not** a claim that we have verified a real Aadhaar card.

Nothing in this module is imported by the request path.
"""

from __future__ import annotations

import datetime as dt
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

from modules.aadhaar.secure_qr import DELIMITER, FIELD_ORDER

DEFAULT_FIELDS: Dict[str, str] = {
    "email_mobile_indicator": "0",
    "reference_id": "9012" + "20240115103000000",
    "name": "ANITA SHARMA",
    "dob": "12-05-1990",
    "gender": "F",
    "care_of": "S/O RAMESH SHARMA",
    "district": "HYDERABAD",
    "landmark": "NEAR CITY PARK",
    "house": "12-3-45",
    "location": "GACHIBOWLI",
    "pincode": "500032",
    "post_office": "GACHIBOWLI",
    "state": "TELANGANA",
    "street": "ROAD NO 5",
    "sub_district": "SERILINGAMPALLY",
    "vtc": "HYDERABAD",
}


@dataclass
class SyntheticQr:
    """A generated QR payload and the certificate that will verify it."""

    payload_bytes: bytes
    payload_text: str
    """The big-integer text form, which is what a real QR encodes."""

    certificate_pem: bytes
    fields: Dict[str, str]


def build_payload(
    fields: Optional[Dict[str, str]] = None, photo: bytes = b"\x00" * 128
) -> bytes:
    """Assemble the uncompressed, unsigned Secure QR body."""
    values = dict(DEFAULT_FIELDS)
    if fields:
        values.update(fields)
    chunks = [values.get(name, "").encode("utf-8") for name in FIELD_ORDER]
    body = bytes([DELIMITER]).join(chunks)
    return body + bytes([DELIMITER]) + photo


def generate(
    fields: Optional[Dict[str, str]] = None,
    photo: bytes = b"\x00" * 128,
    *,
    corrupt: bool = False,
) -> SyntheticQr:
    """Generate a signed synthetic Secure QR.

    ``corrupt=True`` alters one demographic byte *after* signing, which is
    precisely what a forger who edits a card cannot do without the UIDAI key —
    the fixture the signature test needs in order to mean anything.
    """
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SVARAM TEST AUTHORITY"),
            x509.NameAttribute(
                NameOID.COMMON_NAME, "SVARAM Synthetic Aadhaar Signing (TEST ONLY)"
            ),
        ]
    )
    now = dt.datetime.now(dt.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(days=1))
        .not_valid_after(now + dt.timedelta(days=3650))
        .sign(key, hashes.SHA256())
    )

    body = build_payload(fields, photo)
    signature = key.sign(body, padding.PKCS1v15(), hashes.SHA256())

    if corrupt:
        # Flip a byte inside the signed name field, simulating an edited card.
        mutable = bytearray(body)
        first_delim = mutable.index(DELIMITER)
        second_delim = mutable.index(DELIMITER, first_delim + 1)
        mutable[second_delim + 1] = ord("X")
        body = bytes(mutable)

    payload = zlib.compress(body + signature)
    # Real QR codes carry this as one very long decimal integer.
    payload_text = str(int.from_bytes(payload, "big"))

    values = dict(DEFAULT_FIELDS)
    if fields:
        values.update(fields)

    return SyntheticQr(
        payload_bytes=payload,
        payload_text=payload_text,
        certificate_pem=certificate.public_bytes(serialization.Encoding.PEM),
        fields=values,
    )


def write_certificate(
    target_dir: Path, pem: bytes, name: str = "test-signer.pem"
) -> Path:
    """Write a generated certificate where :mod:`signature` will find it."""
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / name
    path.write_bytes(pem)
    return path
