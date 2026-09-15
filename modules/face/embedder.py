"""Turning a face into a 512-dimensional embedding, locally.

Privacy design, stated here because it is a design decision and not an
implementation detail:

* The model runs **on this machine**. No cloud face API is called, ever.
* What is stored is the **embedding**, never the photograph. An embedding is not
  reversible into a usable image.
* Nothing biometric leaves the deployment boundary.

InsightFace is an optional dependency. Where it is absent this module reports
itself unavailable and the face checks are skipped — they are never faked, and
their absence pushes a case to REFER rather than quietly clearing it.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List, Optional

from modules.common.errors import ModuleUnavailable
from modules.common.types import BBox
from modules.face.compare import MIN_FACE_PIXELS

log = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 512
_MODEL = None


@dataclass
class DetectedFace:
    """One detected face: where it is, how big, and its embedding."""

    bbox: BBox
    embedding: List[float]
    detection_score: float = 0.0

    @property
    def pixels(self) -> int:
        """Short edge of the face region, the resolution floor is measured on it."""
        return min(self.bbox.w, self.bbox.h)

    @property
    def usable(self) -> bool:
        return self.pixels >= MIN_FACE_PIXELS


def available() -> bool:
    """Whether face embedding can run in this deployment."""
    try:
        import insightface  # noqa: F401
        import onnxruntime  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def requirements() -> str:
    return "insightface and onnxruntime (pip install insightface onnxruntime)"


def _model():
    """Load and cache the model. Loading costs seconds, so it happens once."""
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if not available():
        raise ModuleUnavailable(
            module="face",
            requirement=requirements(),
            hint="face comparison will be reported as unavailable, not as a failure",
        )

    from insightface.app import FaceAnalysis

    model_dir = os.getenv("MODEL_DIR", "").strip() or None
    app = FaceAnalysis(
        name=os.getenv("FACE_MODEL", "buffalo_l"),
        root=model_dir or "~/.insightface",
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=-1, det_size=(640, 640))
    _MODEL = app
    return _MODEL


def detect(image) -> List[DetectedFace]:
    """Detect every face in an image and embed each one.

    Faces are returned largest first, because the subject of an identity
    document photograph is always the largest face in the frame.
    """
    app = _model()
    faces = []
    for face in app.get(image):
        x1, y1, x2, y2 = (int(v) for v in face.bbox)
        embedding = getattr(face, "normed_embedding", None)
        if embedding is None:
            embedding = getattr(face, "embedding", None)
        if embedding is None:
            continue
        faces.append(
            DetectedFace(
                bbox=BBox(x=x1, y=y1, w=max(0, x2 - x1), h=max(0, y2 - y1)),
                embedding=[float(v) for v in embedding],
                detection_score=float(getattr(face, "det_score", 0.0)),
            )
        )
    faces.sort(key=lambda f: f.bbox.w * f.bbox.h, reverse=True)
    return faces


def primary_face(image) -> Optional[DetectedFace]:
    """The largest face in an image, or ``None`` when there is none."""
    faces = detect(image)
    return faces[0] if faces else None


def embed_file(path: str) -> Optional[DetectedFace]:
    """Detect and embed the primary face in an image file."""
    import cv2

    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"could not read image: {path}")
    return primary_face(image)


def embed_bytes(data: bytes) -> Optional[DetectedFace]:
    """Embed the primary face in raw image bytes, such as the photo inside a QR."""
    import cv2
    import numpy as np

    buffer = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        return None
    return primary_face(image)
