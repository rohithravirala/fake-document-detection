"""Dashboard and analytics aggregates.

Everything returned here is computed from cases actually screened. Two fields
come back null on purpose — accuracy and geography — because neither can be
produced honestly from what this system records, and a dashboard that invents
them is worse than one that admits the gap.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db import get_session
from backend.app.services import stats

router = APIRouter(tags=["analytics"])


@router.get("/stats", summary="Headline counters for the dashboard")
def overview(
    session: Session = Depends(get_session),
    days: int = Query(30, ge=1, le=365),
) -> Dict[str, Any]:
    return stats.overview(session, days=days)


@router.get("/analytics", summary="Everything the analytics screen renders")
def analytics(
    session: Session = Depends(get_session),
    days: int = Query(15, ge=1, le=90),
) -> Dict[str, Any]:
    return stats.analytics(session, days=days)
