"""Verifying the UIDAI signature on a Secure QR.

This is the strongest claim the system makes. If the signature verifies, the
demographic fields and the photograph inside the QR were produced by UIDAI and
have not been altered since — established offline, with no network call and no
API key. Everything printed on the card can then be checked against them.

**No cryptography is implemented here.** Every primitive comes from the
``cryptography`` package. Hand-rolled verification is the fastest way to build
something that looks correct and silently is not.

Certificate provisioning
------------------------
The UIDAI public certificate is published by UIDAI and is not a secret — it is
committed under ``modules/aadhaar/certs/`` so that verification works on an
air-gapped machine. Set ``AADHAAR_CERT_PATH`` to override the location.

When no certificate is present, :func:`verify_signature` returns
:class:`SignatureOutcome` with ``status="unavailable"``. It must never return a
failure, because "we have no certificate" and "this card is forged" are entirely
different statements.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

log = logging.getLogger(__name__)

CERT_DIR = Path(__file__).resolve().parent / "certs"
CERT_SUFFIXES = (".cer", ".pem", ".crt", ".der")

#: UIDAI signs with SHA-256; older payloads in circulation used SHA-1. Both are
#: attempted so a genuine older card is not reported as a forgery, and the digest
#: that actually verified is reported alongside the result.
DIGESTS = ("sha256", "sha1")


@dataclass
class SignatureOutcome:
    """The result of attempting verification, including why it could not run."""

    status: str
    """``valid``, ``invalid`` or ``unavailable``."""

    detail: str
    certificate_subject: str = ""
    certificate_path: str = ""
    digest: str = ""
    not_valid_after: str = ""

    @property
    def is_valid(self) -> bool:
        return self.status == "valid"

    @property
    def could_not_run(self) -> bool:
        return self.status == "unavailable"


def certificate_paths() -> List[Path]:
    """Every candidate certificate, environment override first."""
    paths: List[Path] = []
    override = os.getenv("AADHAAR_CERT_PATH", "").strip()
    if override:
        paths.append(Path(override))
    if CERT_DIR.is_dir():
        paths.extend(
            sorted(p for p in CERT_DIR.iterdir() if p.suffix.lower() in CERT_SUFFIXES)
        )
    return [p for p in paths if p.is_file()]


def _load_certificate(path: Path):
    from cryptography import x509

    data = path.read_bytes()
    try:
        return x509.load_pem_x509_certificate(data)
    except ValueError:
        return x509.load_der_x509_certificate(data)


def available() -> bool:
    """Whether at least one usable certificate is provisioned."""
    return bool(certificate_paths())


def verify_signature(signed_data: bytes, signature: bytes) -> SignatureOutcome:
    """Verify a Secure QR signature against every provisioned certificate.

    Returns ``valid`` on the first certificate and digest that verifies. Only
    when a certificate was actually available and none verified is the result
    ``invalid``.
    """
    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding, rsa
    except ImportError:  # pragma: no cover - cryptography is a core dependency
        return SignatureOutcome(
            status="unavailable",
            detail="the 'cryptography' package is not installed",
        )

    paths = certificate_paths()
    if not paths:
        return SignatureOutcome(
            status="unavailable",
            detail=(
                "no UIDAI certificate is provisioned. Place the UIDAI public "
                f"certificate in {CERT_DIR} or set AADHAAR_CERT_PATH"
            ),
        )

    algorithms = {"sha256": hashes.SHA256(), "sha1": hashes.SHA1()}
    tried: List[str] = []

    for path in paths:
        try:
            certificate = _load_certificate(path)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not load certificate %s: %s", path, exc)
            tried.append(f"{path.name} (unreadable)")
            continue

        public_key = certificate.public_key()
        if not isinstance(public_key, rsa.RSAPublicKey):
            tried.append(f"{path.name} (not an RSA certificate)")
            continue

        subject = certificate.subject.rfc4514_string()
        expiry = ""
        try:
            expiry = certificate.not_valid_after_utc.isoformat()
        except AttributeError:  # cryptography < 42
            expiry = certificate.not_valid_after.isoformat()

        for digest_name in DIGESTS:
            try:
                public_key.verify(
                    signature,
                    signed_data,
                    padding.PKCS1v15(),
                    algorithms[digest_name],
                )
            except Exception:  # noqa: BLE001 - any failure means "did not verify"
                continue
            return SignatureOutcome(
                status="valid",
                detail=(
                    f"signature verified against {path.name} using "
                    f"RSA PKCS#1 v1.5 with {digest_name.upper()}"
                ),
                certificate_subject=subject,
                certificate_path=str(path),
                digest=digest_name,
                not_valid_after=expiry,
            )
        tried.append(path.name)

    return SignatureOutcome(
        status="invalid",
        detail=(
            "the signature did not verify against any provisioned certificate "
            f"({', '.join(tried)})"
        ),
        certificate_path=", ".join(str(p) for p in paths),
    )
