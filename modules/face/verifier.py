"""Face checks: the bearer against the card, and the card against what was signed.

Verifying a document is not enough. A genuine card in the wrong hands passes
every cryptographic check there is. So three comparisons are made, and they
answer different questions:

``live`` vs ``document photo``
    Is the person standing here the person on the card?

``document photo`` vs ``QR photo``
    Was the photograph on the card replaced? The QR photo is signed by UIDAI, so
    a mismatch here is a substituted photograph — decisive, and the only face
    comparison that speaks to the *document* rather than to the bearer.

``live`` vs ``prior encounters``
    Has this face been screened before under a different identity? That search
    runs in the database, not here; this module publishes the embedding for it.

None of these can clear a document on their own — the check type is BIOMETRIC,
which is not authoritative. They confirm or contradict identity.
"""

from __future__ import annotations

from typing import List

from modules.common.types import (
    Check,
    CheckType,
    DocumentInput,
    Evidence,
    ExtractedField,
    ModuleResult,
    Severity,
    failed,
    inconclusive,
    passed,
)
from modules.common.verifier import Verifier
from modules.face import compare as compare_module
from modules.face import embedder


def _band_check(
    check_id: str,
    comparison: compare_module.Comparison,
    subject: str,
    *,
    failure_severity: Severity,
    region=None,
) -> Check:
    """Turn a similarity band into the right kind of check."""
    percent = f"{comparison.similarity:.2f}"
    evidence = [
        Evidence(
            note=f"cosine similarity {percent}",
            expected=f">= {comparison.match_threshold:.2f} to match",
            observed=percent,
            region=region,
            strength=max(0.0, min(1.0, comparison.similarity)),
            extra=comparison.to_dict(),
        )
    ]

    if comparison.is_match:
        return passed(
            check_id,
            CheckType.BIOMETRIC,
            f"{subject} match, at a similarity of {percent}.",
            evidence=evidence,
            module="face",
        )
    if comparison.is_inconclusive:
        return inconclusive(
            check_id,
            CheckType.BIOMETRIC,
            f"{subject} give a similarity of {percent}, which falls between the "
            f"match threshold of {comparison.match_threshold:.2f} and the "
            f"no-match threshold of {comparison.no_match_threshold:.2f}. This is "
            "not a determination either way and needs a human examiner.",
            severity=Severity.MEDIUM,
            evidence=evidence,
            module="face",
        )
    return failed(
        check_id,
        CheckType.BIOMETRIC,
        f"{subject} do not match, at a similarity of {percent}.",
        failure_severity,
        evidence=evidence,
        module="face",
    )


