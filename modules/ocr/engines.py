"""OCR engines, behind one interface.

Three engines are supported and none is required. The system is deployed on
machines ranging from a laptop to a border post terminal, and a missing model
must degrade to an honest "could not read this" rather than to a wrong answer.

``paddle``
    PaddleOCR. Best general accuracy on Indian scripts, returns word-level boxes.

``tesseract``
    Tesseract. Lighter, and the right tool for the MRZ specifically: constraining
    it to the OCR-B character set removes the ``0``/``O`` and ``1``/``I``
    confusions that break check digits.

``none``
    No engine installed. Reports itself unavailable. Text supplied directly in
    the request still flows through the rest of the pipeline, which is how the
    validators are demonstrated on a machine with no models.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from modules.common.types import BBox

log = logging.getLogger(__name__)

#: The MRZ alphabet. Constraining recognition to it is the single biggest
#: accuracy win available on a passport, because the MRZ has no context to
#: recover a misread character from.
MRZ_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"


@dataclass
class Word:
    """One recognised token with its position and confidence."""

    text: str
    bbox: Optional[BBox] = None
    confidence: float = 0.0


@dataclass
class OcrOutput:
    """Everything one engine read from one image."""

    text: str = ""
    words: List[Word] = field(default_factory=list)
    engine: str = ""
    mean_confidence: float = 0.0

    def lines(self) -> List[str]:
        return [ln for ln in self.text.splitlines() if ln.strip()]


class OcrEngine(ABC):
    """Common interface so the pipeline does not care which engine is present."""

    name: str = ""

    @abstractmethod
    def available(self) -> bool:
        """Whether this engine can run here."""

    @abstractmethod
    def read(self, image, *, alphabet: Optional[str] = None) -> OcrOutput:
        """Recognise text. ``alphabet`` restricts the character set when given."""


class TesseractEngine(OcrEngine):
    """Tesseract via ``pytesseract``. Also handles the MRZ."""

    name = "tesseract"

    def available(self) -> bool:
        try:
            import pytesseract

            pytesseract.get_tesseract_version()
        except Exception:  # noqa: BLE001
            return False
        return True

    def read(self, image, *, alphabet: Optional[str] = None) -> OcrOutput:
        import pytesseract
        from pytesseract import Output

        config = "--oem 3 --psm 6"
        if alphabet:
            config += f" -c tessedit_char_whitelist={alphabet}"

        data = pytesseract.image_to_data(image, config=config, output_type=Output.DICT)

        words: List[Word] = []
        confidences: List[float] = []
        lines: dict = {}

        for index, raw_text in enumerate(data.get("text", [])):
            token = (raw_text or "").strip()
            if not token:
                continue
            try:
                confidence = float(data["conf"][index])
            except (TypeError, ValueError):
                confidence = -1.0
            if confidence < 0:
                continue

            bbox = BBox(
                x=int(data["left"][index]),
                y=int(data["top"][index]),
                w=int(data["width"][index]),
                h=int(data["height"][index]),
            )
            words.append(Word(text=token, bbox=bbox, confidence=confidence / 100.0))
            confidences.append(confidence / 100.0)

            key = (
                data["block_num"][index],
                data["par_num"][index],
                data["line_num"][index],
            )
            lines.setdefault(key, []).append(token)

        text = "\n".join(" ".join(tokens) for _, tokens in sorted(lines.items()))
        mean = sum(confidences) / len(confidences) if confidences else 0.0
        return OcrOutput(text=text, words=words, engine=self.name, mean_confidence=mean)


class PaddleEngine(OcrEngine):
    """PaddleOCR. Loaded lazily and cached, because startup is expensive."""

    name = "paddle"

    def __init__(self) -> None:
        self._ocr = None

    def available(self) -> bool:
        try:
            import paddleocr  # noqa: F401
        except Exception:  # noqa: BLE001
            return False
        return True

    def _engine(self):
        if self._ocr is None:
            from paddleocr import PaddleOCR

            self._ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        return self._ocr

    def read(self, image, *, alphabet: Optional[str] = None) -> OcrOutput:
        # PaddleOCR has no character whitelist, so a restricted alphabet is
        # applied as a post-filter rather than being silently ignored.
        raw = self._engine().ocr(image, cls=True)
        blocks = raw[0] if raw and isinstance(raw[0], list) else (raw or [])

        words: List[Word] = []
        confidences: List[float] = []
        for entry in blocks or []:
            try:
                box, (text, confidence) = entry
            except (TypeError, ValueError):
                continue
            token = (text or "").strip()
            if alphabet:
                token = "".join(ch for ch in token.upper() if ch in alphabet)
            if not token:
                continue
            xs = [int(p[0]) for p in box]
            ys = [int(p[1]) for p in box]
            words.append(
                Word(
                    text=token,
                    bbox=BBox(
                        x=min(xs), y=min(ys), w=max(xs) - min(xs), h=max(ys) - min(ys)
                    ),
                    confidence=float(confidence),
                )
            )
            confidences.append(float(confidence))

        words.sort(key=lambda w: (w.bbox.y if w.bbox else 0, w.bbox.x if w.bbox else 0))
        text = "\n".join(w.text for w in words)
        mean = sum(confidences) / len(confidences) if confidences else 0.0
        return OcrOutput(text=text, words=words, engine=self.name, mean_confidence=mean)


class NullEngine(OcrEngine):
    """Placeholder used when nothing is installed. Always unavailable."""

    name = "none"

    def available(self) -> bool:
        return False

    def read(self, image, *, alphabet: Optional[str] = None) -> OcrOutput:
        return OcrOutput(engine=self.name)


#: Preference order. Paddle reads Indian-script cards better; Tesseract is the
#: dependable fallback and the MRZ specialist.
ENGINES: List[OcrEngine] = [PaddleEngine(), TesseractEngine()]


def best_engine(preferred: Optional[str] = None) -> Optional[OcrEngine]:
    """The best available engine, honouring an explicit preference first."""
    if preferred:
        for engine in ENGINES:
            if engine.name == preferred and engine.available():
                return engine
    for engine in ENGINES:
        if engine.available():
            return engine
    return None


def mrz_engine() -> Optional[OcrEngine]:
    """Tesseract if present, since only it accepts a character whitelist."""
    tesseract = next(e for e in ENGINES if e.name == "tesseract")
    return tesseract if tesseract.available() else best_engine()


def availability() -> dict:
    """Which engines are usable here. Surfaced on the health endpoint."""
    return {engine.name: engine.available() for engine in ENGINES}
