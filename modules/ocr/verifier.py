"""The OCR stage: gate the capture, read it, classify it, extract its fields.

This module runs before every other verifier, because everything downstream
compares against what it produces. Two of its responsibilities matter more than
the reading itself:

**The quality gate.** A capture below threshold is stopped here with RETAKE. No
later module sees it, so no later module can produce a confident wrong answer
from it.

**Honest confidence.** Every field carries the confidence it was read at, and a
low-confidence read is surfaced as a check of its own. A contradiction found
between two low-confidence values is a capture problem, not a forgery, and the
verdict engine needs to be able to tell.
"""

from __future__ import annotations

from typing import List

from modules.common.errors import UnreadableDocument
from modules.common.types import (
    Check,
    CheckType,
    DocumentInput,
    DocumentType,
    Evidence,
    ExtractedField,
    ModuleResult,
    Severity,
    inconclusive,
    passed,
    unavailable,
)
from modules.common.verifier import Verifier
from modules.ocr import engines, extract, preprocess, quality

#: Below this mean confidence the read is reported as doubtful, so that a
#: mismatch found against it is not treated as proof of tampering.
LOW_CONFIDENCE = 0.55


class OcrVerifier(Verifier):
    """Reads the document and publishes its fields for every other module."""

    name = "ocr"
    doc_types = ()  # applies to every document type
    order = 10

    def available(self) -> bool:
        # The stage is still useful with no engine: the quality gate runs, and
        # fields supplied directly in the request pass through. It reports the
        # missing engine as a check rather than refusing to run.
        return True

    def verify(self, document: DocumentInput) -> ModuleResult:
        if not document.image_path:
            return self._no_image(document)

        image = preprocess.load(document.image_path)

        # -- 1. quality gate, before anything else ------------------------
        thresholds = (document.profile or {}).get("quality", {})
        report = quality.assess(image, thresholds)
        if not report.acceptable:
            raise UnreadableDocument(
                reason="; ".join(report.failures),
                metric="quality",
                value=report.sharpness,
            )

        checks: List[Check] = [
            passed(
                "ocr.quality",
                CheckType.QUALITY,
                f"Capture quality is sufficient for analysis ({report.summary}).",
                evidence=[Evidence(note="quality gate passed", extra=report.to_dict())],
                module=self.name,
            )
        ]

        # -- 2. preprocessing ---------------------------------------------
        prepared = preprocess.run(image)

        # -- 3. recognition -------------------------------------------------
        engine = engines.best_engine((document.profile or {}).get("ocr_engine"))
        if engine is None:
            checks.append(
                unavailable(
                    "ocr.engine",
                    CheckType.QUALITY,
                    "No OCR engine is installed in this deployment, so no text "
                    "could be read from the document. Checks that compare "
                    "printed text have not been performed.",
                    module=self.name,
                    evidence=[
                        Evidence(
                            note="install pytesseract with the tesseract binary, "
                            "or paddleocr",
                            extra=engines.availability(),
                        )
                    ],
                )
            )
            return ModuleResult(module=self.name, checks=checks)

        output = engine.read(prepared.image)

        if not output.text.strip():
            checks.append(
                inconclusive(
                    "ocr.text_found",
                    CheckType.QUALITY,
                    f"The {engine.name} engine read no text from this image, so "
                    "nothing printed on it could be checked.",
                    severity=Severity.HIGH,
                    evidence=[Evidence(note="no text recognised")],
                    module=self.name,
                )
            )
            return ModuleResult(module=self.name, checks=checks)

        # -- 4. classification ----------------------------------------------
        detected, classification_confidence = extract.classify(output.text)
        declared = document.doc_type

        if declared in (DocumentType.UNKNOWN, None):
            resolved = detected
        else:
            resolved = declared
            if detected is not DocumentType.UNKNOWN and detected is not declared:
                checks.append(
                    inconclusive(
                        "ocr.document_type",
                        CheckType.QUALITY,
                        f"This document was submitted as a {declared.value} but "
                        f"reads as a {detected.value}. The checks for the "
                        "submitted type were applied.",
                        severity=Severity.MEDIUM,
                        evidence=[
                            Evidence(
                                note="declared and detected type differ",
                                expected=declared.value,
                                observed=detected.value,
                            )
                        ],
                        module=self.name,
                    )
                )

        if resolved is not DocumentType.UNKNOWN:
            checks.append(
                passed(
                    "ocr.document_type",
                    CheckType.QUALITY,
                    f"The document was identified as a {resolved.value} "
                    f"({classification_confidence:.0%} of the classification "
                    "evidence).",
                    evidence=[
                        Evidence(
                            note="document type identified",
                            observed=resolved.value,
                            strength=classification_confidence,
                        )
                    ],
                    module=self.name,
                )
            )

        # -- 5. field extraction --------------------------------------------
        fields: List[ExtractedField] = extract.extract_fields(output, resolved)

        # Map bounding boxes back to original image coordinates.
        if prepared.scale != 1.0:
            factor = 1.0 / prepared.scale
            for item in fields:
                if item.bbox is not None:
                    item.bbox = item.bbox.scaled(factor)

        fields.append(
            ExtractedField(
                name="raw_text",
                value=output.text,
                source="ocr",
                confidence=output.mean_confidence,
            )
        )

        if output.mean_confidence < LOW_CONFIDENCE:
            checks.append(
                inconclusive(
                    "ocr.confidence",
                    CheckType.QUALITY,
                    f"Text was read at only {output.mean_confidence:.0%} average "
                    "confidence. Any disagreement found against this text should "
                    "be treated as a possible misread rather than as evidence of "
                    "tampering.",
                    severity=Severity.MEDIUM,
                    evidence=[
                        Evidence(
                            note="low mean OCR confidence",
                            expected=f">= {LOW_CONFIDENCE:.0%}",
                            observed=f"{output.mean_confidence:.0%}",
                            strength=output.mean_confidence,
                        )
                    ],
                    module=self.name,
                )
            )
        else:
            checks.append(
                passed(
                    "ocr.confidence",
                    CheckType.QUALITY,
                    f"Text was read at {output.mean_confidence:.0%} average "
                    f"confidence using {engine.name}.",
                    evidence=[
                        Evidence(
                            note="OCR confidence acceptable",
                            observed=f"{output.mean_confidence:.0%}",
                            strength=output.mean_confidence,
                        )
                    ],
                    module=self.name,
                )
            )

        # Required fields come from the verification profile, not from code.
        required = (document.profile or {}).get("required_fields", [])
        missing = [name for name in required if not any(f.name == name for f in fields)]
        if missing:
            checks.append(
                inconclusive(
                    "ocr.required_fields",
                    CheckType.QUALITY,
                    "The following fields could not be read from this document: "
                    f"{', '.join(missing)}. Checks depending on them were skipped.",
                    severity=Severity.MEDIUM,
                    evidence=[
                        Evidence(
                            note="required fields missing", observed=", ".join(missing)
                        )
                    ],
                    module=self.name,
                )
            )

        return ModuleResult(module=self.name, checks=checks, fields=fields)

    def _no_image(self, document: DocumentInput) -> ModuleResult:
        """Fields supplied directly, with no image to read.

        This is the path the validators are demonstrated on when no OCR engine
        is installed, and the path the test suite uses.
        """
        if document.fields:
            return ModuleResult(
                module=self.name,
                checks=[
                    passed(
                        "ocr.source",
                        CheckType.QUALITY,
                        "Field values were supplied directly with the request, so "
                        "no text recognition was performed.",
                        evidence=[
                            Evidence(
                                note="fields provided by the caller",
                                observed=", ".join(
                                    sorted({f.name for f in document.fields})
                                ),
                            )
                        ],
                        module=self.name,
                    )
                ],
            )
        return ModuleResult(
            module=self.name,
            checks=[
                inconclusive(
                    "ocr.source",
                    CheckType.QUALITY,
                    "No image and no field values were supplied, so there was "
                    "nothing to check.",
                    severity=Severity.HIGH,
                    evidence=[Evidence(note="empty submission")],
                    module=self.name,
                )
            ],
        )
