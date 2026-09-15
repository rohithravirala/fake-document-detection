"""Shared contract for every verification module.

This package has **zero third-party dependencies** on purpose. It is imported by
the backend, by every module, and by the test suite, so it must stay importable
in any environment. No OpenCV, no FastAPI, no models.
"""

from modules.common.errors import (
    ModuleError,
    ModuleUnavailable,
    UnreadableDocument,
)
from modules.common.types import (
    ADVISORY,
    AUTHORITATIVE,
    NEVER_PASSES,
    BBox,
    Check,
    CheckResult,
    CheckType,
    DocumentInput,
    DocumentType,
    Evidence,
    ExtractedField,
    ModuleResult,
    Severity,
    Verdict,
)
from modules.common.verifier import Verifier, registry

__all__ = [
    "ADVISORY",
    "AUTHORITATIVE",
    "NEVER_PASSES",
    "BBox",
    "Check",
    "CheckResult",
    "CheckType",
    "DocumentInput",
    "DocumentType",
    "Evidence",
    "ExtractedField",
    "ModuleError",
    "ModuleResult",
    "ModuleUnavailable",
    "Severity",
    "UnreadableDocument",
    "Verdict",
    "Verifier",
    "registry",
]
