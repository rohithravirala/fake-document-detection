"""Sensor noise residual analysis, measured away from edges.

Every sensor leaves a characteristic noise floor across the frame. A region taken
from a different photograph, or synthesised rather than photographed, carries a
different one.

The measurement only means anything in **flat** areas. Subtracting a denoised
copy from the original leaves noise *and* the edge energy the denoiser could not
preserve, so on a document the residual is dominated by text. Measuring block
variance of that raw residual measures typography, not the sensor, and flags
every line of print on a genuine card.

So edges are masked out first, and a block is measured only where enough flat
pixels remain to give a stable estimate.
"""

from __future__ import annotations

from typing import List

from modules.common.types import BBox
from modules.forensics.signals import Signal

GRID = 10

#: Fraction of the image kept as "flat" for measurement. A fixed gradient
#: threshold does not work here: sensor noise itself produces gradients, so on a
#: noisy capture an absolute cut-off masks the entire image and nothing is
#: measured at all. Keeping the flattest half of the pixels is self-calibrating
#: — it adapts to whatever noise floor this particular capture has.
FLAT_PERCENTILE = 50.0

#: Fraction of a block that must survive the edge mask for it to be measured.
MIN_FLAT_FRACTION = 0.25

#: Robust deviations before a block is reported. Deliberately high. See the
#: calibration note in this package's __init__.
MIN_DEVIATIONS = 9.0


def analyse(image) -> List[Signal]:
    """Report blocks whose noise floor departs from the rest of the page."""
    import cv2
    import numpy as np

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    gray = gray.astype("float32")

    try:
        import pywt

        coefficients = pywt.wavedec2(gray, "db4", level=2)
        threshold = np.median(np.abs(coefficients[-1][0])) / 0.6745 * 1.5
        filtered = [coefficients[0]] + [
            tuple(pywt.threshold(c, threshold, mode="soft") for c in level)
            for level in coefficients[1:]
        ]
        denoised = pywt.waverec2(filtered, "db4")[: gray.shape[0], : gray.shape[1]]
    except Exception:  # noqa: BLE001 - PyWavelets is optional
        denoised = cv2.GaussianBlur(gray, (3, 3), 0)

    residual = gray - denoised

    # Mask out edges: the residual there is typography, not sensor noise.
    gradient = cv2.magnitude(
        cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3),
        cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3),
    )
    threshold = float(np.percentile(gradient, FLAT_PERCENTILE))
    edges = (gradient > threshold).astype("uint8")
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    flat = edges == 0

    height, width = residual.shape
    block_h, block_w = max(16, height // GRID), max(16, width // GRID)

    blocks = []
    for row in range(0, height - block_h + 1, block_h):
        for col in range(0, width - block_w + 1, block_w):
            mask = flat[row : row + block_h, col : col + block_w]
            fraction = float(mask.mean())
            if fraction < MIN_FLAT_FRACTION:
                continue
            values = residual[row : row + block_h, col : col + block_w][mask]
            if values.size < 64:
                continue
            blocks.append((float(values.var()), row, col))

    if len(blocks) < 10:
        return []

    variances = np.array([b[0] for b in blocks])
    median = float(np.median(variances))
    spread = float(np.median(np.abs(variances - median)))
    if spread <= 1e-9 or median <= 1e-9:
        return []

    signals: List[Signal] = []
    for value, row, col in blocks:
        deviation = abs(value - median) / (1.4826 * spread)
        if deviation < MIN_DEVIATIONS:
            continue
        direction = "smoother" if value < median else "noisier"
        signals.append(
            Signal(
                kind="noise_inconsistency",
                strength=min(1.0, (deviation - MIN_DEVIATIONS) / 15.0),
                note=(
                    f"This region is {direction} than the rest of the page. "
                    "Sensor noise is uniform across a single photograph, so a "
                    "region that departs from it may have a different origin."
                ),
                region=BBox(x=col, y=row, w=block_w, h=block_h),
                detail={
                    "flat_variance": round(value, 5),
                    "page_median": round(median, 5),
                    "deviations": round(deviation, 2),
                },
            )
        )

    signals.sort(key=lambda s: s.strength, reverse=True)
    return signals[:3]
