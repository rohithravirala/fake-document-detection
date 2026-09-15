"""Error Level Analysis, normalised against local detail.

A JPEG saved once has a uniform compression history. A region pasted in from
another image and saved again has been through a different number of cycles, and
recompressing the result exposes the difference.

The naive form of this test does not work on documents, and it is worth being
precise about why. Recompression error scales with local detail: a block of text
always produces a large error and a blank margin always produces almost none. A
detector that compares raw error against the page median therefore flags every
line of text on a perfectly genuine card.

So the error is divided by the local gradient energy before comparison. What is
compared is *error per unit of detail*, which is roughly constant across a
single-origin image regardless of content. Blocks with too little detail to
measure are skipped rather than guessed at.
"""

from __future__ import annotations

import io
from typing import List, Tuple

from modules.common.types import BBox
from modules.forensics.signals import Signal

QUALITY = 90
GRID = 14

#: Blocks flatter than this carry no recoverable compression history. A blank
#: margin is not evidence of anything.
MIN_TEXTURE = 6.0

#: Robust deviations above the page norm before a block is reported.
#:
#: Set from measurement, not from taste: across clean synthetic captures the
#: highest deviation observed is under 2, so 6 leaves a wide margin and keeps the
#: detector silent on genuine documents. It needs re-calibration against the real
#: sample set before any accuracy claim is made — see evaluation/.
MIN_DEVIATIONS = 6.0


def _block_stats(image, quality: int) -> Tuple[List[Tuple[float, int, int]], int, int]:
    """Error-per-detail ratio for each sufficiently textured block."""
    import cv2
    import numpy as np
    from PIL import Image

    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    pil = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    buffer = io.BytesIO()
    pil.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    recompressed = cv2.cvtColor(np.array(Image.open(buffer)), cv2.COLOR_RGB2BGR)

    error = cv2.absdiff(image, recompressed).astype("float32").max(axis=2)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype("float32")
    gradient = cv2.magnitude(
        cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3),
        cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3),
    )

    height, width = error.shape
    block_h, block_w = max(8, height // GRID), max(8, width // GRID)

    blocks: List[Tuple[float, int, int]] = []
    for row in range(0, height - block_h + 1, block_h):
        for col in range(0, width - block_w + 1, block_w):
            texture = float(gradient[row : row + block_h, col : col + block_w].mean())
            if texture < MIN_TEXTURE:
                continue
            block_error = float(error[row : row + block_h, col : col + block_w].mean())
            blocks.append((block_error / texture, row, col))

    return blocks, block_h, block_w


def analyse(image, quality: int = QUALITY) -> List[Signal]:
    """Report blocks whose compression history departs from the page."""
    import numpy as np

    blocks, block_h, block_w = _block_stats(image, quality)
    if len(blocks) < 12:
        # Too little textured content to establish what normal looks like here.
        return []

    values = np.array([b[0] for b in blocks])
    median = float(np.median(values))
    spread = float(np.median(np.abs(values - median)))
    if spread <= 1e-6:
        return []

    signals: List[Signal] = []
    for value, row, col in blocks:
        deviation = (value - median) / (1.4826 * spread)
        if deviation < MIN_DEVIATIONS:
            continue
        signals.append(
            Signal(
                kind="compression_anomaly",
                strength=min(1.0, (deviation - MIN_DEVIATIONS) / 12.0),
                note=(
                    "This region's compression history differs from the rest of "
                    "the page, which happens when content is pasted in and the "
                    "image is saved again."
                ),
                region=BBox(x=col, y=row, w=block_w, h=block_h),
                detail={
                    "error_per_detail": round(value, 4),
                    "page_median": round(median, 4),
                    "deviations": round(deviation, 2),
                },
            )
        )

    signals.sort(key=lambda s: s.strength, reverse=True)
    return signals[:3]
