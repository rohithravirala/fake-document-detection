"""Parsing the Aadhaar QR payload.

Two generations of QR exist on cards in circulation, and they are not equally
useful:

**Secure QR (2019 onward)** — a gzip-compressed byte string ending in a 256 byte
RSA signature produced by UIDAI. The demographic fields and the photograph inside
it are *signed*, which makes them a source of truth we can check the printed card
against. This is the one the whole project rests on.

**Legacy XML QR** — an unsigned XML fragment. It restates the printed fields and
nothing more. A forger can regenerate it in seconds. We parse it, we use it for a
consistency check, and we say plainly that it proves nothing on its own. Treating
it as authoritative would be the single worst mistake this system could make.

Layout of the Secure QR payload, after gzip decompression::

    <bit> FF <referenceid> FF <name> FF <dob> FF <gender> FF <careof> FF
    <district> FF <landmark> FF <house> FF <location> FF <pincode> FF
    <postoffice> FF <state> FF <street> FF <subdistrict> FF <vtc> FF
    <photo bytes> [<email sha256>] [<mobile sha256>] <signature: 256 bytes>

The leading indicator says which of the email and mobile hashes are present,
which is how the photograph's end is located.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
import zlib
from dataclasses import dataclass, field
from typing import Dict, Optional
from xml.etree import ElementTree

DELIMITER = 0xFF
SIGNATURE_BYTES = 256
HASH_BYTES = 32

#: Field order inside the Secure QR, as published by UIDAI.
FIELD_ORDER = (
    "email_mobile_indicator",
    "reference_id",
    "name",
    "dob",
    "gender",
    "care_of",
    "district",
    "landmark",
    "house",
    "location",
    "pincode",
    "post_office",
    "state",
    "street",
    "sub_district",
    "vtc",
)

#: How many trailing hash blocks each indicator value implies.
_HASHES_PRESENT = {"0": 0, "1": 1, "2": 1, "3": 2}


class AadhaarQrError(ValueError):
    """The payload is not a recognisable Aadhaar QR."""


@dataclass
class AadhaarQrPayload:
    """What an Aadhaar QR states, and whether any of it is signed."""

    variant: str
    """``secure`` or ``legacy_xml``."""

    fields: Dict[str, str] = field(default_factory=dict)
    signed_data: Optional[bytes] = None
    """The exact bytes the signature covers. ``None`` for legacy XML."""

    signature: Optional[bytes] = None
    photo: Optional[bytes] = None
    email_hash: Optional[bytes] = None
    mobile_hash: Optional[bytes] = None
    raw_length: int = 0

    @property
    def is_signed(self) -> bool:
        """Whether this payload can be cryptographically verified at all."""
        return self.signed_data is not None and self.signature is not None

    @property
    def aadhaar_last4(self) -> str:
        """The last four digits of the Aadhaar number, from the reference id."""
        ref = self.fields.get("reference_id", "")
        return ref[:4] if len(ref) >= 4 else ""

    @property
    def issued_at(self) -> str:
        """The timestamp embedded in the reference id, as printed."""
        ref = self.fields.get("reference_id", "")
        return ref[4:] if len(ref) > 4 else ""

    def to_dict(self) -> Dict[str, object]:
        return {
            "variant": self.variant,
            "is_signed": self.is_signed,
            "fields": dict(self.fields),
            "aadhaar_last4": self.aadhaar_last4,
            "issued_at": self.issued_at,
            "has_photo": self.photo is not None and len(self.photo) > 0,
            "photo_bytes": len(self.photo or b""),
            "raw_length": self.raw_length,
        }

    def verify_mobile(self, mobile: str) -> Optional[bool]:
        """Check a mobile number against the hash UIDAI signed, if present.

        UIDAI hashes the number repeatedly, once per trailing digit of the
        Aadhaar number, which is why ``aadhaar_last4`` is needed here.
        """
        if not self.mobile_hash or not mobile or not self.aadhaar_last4:
            return None
        return _uidai_contact_hash(mobile, self.aadhaar_last4[-1]) == self.mobile_hash


def _uidai_contact_hash(value: str, last_digit: str) -> bytes:
    """UIDAI's repeated-SHA256 construction for the email and mobile hashes."""
    rounds = int(last_digit) if last_digit.isdigit() and int(last_digit) > 0 else 1
    digest = value.encode("utf-8")
    for _ in range(rounds):
        digest = hashlib.sha256(digest).hexdigest().encode("utf-8")
    return binascii.unhexlify(digest[:64]) if len(digest) >= 64 else digest


# ---------------------------------------------------------------------------
#  Getting from QR text to bytes
# ---------------------------------------------------------------------------


