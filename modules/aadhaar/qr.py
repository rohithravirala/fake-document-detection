"""Finding and decoding the QR on an Aadhaar card image.

An Aadhaar Secure QR is physically large — around version 40, the densest the
standard allows — so it is the hardest kind of QR to read from a phone
photograph. A single failed decode is usually a capture problem, not a forgery,
so several strategies are tried before giving up.

OpenCV's detector is used first because it ships with the image stack we already
depend on. ``pyzbar`` is tried afterwards when it is installed, since it reads
dense symbols more reliably. Neither is required for the rest of the module to
import.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from modules.common.types import BBox

log = logging.getLogger(__name__)


@dataclass
class QrDecode:
    """One decoded QR symbol and where it was found."""

    payload: str
    bbox: Optional[BBox] = None
    decoder: str = ""
    attempt: str = ""


def _pyzbar_available() -> bool:
    try:
        import pyzbar.pyzbar  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def available() -> bool:
    """Whether any QR decoder is usable in this deployment."""
    try:
        import cv2  # noqa: F401
    except Exception:  # noqa: BLE001
        return _pyzbar_available()
    return True


def _variants(image):
    """Progressively more aggressive renderings of the same image.

    Yielded lazily so a card that decodes on the first try costs nothing extra.
    """
    import cv2

    yield "original", image

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    yield "grayscale", gray

    for scale in (2.0, 3.0):
        yield (
            f"upscaled_{scale:g}x",
            cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC),
        )

    yield (
        "clahe",
        cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray),
    )
    yield (
        "otsu",
        cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
    )
    yield (
        "adaptive",
        cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
        ),
    )


def _bbox_from_points(points) -> Optional[BBox]:
    if points is None or len(points) == 0:
        return None
    flat = points.reshape(-1, 2)
    xs, ys = flat[:, 0], flat[:, 1]
    return BBox(
        x=int(xs.min()),
        y=int(ys.min()),
        w=int(xs.max() - xs.min()),
        h=int(ys.max() - ys.min()),
    )


def _decode_with_pyzbar(image, attempt: str) -> List[QrDecode]:
    try:
        from pyzbar import pyzbar
    except Exception:  # noqa: BLE001
        return []

    results: List[QrDecode] = []
    for symbol in pyzbar.decode(image):
        if symbol.type != "QRCODE":
            continue
        rect = symbol.rect
        # Aadhaar payloads are binary; latin-1 round-trips every byte intact.
        results.append(
            QrDecode(
                payload=symbol.data.decode("latin-1", errors="replace"),
                bbox=BBox(x=rect.left, y=rect.top, w=rect.width, h=rect.height),
                decoder="pyzbar",
                attempt=attempt,
            )
        )
    return results


def decode_image(image) -> List[QrDecode]:
    """Decode every QR in an already-loaded image array."""
    try:
        import cv2
    except Exception:  # noqa: BLE001
        return _decode_with_pyzbar(image, "original")

    detector = cv2.QRCodeDetector()

    for attempt, variant in _variants(image):
        found = _decode_with_pyzbar(variant, attempt)
        if found:
            return found

        try:
            ok, payloads, points, _ = detector.detectAndDecodeMulti(variant)
        except cv2.error:
            ok, payloads, points = False, [], None

        if ok and payloads:
            decoded = [
                QrDecode(
                    payload=payload,
                    bbox=_bbox_from_points(points[i]) if points is not None else None,
                    decoder="opencv",
                    attempt=attempt,
                )
                for i, payload in enumerate(payloads)
                if payload
            ]
            if decoded:
                return decoded

        try:
            payload, points, _ = detector.detectAndDecode(variant)
        except cv2.error:
            payload, points = "", None

        if payload:
            return [
                QrDecode(
                    payload=payload,
                    bbox=_bbox_from_points(points),
                    decoder="opencv",
                    attempt=attempt,
                )
            ]

    return []


def decode_file(path: str) -> List[QrDecode]:
    """Load an image from disk and decode every QR in it."""
    try:
        import cv2
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("OpenCV is required to read images from disk") from exc

    image = cv2.imread(path)
    if image is None:
        raise RuntimeError(f"could not read image: {path}")
    return decode_image(image)
