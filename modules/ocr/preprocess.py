"""Getting a photographed document into a state OCR can read.

Order matters. Perspective is corrected first, because deskewing a
keystoned image measures the wrong angle. Denoising comes after geometry so it
is not asked to preserve edges it will then have to resample.

Every step is a no-op when it would make things worse — a perspective transform
is only applied when a convincing quadrilateral is found, and deskew is skipped
when the estimated angle is implausible. Silently mangling a good image is worse
than leaving it alone.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class PreprocessResult:
    """The processed image and a record of what was actually applied."""

    image: object
    steps: List[str] = field(default_factory=list)
    scale: float = 1.0
    """Cumulative scale from the original, so bounding boxes can be mapped back."""


def load(path: str):
    """Read an image from disk as a BGR array."""
    import cv2

    image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"could not read image: {path}")
    return image


def _order_corners(points):
    """Order four points as top-left, top-right, bottom-right, bottom-left."""
    import numpy as np

    pts = points.reshape(4, 2).astype("float32")
    ordered = np.zeros((4, 2), dtype="float32")
    total = pts.sum(axis=1)
    ordered[0] = pts[np.argmin(total)]
    ordered[2] = pts[np.argmax(total)]
    diff = np.diff(pts, axis=1)
    ordered[1] = pts[np.argmin(diff)]
    ordered[3] = pts[np.argmax(diff)]
    return ordered


def correct_perspective(image) -> Tuple[object, bool]:
    """Flatten the document if a convincing four-sided outline is found."""
    import cv2
    import numpy as np

    height, width = image.shape[:2]
    page_area = float(height * width)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 60, 180)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image, False

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:6]:
        area = cv2.contourArea(contour)
        # Ignore outlines that are nearly the whole frame (the frame itself) or
        # too small to be the document.
        if area < page_area * 0.25 or area > page_area * 0.98:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue

        corners = _order_corners(approx)
        (tl, tr, br, bl) = corners
        target_w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        target_h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        if target_w < 100 or target_h < 100:
            continue

        destination = np.array(
            [[0, 0], [target_w - 1, 0], [target_w - 1, target_h - 1], [0, target_h - 1]],
            dtype="float32",
        )
        matrix = cv2.getPerspectiveTransform(corners, destination)
        return cv2.warpPerspective(image, matrix, (target_w, target_h)), True

    return image, False


def deskew(image, max_angle: float = 15.0) -> Tuple[object, float]:
    """Rotate the image so text lines are horizontal.

    The angle is estimated from the minimum-area rectangle around the dark pixels.
    Rotations beyond ``max_angle`` are rejected: at that point the estimate is
    more likely to be wrong than the page is to be that crooked.
    """
    import cv2
    import numpy as np

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    inverted = cv2.bitwise_not(gray)
    threshold = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    coords = np.column_stack(np.where(threshold > 0))
    if coords.shape[0] < 50:
        return image, 0.0

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    if abs(angle) < 0.3 or abs(angle) > max_angle:
        return image, 0.0

    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated, float(angle)


def denoise(image):
    """Remove sensor noise while preserving the edges OCR needs."""
    import cv2

    if image.ndim == 3:
        return cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)
    return cv2.fastNlMeansDenoising(image, None, 5, 7, 21)


def reduce_glare(image):
    """Even out illumination so a bright patch does not swallow the text under it.

    CLAHE on the lightness channel only, so colour is untouched — the photograph
    and the security print stay comparable for the forensics module downstream.
    """
    import cv2

    if image.ndim != 3:
        return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(image)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, a_channel, b_channel = cv2.split(lab)
    equalised = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lightness)
    return cv2.cvtColor(cv2.merge((equalised, a_channel, b_channel)), cv2.COLOR_LAB2BGR)


def upscale_for_ocr(image, min_short_edge: int = 1000) -> Tuple[object, float]:
    """Enlarge small captures, since OCR degrades sharply below card resolution."""
    import cv2

    height, width = image.shape[:2]
    short_edge = min(height, width)
    if short_edge >= min_short_edge:
        return image, 1.0
    scale = min_short_edge / float(short_edge)
    return (
        cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC),
        scale,
    )


def run(
    image,
    *,
    perspective: bool = True,
    straighten: bool = True,
    remove_noise: bool = True,
    glare: bool = True,
    upscale: bool = True,
) -> PreprocessResult:
    """Run the full pipeline, recording which steps actually changed the image."""
    result = PreprocessResult(image=image)

    if perspective:
        result.image, applied = correct_perspective(result.image)
        if applied:
            result.steps.append("perspective_correction")

    if straighten:
        result.image, angle = deskew(result.image)
        if angle:
            result.steps.append(f"deskew({angle:+.1f}deg)")

    if remove_noise:
        result.image = denoise(result.image)
        result.steps.append("denoise")

    if glare:
        result.image = reduce_glare(result.image)
        result.steps.append("glare_reduction")

    if upscale:
        result.image, scale = upscale_for_ocr(result.image)
        if scale != 1.0:
            result.scale *= scale
            result.steps.append(f"upscale({scale:.2f}x)")

    return result