def to_bytes(raw: object) -> bytes:
    """Coerce whatever the QR decoder produced into the payload bytes.

    Decoders return a big decimal integer as text, raw bytes, or base64 depending
    on the library and the card. All three are handled here so the parser below
    only ever sees bytes.
    """
    if isinstance(raw, (bytes, bytearray)):
        data = bytes(raw)
        text = data.decode("ascii", errors="ignore").strip()
    else:
        text = str(raw or "").strip()
        data = text.encode("latin-1", errors="ignore")

    if not text and not data:
        raise AadhaarQrError("QR payload is empty")

    # Secure QR is normally carried as one very long decimal integer.
    digits = text.strip()
    if digits.isdigit() and len(digits) > 64:
        value = int(digits)
        length = (value.bit_length() + 7) // 8
        return value.to_bytes(length, "big")

    if text.lstrip().startswith("<?xml") or text.lstrip().startswith("<Print"):
        return text.encode("utf-8")

    # Some exports base64 the compressed bytes.
    if re.fullmatch(r"[A-Za-z0-9+/=\s]{64,}", text or ""):
        try:
            return base64.b64decode(text, validate=True)
        except (binascii.Error, ValueError):
            pass

    return data


def _decompress(data: bytes) -> bytes:
    """Undo the gzip/zlib layer, tolerating either framing.

    Returns the input unchanged when it is not compressed, so an already-expanded
    payload still parses.
    """
    for wbits in (31, 47, -15, 15):
        try:
            return zlib.decompress(data, wbits)
        except zlib.error:
            continue
    return data


# ---------------------------------------------------------------------------
#  Parsers
# ---------------------------------------------------------------------------


def parse_legacy_xml(text: str) -> AadhaarQrPayload:
    """Parse the pre-2019 unsigned XML QR."""
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as exc:
        raise AadhaarQrError(f"XML QR is malformed: {exc}") from exc

    attrib = {k.lower(): (v or "").strip() for k, v in root.attrib.items()}
    mapping = {
        "name": attrib.get("name", ""),
        "gender": attrib.get("gender", ""),
        "dob": attrib.get("dob", "") or attrib.get("yob", ""),
        "care_of": attrib.get("co", ""),
        "house": attrib.get("house", ""),
        "street": attrib.get("street", ""),
        "landmark": attrib.get("lm", ""),
        "location": attrib.get("loc", ""),
        "vtc": attrib.get("vtc", ""),
        "post_office": attrib.get("po", ""),
        "district": attrib.get("dist", ""),
        "sub_district": attrib.get("subdist", ""),
        "state": attrib.get("state", ""),
        "pincode": attrib.get("pc", ""),
        "uid": attrib.get("uid", ""),
    }
    return AadhaarQrPayload(
        variant="legacy_xml",
        fields={k: v for k, v in mapping.items() if v},
        raw_length=len(text),
    )


def parse_secure_qr(data: bytes) -> AadhaarQrPayload:
    """Parse the signed Secure QR byte payload."""
    if len(data) <= SIGNATURE_BYTES:
        raise AadhaarQrError(
            f"payload is {len(data)} bytes, too short to contain a "
            f"{SIGNATURE_BYTES} byte signature"
        )

    signed_data = data[:-SIGNATURE_BYTES]
    signature = data[-SIGNATURE_BYTES:]

    parts = signed_data.split(bytes([DELIMITER]), len(FIELD_ORDER))
    if len(parts) < len(FIELD_ORDER):
        raise AadhaarQrError(
            f"payload has {len(parts)} delimited sections, expected at least "
            f"{len(FIELD_ORDER)}"
        )

    values: Dict[str, str] = {}
    for name, chunk in zip(FIELD_ORDER, parts):
        values[name] = chunk.decode("utf-8", errors="replace").strip()

    remainder = parts[len(FIELD_ORDER)] if len(parts) > len(FIELD_ORDER) else b""

    indicator = values.get("email_mobile_indicator", "0").strip() or "0"
    hash_count = _HASHES_PRESENT.get(indicator, 0)
    trailing = hash_count * HASH_BYTES

    photo = remainder[: len(remainder) - trailing] if trailing else remainder
    email_hash: Optional[bytes] = None
    mobile_hash: Optional[bytes] = None
    if hash_count == 2:
        email_hash = remainder[-2 * HASH_BYTES : -HASH_BYTES]
        mobile_hash = remainder[-HASH_BYTES:]
    elif hash_count == 1:
        block = remainder[-HASH_BYTES:]
        if indicator == "1":
            email_hash = block
        else:
            mobile_hash = block

    return AadhaarQrPayload(
        variant="secure",
        fields={k: v for k, v in values.items() if v},
        signed_data=signed_data,
        signature=signature,
        photo=photo or None,
        email_hash=email_hash,
        mobile_hash=mobile_hash,
        raw_length=len(data),
    )


def parse_qr(raw: object) -> AadhaarQrPayload:
    """Parse any Aadhaar QR payload, picking the right variant automatically."""
    data = to_bytes(raw)
    head = data[:64].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<Print"):
        return parse_legacy_xml(data.decode("utf-8", errors="replace"))

    expanded = _decompress(data)
    if expanded[:64].lstrip().startswith(b"<?xml"):
        return parse_legacy_xml(expanded.decode("utf-8", errors="replace"))

    return parse_secure_qr(expanded)
