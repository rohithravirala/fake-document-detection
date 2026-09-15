"""Classifying a document and pulling its fields out of recognised text.

The patterns here are deliberately conservative. An extractor that guesses fills
the pipeline with plausible wrong values, and a wrong value compared against a
signed QR produces a false accusation of forgery — the worst failure this system
can have. Where a field is ambiguous, it is left out, and the check that needed
it reports INCONCLUSIVE instead.

Every field carries the confidence it was read with, so the verdict engine can
tell a confident contradiction from a doubtful one.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence, Tuple

from modules.common.types import BBox, DocumentType, ExtractedField
from modules.ocr.engines import OcrOutput, Word

# ---------------------------------------------------------------------------
#  Document classification
# ---------------------------------------------------------------------------

#: Marker -> document type, with the weight each marker carries. Structural
#: markers (a PAN-shaped number) outweigh wording, which varies by print run.
_MARKERS: Sequence[Tuple[str, DocumentType, float]] = (
    (r"\bINCOME\s*TAX\s*DEPARTMENT\b", DocumentType.PAN, 3.0),
    (r"\bPERMANENT\s*ACCOUNT\s*NUMBER\b", DocumentType.PAN, 3.0),
    (r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", DocumentType.PAN, 4.0),
    (r"\bUNIQUE\s*IDENTIFICATION\s*AUTHORITY\b", DocumentType.AADHAAR, 3.0),
    (r"\bAADHAAR\b", DocumentType.AADHAAR, 3.0),
    (r"\b\d{4}\s\d{4}\s\d{4}\b", DocumentType.AADHAAR, 4.0),
    (r"\bमेरा\s*आधार\b", DocumentType.AADHAAR, 2.0),
    (r"\bREPUBLIC\s*OF\s*INDIA\b", DocumentType.PASSPORT, 2.0),
    (r"\bPASSPORT\b", DocumentType.PASSPORT, 2.5),
    (r"^P[<A-Z]{2}[A-Z]{3}", DocumentType.PASSPORT, 4.0),
    (r"\bVISA\b", DocumentType.VISA, 3.0),
    (r"\bDURATION\s*OF\s*STAY\b", DocumentType.VISA, 3.0),
)


def classify(text: str) -> Tuple[DocumentType, float]:
    """Identify the document type, and how strongly the evidence supports it.

    Returns ``UNKNOWN`` with confidence 0 when nothing matches, rather than
    picking the least-bad option. An unknown type routes to the generic path,
    which is correct; a wrongly asserted type runs the wrong checks entirely.
    """
    upper = (text or "").upper()
    scores: Dict[DocumentType, float] = {}
    for pattern, doc_type, weight in _MARKERS:
        if re.search(pattern, upper, re.MULTILINE):
            scores[doc_type] = scores.get(doc_type, 0.0) + weight

    if not scores:
        return DocumentType.UNKNOWN, 0.0

    best = max(scores.items(), key=lambda item: item[1])
    total = sum(scores.values())
    return best[0], round(best[1] / total, 3)


# ---------------------------------------------------------------------------
#  Field patterns
# ---------------------------------------------------------------------------

PAN_RE = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
AADHAAR_RE = re.compile(r"\b(\d{4}\s?\d{4}\s?\d{4})\b")
AADHAAR_MASKED_RE = re.compile(r"\b(?:[X*]{4}\s?){2}(\d{4})\b", re.IGNORECASE)
VID_RE = re.compile(r"\b(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})\b")
DOB_RE = re.compile(r"\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b")
YOB_RE = re.compile(r"\b(?:YEAR\s*OF\s*BIRTH|YOB)\s*[:\-]?\s*(\d{4})\b", re.IGNORECASE)
GENDER_RE = re.compile(r"\b(MALE|FEMALE|TRANSGENDER|पुरुष|महिला)\b", re.IGNORECASE)
PINCODE_RE = re.compile(r"\b(\d{6})\b")
PASSPORT_NO_RE = re.compile(r"\b([A-Z][0-9]{7})\b")

#: Labels that precede a name on Indian identity documents.
_NAME_LABELS = (
    r"NAME",
    r"नाम",
    r"पेरु",
    r"పేరు",
)

_FATHER_LABELS = (r"FATHER'?S\s*NAME", r"पिता\s*का\s*नाम")

#: Words that appear on cards but are never part of a person's name.
_NAME_STOPWORDS = frozenset(
    {
        "GOVERNMENT",
        "OF",
        "INDIA",
        "INCOME",
        "TAX",
        "DEPARTMENT",
        "PERMANENT",
        "ACCOUNT",
        "NUMBER",
        "CARD",
        "UNIQUE",
        "IDENTIFICATION",
        "AUTHORITY",
        "AADHAAR",
        "MALE",
        "FEMALE",
        "DOB",
        "YEAR",
        "BIRTH",
        "REPUBLIC",
        "PASSPORT",
        "SIGNATURE",
        "ADDRESS",
    }
)


def _bbox_for(words: List[Word], value: str) -> Optional[BBox]:
    """Find the region covering a value, so the frontend can crop it.

    Matches on the concatenated token text, because OCR splits a name across
    several words and a number across two.
    """
    target = re.sub(r"\s", "", value.upper())
    if not target:
        return None

    for size in (1, 2, 3, 4):
        for start in range(0, max(0, len(words) - size + 1)):
            window = words[start : start + size]
            joined = re.sub(r"\s", "", "".join(w.text for w in window).upper())
            if target and target in joined:
                boxes = [w.bbox for w in window if w.bbox]
                if not boxes:
                    return None
                x = min(b.x for b in boxes)
                y = min(b.y for b in boxes)
                return BBox(
                    x=x,
                    y=y,
                    w=max(b.x + b.w for b in boxes) - x,
                    h=max(b.y + b.h for b in boxes) - y,
                )
    return None


def _labelled_value(lines: List[str], labels: Sequence[str]) -> Optional[str]:
    """Value following a label, either on the same line or the next one."""
    pattern = re.compile(r"(?:" + "|".join(labels) + r")\s*[:\-]?\s*(.*)", re.IGNORECASE)
    for index, line in enumerate(lines):
        match = pattern.search(line)
        if not match:
            continue
        candidate = match.group(1).strip(" :-\t")
        if _plausible_name(candidate):
            return candidate
        if index + 1 < len(lines):
            following = lines[index + 1].strip()
            if _plausible_name(following):
                return following
    return None


def _plausible_name(value: str) -> bool:
    """Whether a string could be a person's name rather than card furniture."""
    if not value or len(value) < 3 or len(value) > 60:
        return False
    letters = re.sub(r"[^A-Za-zऀ-ॿఀ-౿\s.]", "", value)
    if len(letters) < len(value) * 0.7:
        return False
    words = [w for w in re.split(r"\s+", letters.upper()) if len(w) > 1]
    if not words:
        return False
    return not all(word in _NAME_STOPWORDS for word in words)


