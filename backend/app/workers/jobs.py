"""The job body. Deliberately thin — it owns a transaction, nothing else.

Everything the screening does lives in :mod:`backend.app.services.screening`, so
that it is identical whether it runs in an RQ worker, in a background task, or
synchronously inside a test.
"""

from __future__ import annotations

import logging

from backend.app.db import session_scope
from backend.app.services import screening

log = logging.getLogger(__name__)


def run_screening(case_id: str) -> str:
    """Screen one case. The transaction commits only if the whole case succeeds."""
    log.info("screening case %s", case_id)
    try:
        with session_scope() as session:
            case = screening.run_case(session, case_id)
            return case.verdict or "refer"
    except Exception:
        log.exception("case %s failed", case_id)
        # The failure was already recorded on the case by run_case, in its own
        # transaction, before the exception propagated.
        _mark_failed(case_id)
        raise


def _mark_failed(case_id: str) -> None:
    """Record the failure on its own, since the screening transaction rolled back."""
    from backend.app.models.case import Case, CaseStatus

    try:
        with session_scope() as session:
            case = session.get(Case, case_id)
            if case is not None and case.status is not CaseStatus.COMPLETE:
                case.status = CaseStatus.FAILED
                if not case.error:
                    case.error = "screening did not complete"
    except Exception:  # noqa: BLE001
        log.exception("could not mark case %s as failed", case_id)
