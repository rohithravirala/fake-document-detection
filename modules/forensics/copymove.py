"""Copy-move detection: content duplicated within the same image.

The characteristic document forgery is not pasting in from elsewhere — it is
copying one part of the same document over another. A clean patch of background
laid over a date, a stamp duplicated, a digit lifted from one field into another.

Feature matching alone is not enough to establish this. A document is full of
legitimately repeated structure: guilloche patterns, repeated glyphs, and large
areas of near-uniform background where descriptors match each other essentially
at random. A detector built on feature matches alone reports copy-move on every
clean card.

So a match cluster is only reported after it survives three filters:

1.  the two regions must be far enough apart to be a deliberate move,
2.  enough matched pairs must share one displacement, indicating a moved
    *block* rather than scattered coincidence, and
3.  **the region must actually be textured, and the two patches must actually
    correlate.** This last one is what removes flat background, and it is checked
    on the pixels directly rather than through descriptors.
"""

from __future__ import annotations

from collections import Counter
from typing import Dict, List, Optional, Tuple

from modules.common.types import BBox
from modules.forensics.signals import Signal

MIN_DISTANCE = 60
"""Pixels. Matches closer than this are local texture, not a moved region."""

MIN_CLUSTER = 60
"""Matched pairs sharing one displacement before a cluster is considered.

Set high on purpose. Documents legitimately repeat text — a card carrying both
"RAHUL KUMAR" and "SURESH KUMAR" contains two pixel-identical copies of the same
word, and no correlation test can distinguish that from a copied region, because
it *is* a copied region. What separates a forgery is scale: a repeated word
yields a few dozen matched pairs, a copied field block yields hundreds."""

MIN_SPAN = 120
"""Pixels. The matched keypoints must span at least this far along one axis.

Note what this is *not*: a measure of the copied block's size. Keypoints land on
the glyphs inside a region, not on its blank parts, so their bounding box is
always much smaller than the area actually moved — measuring the block that way
rejects real findings. Scale is judged by MIN_CLUSTER instead; this only rules
out a cluster collapsed onto a single glyph."""

OFFSET_BUCKET = 10
MAX_DESCRIPTOR_DISTANCE = 24

#: Pixel variance a region must have before a correlation between two copies of
#: it means anything. Flat background correlates with flat background perfectly
#: and tells us nothing.
MIN_PATCH_VARIANCE = 120.0

#: Normalised cross-correlation the two patches must reach. A genuine copy-move
#: is a near-exact duplicate, so this is set close to identical.
MIN_CORRELATION = 0.95


def _verify_patches(
    gray, region: BBox, offset: Tuple[int, int]
) -> Optional[Tuple[float, float]]:
    """Correlate a region against the region it was supposedly copied from.

    Returns ``(correlation, variance)``, or ``None`` when the comparison cannot
    be made or the region is too flat for it to mean anything.
    """
    import numpy as np

    height, width = gray.shape[:2]
    dx, dy = offset

    x1, y1 = max(0, region.x), max(0, region.y)
    x2, y2 = min(width, region.x + region.w), min(height, region.y + region.h)
    if x2 - x1 < 16 or y2 - y1 < 16:
        return None

    sx1, sy1 = x1 + dx, y1 + dy
    sx2, sy2 = x2 + dx, y2 + dy
    if sx1 < 0 or sy1 < 0 or sx2 > width or sy2 > height:
        return None

    a = gray[y1:y2, x1:x2].astype("float32")
    b = gray[sy1:sy2, sx1:sx2].astype("float32")
    if a.shape != b.shape or a.size == 0:
        return None

    variance = float(a.var())
    if variance < MIN_PATCH_VARIANCE:
        return None

    a_centred = a - a.mean()
    b_centred = b - b.mean()
    denominator = float(np.sqrt((a_centred**2).sum() * (b_centred**2).sum()))
    if denominator <= 1e-6:
        return None

    correlation = float((a_centred * b_centred).sum() / denominator)
    return correlation, variance


def analyse(image) -> List[Signal]:
    """Find blocks of content that appear twice in the same image."""
    import cv2
    import numpy as np

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image

    orb = cv2.ORB_create(nfeatures=3000)
    keypoints, descriptors = orb.detectAndCompute(gray, None)
    if descriptors is None or len(keypoints) < 3 * MIN_CLUSTER:
        return []

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = matcher.knnMatch(descriptors, descriptors, k=3)

    offsets: Counter = Counter()
    pairs: Dict[Tuple[int, int], List] = {}

    for group in matches:
        for match in group:
            if match.queryIdx == match.trainIdx:
                continue
            if match.distance > MAX_DESCRIPTOR_DISTANCE:
                continue
            p1 = keypoints[match.queryIdx].pt
            p2 = keypoints[match.trainIdx].pt
            dx, dy = p2[0] - p1[0], p2[1] - p1[1]
            if (dx * dx + dy * dy) ** 0.5 < MIN_DISTANCE:
                continue
            key = (int(round(dx / OFFSET_BUCKET)), int(round(dy / OFFSET_BUCKET)))
            # A displacement and its reverse describe the same finding.
            if key < (-key[0], -key[1]):
                key = (-key[0], -key[1])
                p1, p2 = p2, p1
            offsets[key] += 1
            pairs.setdefault(key, []).append(p1)

    signals: List[Signal] = []
    for key, count in offsets.most_common(6):
        if count < MIN_CLUSTER:
            break

        points = np.array(pairs[key])
        x, y = points[:, 0], points[:, 1]
        region = BBox(
            x=int(x.min()),
            y=int(y.min()),
            w=max(16, int(x.max() - x.min())),
            h=max(16, int(y.max() - y.min())),
        )
        if max(region.w, region.h) < MIN_SPAN:
            continue

        offset = (key[0] * OFFSET_BUCKET, key[1] * OFFSET_BUCKET)
        verified = _verify_patches(gray, region, offset)
        if verified is None:
            continue
        correlation, variance = verified
        if correlation < MIN_CORRELATION:
            continue

        signals.append(
            Signal(
                kind="copy_move",
                # Capped below the HIGH severity band. Copy-move on a text
                # document is suggestive, never decisive, so it must be able to
                # raise a REFER and never to drive a REJECT on its own.
                strength=min(
                    0.78,
                    0.5 + (correlation - MIN_CORRELATION) / (1 - MIN_CORRELATION) * 0.28,
                ),
                note=(
                    f"{count} matching feature pairs share one displacement, and "
                    f"the two regions correlate at {correlation:.3f}. A block of "
                    "this image was copied over another part of it."
                ),
                region=region,
                detail={
                    "matched_pairs": count,
                    "correlation": round(correlation, 4),
                    "patch_variance": round(variance, 1),
                    "offset_x": offset[0],
                    "offset_y": offset[1],
                },
            )
        )
        if len(signals) >= 2:
            break

    return signals
