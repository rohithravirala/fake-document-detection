"""Face detection, embedding and comparison. Embeddings only, never images.

The comparison function is re-exported as :func:`compare_embeddings` rather than
``compare``, so that ``from modules.face import compare`` keeps referring to the
submodule and not to a function with the same name.
"""

from modules.common.verifier import registry
from modules.face import compare, embedder
from modules.face.compare import (
    MIN_FACE_PIXELS,
    Comparison,
    cosine_similarity,
)
from modules.face.compare import (
    compare as compare_embeddings,
)
from modules.face.embedder import EMBEDDING_DIMENSIONS, DetectedFace
from modules.face.embedder import available as face_available
from modules.face.verifier import FaceVerifier

registry.register(FaceVerifier())

__all__ = [
    "Comparison",
    "DetectedFace",
    "EMBEDDING_DIMENSIONS",
    "FaceVerifier",
    "MIN_FACE_PIXELS",
    "compare",
    "compare_embeddings",
    "cosine_similarity",
    "embedder",
    "face_available",
]
