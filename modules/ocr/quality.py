"""The capture quality gate.

This is the least glamorous part of the system and the one that removes the most
false positives. Analysing a blurred photograph and returning a confident answer
is worse than asking the officer to take another picture: the officer acts on the
wrong answer, and nothing in the record shows that the input was unusable.

So quality is assessed **before** any analysis, and a document below threshold is
returned as RETAKE rather than being pushed through the pipeline anyway.

Three measurements, all cheap:

``sharpness``
    Variance of the Laplacian. Low variance means few edges, which on a document
    full of text means it is out of focus.

``resolution``
    Short edge in pixels, used as a proxy for effective DPI. Text below roughly
    1000 pixels on the short edge will not OCR reliably at card size.

``exposure``
    Proportion of pixels clipped to pure black or pure white. High values mean
    glare or deep shadow, and the clipped regions carry no recoverable text.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

#: Defaults, overridable per document type through the verification profile.
DEFAULT_THRESHOLDS: Dict[str, float] = {
    "min_sharpness": 60.0,
    "min_short_edge": 600.0,
    "max_clipped_ratio": 0.25,
}


@dataclass
class QualityReport:
    """What the gate measured, and whether the image may be analysed."""

    sharpness: float
    short_edge: int
    long_edge: int
    clipped_ratio: float
    acceptable: bool
    failures: List[str] = field(default_factory=list)
    thresholds: Dict[str, float] = field(default_factory=dict)

    @property
    def summary(self) -> str:
        if self.acceptable:
            return (
                f"sharpness {self.sharpness:.0f}, {self.long_edge}x{self.short_edge} px"
            )
        return "; ".join(self.failures)

    def to_dict(self) -> Dict[str, object]:
        return {
            "sharpness": round(self.sharpness, 2),
            "short_edge": self.short_edge,
            "long_edge": self.long_edge,
            "clipped_ratio": round(self.clipped_ratio, 4),
            "acceptable": self.acceptable,
            "failures": list(self.failures),
            "thresholds": dict(self.thresholds),
        }


def assess(image, thresholds: Optional[Dict[str, float]] = None) -> QualityReport:
    """Measure capture quality of a loaded image array."""
    import cv2
    import numpy as np

    limits = dict(DEFAULT_THRESHOLDS)
    if thresholds:
        limits.update({k: float(v) for k, v in thresholds.items() if v is not None})

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    height, width = gray.shape[:2]
    short_edge, long_edge = min(height, width), max(height, width)

    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    clipped = float(np.mean((gray <= 4) | (gray >= 251)))

    failures: List[str] = []
    if sharpness < limits["min_sharpness"]:
        failures.append(
            f"image is out of focus (sharpness {sharpness:.0f}, "
            f"minimum {limits['min_sharpness']:.0f})"
        )
    if short_edge < limits["min_short_edge"]:
        failures.append(
            f"resolution is too low ({long_edge}x{short_edge} px, minimum "
            f"{limits['min_short_edge']:.0f} px on the short edge)"
        )
    if clipped > limits["max_clipped_ratio"]:
        failures.append(
            f"{clipped * 100:.0f}% of the image is blown out or in shadow "
            f"(maximum {limits['max_clipped_ratio'] * 100:.0f}%)"
        )

    return QualityReport(
        sharpness=sharpness,
        short_edge=short_edge,
        long_edge=long_edge,
        clipped_ratio=clipped,
        acceptable=not failures,
        failures=failures,
        thresholds=limits,
    )