class FaceVerifier(Verifier):
    """Compares the live capture, the printed photograph and the signed photo."""

    name = "face"
    doc_types = ()
    order = 60
    required = False

    def available(self) -> bool:
        return embedder.available()

    def unavailable_reason(self) -> str:
        return (
            "face comparison needs " + embedder.requirements() + "; without it the "
            "bearer cannot be matched against the document"
        )

    def verify(self, document: DocumentInput) -> ModuleResult:
        import cv2

        thresholds = compare_module.thresholds_from_profile(document.profile)
        checks: List[Check] = []
        fields: List[ExtractedField] = []

        live_path = document.hints.get("live_face_path")
        qr_photo = document.hints.get("qr_photo_bytes")

        document_face = None
        if document.image_path:
            image = cv2.imread(document.image_path)
            if image is not None:
                document_face = embedder.primary_face(image)

        if document_face is None:
            checks.append(
                inconclusive(
                    "face.document_photo",
                    CheckType.BIOMETRIC,
                    "No face could be located on the document, so no face "
                    "comparison was possible.",
                    severity=Severity.MEDIUM,
                    evidence=[Evidence(note="no face detected on the document")],
                    module=self.name,
                )
            )
            return ModuleResult(module=self.name, checks=checks)

        if not document_face.usable:
            checks.append(
                inconclusive(
                    "face.resolution",
                    CheckType.BIOMETRIC,
                    f"The face on the document is only {document_face.pixels} "
                    f"pixels across, below the {compare_module.MIN_FACE_PIXELS} "
                    "pixel floor for a meaningful comparison. No similarity score "
                    "is reported, because one computed from this would be noise.",
                    severity=Severity.MEDIUM,
                    evidence=[
                        Evidence(
                            note="face region below the resolution floor",
                            expected=f">= {compare_module.MIN_FACE_PIXELS} px",
                            observed=f"{document_face.pixels} px",
                            region=document_face.bbox,
                        )
                    ],
                    module=self.name,
                )
            )
            return ModuleResult(module=self.name, checks=checks)

        # The embedding is published for the database's prior-encounter search.
        fields.append(
            ExtractedField(
                name="face_embedding",
                value=",".join(f"{v:.6f}" for v in document_face.embedding),
                source="face",
                confidence=document_face.detection_score,
                bbox=document_face.bbox,
            )
        )

        # -- document photograph against the signed QR photograph -----------
        if qr_photo:
            signed_face = embedder.embed_bytes(qr_photo)
            if signed_face is None:
                checks.append(
                    inconclusive(
                        "face.printed_vs_signed",
                        CheckType.BIOMETRIC,
                        "The signed QR contains a photograph, but no face could be "
                        "located within it to compare against the printed card.",
                        severity=Severity.MEDIUM,
                        evidence=[Evidence(note="no face found in the QR photo")],
                        module=self.name,
                    )
                )
            else:
                checks.append(
                    _band_check(
                        "face.printed_vs_signed",
                        compare_module.compare(
                            document_face.embedding, signed_face.embedding, **thresholds
                        ),
                        "The photograph printed on the card and the photograph "
                        "signed by UIDAI inside the QR",
                        failure_severity=Severity.CRITICAL,
                        region=document_face.bbox,
                    )
                )

        # -- live capture against the document ------------------------------
        if live_path:
            live_face = embedder.embed_file(live_path)
            if live_face is None:
                checks.append(
                    inconclusive(
                        "face.live_vs_document",
                        CheckType.BIOMETRIC,
                        "No face was found in the live capture, so the bearer "
                        "could not be compared against the document.",
                        severity=Severity.MEDIUM,
                        evidence=[Evidence(note="no face detected in live capture")],
                        module=self.name,
                    )
                )
            elif not live_face.usable:
                checks.append(
                    inconclusive(
                        "face.live_vs_document",
                        CheckType.BIOMETRIC,
                        f"The live capture face is only {live_face.pixels} pixels "
                        "across, which is below the floor for a meaningful "
                        "comparison. Ask the person to move closer to the camera.",
                        severity=Severity.MEDIUM,
                        evidence=[
                            Evidence(
                                note="live face below the resolution floor",
                                observed=f"{live_face.pixels} px",
                                region=live_face.bbox,
                            )
                        ],
                        module=self.name,
                    )
                )
            else:
                checks.append(
                    _band_check(
                        "face.live_vs_document",
                        compare_module.compare(
                            live_face.embedding, document_face.embedding, **thresholds
                        ),
                        "The person presenting the document and the photograph on it",
                        failure_severity=Severity.HIGH,
                        region=document_face.bbox,
                    )
                )
                fields.append(
                    ExtractedField(
                        name="live_face_embedding",
                        value=",".join(f"{v:.6f}" for v in live_face.embedding),
                        source="face",
                        confidence=live_face.detection_score,
                        bbox=live_face.bbox,
                    )
                )

        if not checks:
            checks.append(
                inconclusive(
                    "face.comparison",
                    CheckType.BIOMETRIC,
                    "A face was located on the document, but nothing was supplied "
                    "to compare it against — no live capture and no signed "
                    "photograph.",
                    severity=Severity.LOW,
                    evidence=[
                        Evidence(
                            note="document face embedded, no counterpart",
                            region=document_face.bbox,
                        )
                    ],
                    module=self.name,
                )
            )

        return ModuleResult(module=self.name, checks=checks, fields=fields)
