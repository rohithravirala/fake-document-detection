"""Failure modes a module is allowed to have.

A module that cannot run is not the same as a document that failed a check.
Conflating the two is how a system ends up reporting a forgery because a model
was missing.
"""

from __future__ import annotations


class ModuleError(Exception):
    """Base for every error raised inside a verification module."""


class ModuleUnavailable(ModuleError):
    """A dependency this module needs is not installed or not configured.

    Raised when, for example, ``insightface`` is absent or the UIDAI certificate
    has not been provisioned. The orchestrator turns this into an UNAVAILABLE
    check, which pushes the case to REFER. It must never look like a FAIL.
    """

    def __init__(self, module: str, requirement: str, hint: str = "") -> None:
        self.module = module
        self.requirement = requirement
        self.hint = hint
        message = f"{module} requires {requirement}"
        if hint:
            message = f"{message} ({hint})"
        super().__init__(message)


class UnreadableDocument(ModuleError):
    """The image is too poor to analyse and the officer should retake it.

    Deliberately distinct from a failed check. Analysing a blurred photograph and
    returning a confident wrong answer is worse than asking for another capture.
    """

    def __init__(self, reason: str, metric: str = "", value: float = 0.0) -> None:
        self.reason = reason
        self.metric = metric
        self.value = value
        super().__init__(reason)
