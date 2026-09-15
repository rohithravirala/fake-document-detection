"""What the file says about its own history.

Editing software leaves traces. This is the cheapest check in the whole system
and occasionally the most decisive: a scanned identity document whose metadata
names an image editor did not come straight from a scanner.

Absence of metadata proves nothing — messaging apps and most upload paths strip
EXIF entirely — so a clean file produces no signal rather than a reassurance.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List

from modules.forensics.signals import Signal

#: Software names that indicate an image was opened in an editor.
EDITORS = re.compile(
    r"photoshop|gimp|paint\.net|pixelmator|affinity|canva|illustrator|"
    r"lightroom|snapseed|picsart|inkscape|coreldraw|figma",
    re.IGNORECASE,
)

#: Producers consistent with a document that was scanned or generated, not edited.
BENIGN = re.compile(r"scanner|scansnap|epson|canon|hp |brother|camera", re.IGNORECASE)


def analyse(path: str) -> List[Signal]:
    """Inspect image or PDF metadata for evidence of editing."""
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return _analyse_pdf(path)
    return _analyse_image(path)


def _analyse_image(path: str) -> List[Signal]:
    try:
        from PIL import ExifTags, Image
    except Exception:  # noqa: BLE001
        return []

    try:
        with Image.open(path) as image:
            exif = image.getexif()
    except Exception:  # noqa: BLE001
        return []

    if not exif:
        return []

    tags = {ExifTags.TAGS.get(k, str(k)): v for k, v in exif.items()}
    software = str(tags.get("Software", "") or "")

    signals: List[Signal] = []
    if software and EDITORS.search(software) and not BENIGN.search(software):
        signals.append(
            Signal(
                kind="metadata_editor",
                strength=0.7,
                note=(
                    f"The file's metadata records that it was saved by "
                    f"'{software.strip()}', an image editor. A document captured "
                    "directly from a scanner or camera does not carry this."
                ),
                detail={"software": software.strip()},
            )
        )

    original = str(tags.get("DateTimeOriginal", "") or "")
    modified = str(tags.get("DateTime", "") or "")
    if original and modified and original != modified:
        signals.append(
            Signal(
                kind="metadata_modified",
                strength=0.35,
                note=(
                    f"The file was captured at {original} and last written at "
                    f"{modified}. A gap is common and not in itself suspicious, "
                    "but it is recorded here."
                ),
                detail={"captured": original, "modified": modified},
            )
        )

    return signals


def _analyse_pdf(path: str) -> List[Signal]:
    try:
        import pikepdf
    except Exception:  # noqa: BLE001
        return []

    try:
        with pikepdf.open(path) as pdf:
            info = {str(k): str(v) for k, v in (pdf.docinfo or {}).items()}
            revisions = len(getattr(pdf, "versions", []) or [])
    except Exception:  # noqa: BLE001
        return []

    signals: List[Signal] = []
    producer = f"{info.get('/Producer', '')} {info.get('/Creator', '')}".strip()
    if producer and EDITORS.search(producer):
        signals.append(
            Signal(
                kind="metadata_editor",
                strength=0.7,
                note=(
                    f"The PDF records '{producer}' as its producer, which is an "
                    "editing application rather than a scanner or an issuing "
                    "system."
                ),
                detail={"producer": producer},
            )
        )

    if revisions > 1:
        signals.append(
            Signal(
                kind="pdf_incremental_update",
                strength=0.5,
                note=(
                    f"The PDF contains {revisions} saved revisions. The document "
                    "was modified after it was first written."
                ),
                detail={"revisions": revisions},
            )
        )

    return signals
