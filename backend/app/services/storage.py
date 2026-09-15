"""Where uploaded images go, and how they are identified.

Files are stored under a content hash rather than their original name. Two
reasons: an uploaded filename is attacker-controlled and must never reach the
filesystem verbatim, and hashing means the same image submitted twice occupies
one file while still producing two independent screenings.

The hash is also what the audit chain commits to, so a record proves which bytes
were screened.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from backend.app.config import get_settings

#: Extensions accepted for upload. Anything else is refused before it is written.
ALLOWED_SUFFIXES = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".pdf"}
)


class UnsupportedFile(ValueError):
    """The upload is not a file type this system reads."""


@dataclass
class StoredFile:
    """A file on disk, addressed by the hash of its contents."""

    path: Path
    sha256: str
    size: int
    original_name: str

    @property
    def suffix(self) -> str:
        return self.path.suffix


def _safe_suffix(filename: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise UnsupportedFile(
            f"'{suffix or filename}' is not a supported document file. "
            f"Accepted: {', '.join(sorted(ALLOWED_SUFFIXES))}"
        )
    return suffix


def save_bytes(data: bytes, filename: str) -> StoredFile:
    """Write bytes to the upload directory under their content hash."""
    settings = get_settings()
    if len(data) > settings.max_upload_bytes:
        raise UnsupportedFile(
            f"file is {len(data) / 1e6:.1f} MB, over the "
            f"{settings.max_upload_bytes / 1e6:.0f} MB limit"
        )
    if not data:
        raise UnsupportedFile("file is empty")

    suffix = _safe_suffix(filename)
    digest = hashlib.sha256(data).hexdigest()

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    # Shard by the first two hex characters so one directory does not grow
    # unbounded over a long deployment.
    target_dir = settings.upload_dir / digest[:2]
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{digest}{suffix}"

    if not target.exists():
        target.write_bytes(data)

    return StoredFile(
        path=target, sha256=digest, size=len(data), original_name=filename or target.name
    )


def save_stream(stream: BinaryIO, filename: str) -> StoredFile:
    """Read a stream fully and store it. Used by the upload endpoint."""
    return save_bytes(stream.read(), filename)
