"""Comparing two face embeddings, with an explicit "cannot tell" band.

Document photographs are small, often printed at low resolution, and frequently
years old. Forcing a binary answer out of that produces confident errors, and a
confident error about a person's identity at a border is the worst output this
system could give.

So there are three outcomes, not two:

``>= 0.85``  match
``<= 0.60``  no match
otherwise    inconclusive — a human looks at it

The gap is deliberate and is the point. It is also configurable per document
type through the verification profile, because a chip photograph deserves
tighter thresholds than a photocopy.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Sequence

#: Minimum face size, in pixels, below which no comparison is attempted.
#: Below roughly this size an embedding carries more noise than identity.
MIN_FACE_PIXELS = 80

DEFAULT_MATCH = 0.85
DEFAULT_NO_MATCH = 0.60


@dataclass
class Comparison:
    """The outcome of comparing two embeddings."""

    similarity: float
    outcome: str
    """``match``, `` no_match`` or ``inconclusive``."""

    match_threshold: float = DEFAULT_MATCH
    no_match_threshold: float = DEFAULT_NO_MATCH

    @property
    def is_match(self) -> bool:
        return self.outcome == "match"

    @property
    def is_inconclusive(self) -> bool:
        return self.outcome == "inconclusive"

    def to_dict(self) -> Dict[str, object]:
        return {
            "similarity": round(self.similarity, 4),
            "outcome": self.outcome,
            "match_threshold": self.match_threshold,
            "no_match_threshold": self.no_match_threshold,
        }


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """Cosine similarity between two embeddings, in the range -1 to 1."""
    import numpy as np

    left = np.asarray(a, dtype="float32")
    right = np.asarray(b, dtype="float32")
    if left.size == 0 or right.size == 0 or left.size != right.size:
        raise ValueError(
            f"cannot compare embeddings of size {left.size} and {right.size}"
        )
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    if denominator == 0.0:
        return 0.0
    return float(np.dot(left, right) / denominator)


def compare(
    a: Sequence[float],
    b: Sequence[float],
    *,
    match_threshold: float = DEFAULT_MATCH,
    no_match_threshold: float = DEFAULT_NO_MATCH,
) -> Comparison:
    """Compare two embeddings and place the result in one of the three bands."""
    similarity = cosine_similarity(a, b)
    if similarity >= match_threshold:
        outcome = "match"
    elif similarity <= no_match_threshold:
        outcome = "no_match"
    else:
        outcome = "inconclusive"
    return Comparison(
        similarity=similarity,
        outcome=outcome,
        match_threshold=match_threshold,
        no_match_threshold=no_match_threshold,
    )


def thresholds_from_profile(profile: Optional[Dict[str, object]]) -> Dict[str, float]:
    """Read the face thresholds out of a verification profile."""
    face = ((profile or {}).get("face") or {}) if profile else {}
    return {
        "match_threshold": float(face.get("match_threshold", DEFAULT_MATCH)),
        "no_match_threshold": float(face.get("no_match_threshold", DEFAULT_NO_MATCH)),
    }