def _first_name_line(lines: List[str]) -> Optional[str]:
    """Fallback: the first line that reads like a name and is not furniture."""
    for line in lines:
        stripped = line.strip()
        if not _plausible_name(stripped):
            continue
        words = [w for w in re.split(r"\s+", stripped.upper()) if w]
        if any(word in _NAME_STOPWORDS for word in words):
            continue
        if re.search(r"\d", stripped):
            continue
        return stripped
    return None


def extract_mrz_block(text: str) -> Optional[str]:
    """Locate the MRZ within recognised text.

    The filler ``<`` is what identifies it, and it is never stripped: it carries
    the field boundaries and the separation between surname and given names.
    """
    candidates = [
        re.sub(r"[^A-Z0-9<]", "", line.upper().replace(" ", "<"))
        for line in (text or "").splitlines()
    ]
    block = [line for line in candidates if len(line) >= 28 and line.count("<") >= 3]
    if len(block) >= 2:
        return "\n".join(block[-3:] if len(block) >= 3 else block[-2:])
    return None


def extract_fields(output: OcrOutput, doc_type: DocumentType) -> List[ExtractedField]:
    """Pull the fields relevant to this document type out of recognised text."""
    text = output.text or ""
    lines = output.lines()
    words = output.words
    confidence = output.mean_confidence or 0.5
    found: List[ExtractedField] = []

    def add(name: str, value: str, *, conf: Optional[float] = None) -> None:
        cleaned = (value or "").strip()
        if not cleaned:
            return
        found.append(
            ExtractedField(
                name=name,
                value=cleaned,
                source="ocr",
                confidence=conf if conf is not None else confidence,
                bbox=_bbox_for(words, cleaned),
                raw=cleaned,
            )
        )

    # -- names, common to every card type --------------------------------
    name = _labelled_value(lines, _NAME_LABELS) or _first_name_line(lines)
    if name:
        add("name", name)

    father = _labelled_value(lines, _FATHER_LABELS)
    if father:
        add("father_name", father)

    # -- dates ------------------------------------------------------------
    dob_match = DOB_RE.search(text)
    if dob_match:
        add("date_of_birth", dob_match.group(1))
    else:
        yob_match = YOB_RE.search(text)
        if yob_match:
            add("date_of_birth", yob_match.group(1))

    gender_match = GENDER_RE.search(text)
    if gender_match:
        add("gender", gender_match.group(1).upper())

    # -- type-specific ----------------------------------------------------
    if doc_type is DocumentType.PAN:
        pan_match = PAN_RE.search(text.upper())
        if pan_match:
            add("pan_number", pan_match.group(1))

    elif doc_type is DocumentType.AADHAAR:
        # A VID is sixteen digits and would otherwise match the twelve digit
        # pattern's prefix, so it is tested first.
        vid_match = VID_RE.search(text)
        aadhaar_match = AADHAAR_RE.search(text)
        if vid_match and len(re.sub(r"\D", "", vid_match.group(1))) == 16:
            add("virtual_id", re.sub(r"\s", "", vid_match.group(1)))
        if aadhaar_match:
            add("aadhaar_number", re.sub(r"\s", "", aadhaar_match.group(1)))
        else:
            masked = AADHAAR_MASKED_RE.search(text)
            if masked:
                add("aadhaar_number", masked.group(1))
        pincode_match = PINCODE_RE.search(text)
        if pincode_match:
            add("pincode", pincode_match.group(1))

    elif doc_type in (DocumentType.PASSPORT, DocumentType.VISA):
        mrz = extract_mrz_block(text)
        if mrz:
            add("mrz", mrz, conf=1.0)
        passport_match = PASSPORT_NO_RE.search(text.upper())
        if passport_match:
            add("passport_number", passport_match.group(1))

    return found
