"""The interface every module implements, and the registry that finds them.

The registry is what makes "adding a document type is a configuration change"
literally true: a new module registers itself against a document type, and the
orchestrator picks it up without any change to the backend.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Sequence

from modules.common.errors import ModuleUnavailable, UnreadableDocument
from modules.common.types import (
    CheckType,
    DocumentInput,
    DocumentType,
    Evidence,
    ModuleResult,
    Severity,
    Timer,
    retake,
    unavailable,
)

log = logging.getLogger(__name__)


class Verifier(ABC):
    """One unit of verification.

    Subclasses implement :meth:`verify`. They should *not* catch their own
    ``ModuleUnavailable`` or ``UnreadableDocument`` — :meth:`run` converts those
    into the correct check so the behaviour is identical across every module.
    """

    #: Stable identifier, used in logs, checks and the API.
    name: str = ""

    #: Document types this verifier applies to. Empty means "all types".
    doc_types: Sequence[DocumentType] = ()

    #: Lower runs first. OCR must precede anything that compares printed text.
    order: int = 100

    #: Set False for modules whose absence should not push a case to REFER
    #: (forensics, for example, is a bonus signal, not a required check).
    required: bool = True

    # -- subclass implements this -----------------------------------------

    @abstractmethod
    def verify(self, document: DocumentInput) -> ModuleResult:
        """Analyse the document and return checks. Raise, do not swallow."""

    # -- optional hooks ----------------------------------------------------

    def available(self) -> bool:
        """Whether this verifier's dependencies are present.

        Override where a module needs an optional package or a provisioned
        certificate. The default assumes no external requirement.
        """
        return True

    def unavailable_reason(self) -> str:
        """Human-readable explanation shown when :meth:`available` is False."""
        return f"{self.name} is not available in this deployment"

    def applies_to(self, doc_type: DocumentType) -> bool:
        return not self.doc_types or doc_type in self.doc_types

    # -- the orchestrator calls this --------------------------------------

    def run(self, document: DocumentInput) -> ModuleResult:
        """Execute :meth:`verify` with uniform error and timing handling.

        Every failure mode becomes a check rather than an exception, because a
        module that crashed and a document that is fine are not the same thing
        and the officer has to be able to tell them apart.
        """
        if not self.available():
            reason = self.unavailable_reason()
            return ModuleResult(
                module=self.name,
                checks=[
                    unavailable(
                        f"{self.name}.available",
                        CheckType.POLICY if not self.required else CheckType.CROSS_FIELD,
                        f"This check could not run: {reason}. "
                        "The document has not been cleared or rejected by it.",
                        module=self.name,
                        severity=Severity.MEDIUM if self.required else Severity.LOW,
                    )
                ],
            )

        timer = Timer()
        try:
            with timer:
                result = self.verify(document)
        except UnreadableDocument as exc:
            return ModuleResult(
                module=self.name,
                duration_ms=timer.elapsed_ms,
                checks=[
                    retake(
                        f"{self.name}.quality",
                        f"Capture quality is too low to analyse: {exc.reason}. "
                        "Retake the photograph.",
                        module=self.name,
                        evidence=[
                            Evidence(
                                note=exc.reason,
                                extra={"metric": exc.metric, "value": exc.value},
                            )
                        ],
                    )
                ],
            )
        except ModuleUnavailable as exc:
            return ModuleResult(
                module=self.name,
                duration_ms=timer.elapsed_ms,
                checks=[
                    unavailable(
                        f"{self.name}.available",
                        CheckType.CROSS_FIELD,
                        f"This check could not run: {exc}. "
                        "The document has not been cleared or rejected by it.",
                        module=self.name,
                    )
                ],
            )
        except Exception as exc:  # noqa: BLE001 - a crash must not clear a document
            log.exception("module %s raised", self.name)
            return ModuleResult(
                module=self.name,
                duration_ms=timer.elapsed_ms,
                error=f"{type(exc).__name__}: {exc}",
                checks=[
                    unavailable(
                        f"{self.name}.error",
                        CheckType.CROSS_FIELD,
                        f"This check failed to complete ({type(exc).__name__}). "
                        "Treat the document as unverified by it, not as genuine.",
                        module=self.name,
                    )
                ],
            )

        result.duration_ms = timer.elapsed_ms
        for check in result.checks:
            if not check.module:
                check.module = self.name
            if check.doc_type is None:
                check.doc_type = document.doc_type
        for extracted in result.fields:
            if not extracted.source:
                extracted.source = self.name
        return result


class VerifierRegistry:
    """Holds the verifiers and returns the right ones for a document type."""

    def __init__(self) -> None:
        self._verifiers: Dict[str, Verifier] = {}

    def register(self, verifier: Verifier) -> Verifier:
        """Add a verifier. Registering the same name twice replaces the first."""
        if not verifier.name:
            raise ValueError(f"{type(verifier).__name__} must define a name")
        self._verifiers[verifier.name] = verifier
        return verifier

    def get(self, name: str) -> Optional[Verifier]:
        return self._verifiers.get(name)

    def all(self) -> List[Verifier]:
        return sorted(self._verifiers.values(), key=lambda v: (v.order, v.name))

    def for_document(self, doc_type: DocumentType) -> List[Verifier]:
        """Verifiers that apply to this document type, in execution order."""
        return [v for v in self.all() if v.applies_to(doc_type)]

    def names(self) -> List[str]:
        return sorted(self._verifiers)

    def availability(self) -> Dict[str, bool]:
        """Which modules can actually run here. Surfaced on the health endpoint."""
        return {name: v.available() for name, v in sorted(self._verifiers.items())}

    def clear(self) -> None:
        """Test helper."""
        self._verifiers.clear()


#: Process-wide registry. Modules register into this at import time.
registry = VerifierRegistry()


def load_all() -> VerifierRegistry:
    """Import every module package so its verifiers register themselves.

    Import errors are swallowed deliberately: a missing optional dependency in
    one module must not prevent the rest of the system from starting.
    """
    import importlib

    for package in (
        "modules.pan",
        "modules.ocr",
        "modules.aadhaar",
        "modules.passport",
        "modules.face",
        "modules.forensics",
    ):
        try:
            importlib.import_module(package)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not load %s: %s", package, exc)
    return registry
