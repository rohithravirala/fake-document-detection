"""Fetch the optional model weights into MODEL_DIR.

    python scripts/download_models.py --list     # what is installed and what is not
    python scripts/download_models.py --ocr      # PaddleOCR weights
    python scripts/download_models.py --face     # InsightFace weights
    python scripts/download_models.py --all

Idempotent: a model already present is not fetched again.

**Run this before demo day, not on it.** Every weight here is downloaded over the
network, and the system's whole selling point is that its decisive checks need no
network at all. Cache them while there is a connection worth trusting.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def model_dir() -> Path:
    from backend.app.config import get_settings

    target = get_settings().model_dir
    target.mkdir(parents=True, exist_ok=True)
    return target


def report() -> None:
    from modules.common.verifier import load_all
    from modules.face import embedder
    from modules.ocr import engine_availability

    load_all()
    print(f"model directory   {model_dir()}")
    print("\nOCR engines")
    for name, available in engine_availability().items():
        print(f"  {name:12} {'installed' if available else 'not installed'}")
    print("\nFace")
    print(f"  insightface  {'installed' if embedder.available() else 'not installed'}")
    print(
        "\nEverything above is optional. A module whose dependency is missing\n"
        "reports UNAVAILABLE and sends the case to REFER. It never becomes a\n"
        "rejection, and the decisive checks — Aadhaar signature, PAN structure,\n"
        "MRZ check digits — need none of it."
    )


def fetch_ocr() -> bool:
    target = model_dir()
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        print("paddleocr is not installed — see backend/requirements-ml.txt")
        return False

    os.environ.setdefault("PADDLE_OCR_BASE_DIR", str(target))
    print("fetching PaddleOCR weights (first run downloads, later runs reuse)…")
    PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    print("PaddleOCR ready")
    return True


def fetch_face() -> bool:
    target = model_dir()
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        print("insightface is not installed — see backend/requirements-ml.txt")
        return False

    print("fetching InsightFace weights…")
    app = FaceAnalysis(
        name=os.getenv("FACE_MODEL", "buffalo_l"),
        root=str(target),
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("InsightFace ready")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="show what is installed")
    parser.add_argument("--ocr", action="store_true")
    parser.add_argument("--face", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.list or not (args.ocr or args.face or args.all):
        report()
        return 0

    ok = True
    if args.ocr or args.all:
        ok = fetch_ocr() and ok
    if args.face or args.all:
        ok = fetch_face() and ok
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
