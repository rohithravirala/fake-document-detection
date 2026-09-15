"""Running every forensic technique and reporting what they found.

The contract this module keeps, and the reason it exists at all:

**A forensic check can never return PASS.** :class:`~modules.common.types.Check`
enforces that in its constructor. When nothing is found, this module reports
INCONCLUSIVE with an explicit sentence saying that no signal was detected and
that this is not evidence the document is genuine.

That wording is not caution for its own sake. Forensics runs precisely on the
documents that have no source of truth to check against — old cards, photocopies,
visa stamps. Those are the documents where the system has the least to go on, so
they are the ones where an unearned reassurance would do the most damage.
"""

from __future__ import annotations

from typing import List

from modules.common.types import (
    Check,
    CheckType,
    DocumentInput,
    Evidence,
    ModuleResult,
    Severity,
    failed,
    inconclusive,
)
from modules.common.verifier import Verifier
from modules.forensics import copymove, ela, metadata, noise
from modules.forensics.signals import REPORT_THRESHOLD, Signal

_SEVERITY_BY_STRENGTH = (
    (0.80, Severity.HIGH),
    (0.55, Severity.MEDIUM),
    (0.00, Severity.LOW),
)


def _severity_for(strength: float) -> Severity:
    for floor, severity in _SEVERITY_BY_STRENGTH:
        if strength >= floor:
            return severity
    return Severity.LOW


def _check_from_signal(signal: Signal) -> Check:
    return failed(
        f"forensics.{signal.kind}",
        CheckType.FORENSIC,
        signal.note + " This is an indication for a human examiner, not a determination "
        "that the document is forged.",
        _severity_for(signal.strength),
        evidence=[
            Evidence(
                note=signal.note,
                region=signal.region,
                strength=signal.strength,
                extra=signal.detail,
            )
        ],
        module="forensics",
    )


class ForensicsVerifier(Verifier):
    """Compression, noise, copy-move and metadata analysis."""

    name = "forensics"
    doc_types = ()
    order = 70
    required = False

    def verify(self, document: DocumentInput) -> ModuleResult:
        if not document.image_path:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "forensics.source",
                        CheckType.FORENSIC,
                        "No image was supplied, so no tampering analysis was performed.",
                        severity=Severity.LOW,
                        evidence=[Evidence(note="no image to analyse")],
                        module=self.name,
                    )
                ],
            )

        import cv2

        image = cv2.imread(document.image_path)
        if image is None:
            return ModuleResult(
                module=self.name,
                checks=[
                    inconclusive(
                        "forensics.source",
                        CheckType.FORENSIC,
                        "The image could not be opened for tampering analysis.",
                        severity=Severity.LOW,
                        evidence=[Evidence(note="unreadable image")],
                        module=self.name,
                    )
                ],
            )

        signals: List[Signal] = []
        performed: List[str] = []

        for label, run in (
            ("compression", lambda: ela.analyse(image)),
            ("noise", lambda: noise.analyse(image)),
            ("copy-move", lambda: copymove.analyse(image)),
            ("metadata", lambda: metadata.analyse(document.image_path)),
        ):
            try:
                signals.extend(run())
                performed.append(label)
            except Exception:  # noqa: BLE001 - one technique failing is not fatal
                continue

        reportable = [s for s in signals if s.strength >= REPORT_THRESHOLD]
        weak = [s for s in signals if s.strength < REPORT_THRESHOLD]

        checks: List[Check] = [_check_from_signal(s) for s in reportable]

        if not reportable:
            detail = (
                f"{len(weak)} weak indication(s) were seen but none reached the "
                "reporting threshold. "
                if weak
                else ""
            )
            checks.append(
                inconclusive(
                    "forensics.summary",
                    CheckType.FORENSIC,
                    f"Tampering analysis ({', '.join(performed)}) found no "
                    f"significant signal. {detail}"
                    "This is not evidence that the document is genuine — it means "
                    "no alteration was detected by these techniques.",
                    severity=Severity.LOW,
                    evidence=[
                        Evidence(
                            note="no signal above the reporting threshold",
                            extra={
                                "techniques": performed,
                                "weak_signals": [s.to_dict() for s in weak],
                            },
                        )
                    ],
                    module=self.name,
                )
            )

        return ModuleResult(module=self.name, checks=checks)
