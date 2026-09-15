"""The live check stream.

The officer watches each check land as it completes rather than watching a
spinner for eight seconds. Server-Sent Events rather than a WebSocket because the
traffic is one-directional and SSE reconnects on its own.

The stream is a convenience, not the record. It ends by reconciling against the
database, so a dropped event delays a row on screen rather than losing it — and
the case endpoint always returns the complete truth regardless of what the stream
delivered.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.app.db import SessionLocal, get_session
from backend.app.models.case import Case, CaseStatus
from backend.app.services import events

log = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["cases"])

#: Give up on a screening that produces nothing for this long.
IDLE_TIMEOUT_SECONDS = 90.0

TERMINAL_EVENTS = {"case.complete", "case.failed"}


def _case_snapshot(case_id: str) -> Optional[Dict[str, object]]:
    """Read the case's current state, for the reconciliation at the end."""
    session: Session = SessionLocal()
    try:
        case = session.get(Case, case_id)
        if case is None:
            return None
        return {
            "type": "case.state",
            "case_id": case.id,
            "status": case.status.value,
            "verdict": case.verdict,
            "reason": case.reason,
            "duration_ms": case.duration_ms,
            "error": case.error,
        }
    finally:
        session.close()


async def _stream(case_id: str, request: Request) -> AsyncIterator[Dict[str, str]]:
    bus = events.memory_bus()
    queue = bus.subscribe(case_id)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=IDLE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                snapshot = _case_snapshot(case_id)
                if snapshot and snapshot["status"] in (
                    CaseStatus.COMPLETE.value,
                    CaseStatus.FAILED.value,
                ):
                    yield {"event": "case.state", "data": json.dumps(snapshot)}
                else:
                    yield {
                        "event": "timeout",
                        "data": json.dumps(
                            {
                                "type": "timeout",
                                "message": (
                                    "No result for 90 seconds. The screening may "
                                    "still be running; reload the case to see its "
                                    "current state."
                                ),
                            }
                        ),
                    }
                break

            yield {"event": event.get("type", "message"), "data": json.dumps(event)}

            if event.get("type") in TERMINAL_EVENTS:
                break
    finally:
        bus.unsubscribe(case_id, queue)

    # Always finish with the authoritative state from the database, however the
    # stream ended — terminal event, disconnect or idle timeout. The stream is a
    # view of progress; the database is the record, and the client must end up
    # holding the record.
    snapshot = _case_snapshot(case_id)
    if snapshot is not None:
        yield {"event": "case.state", "data": json.dumps(snapshot)}


@router.get("/{case_id}/stream", summary="Live check results as they complete")
async def stream_case(
    case_id: str, request: Request, session: Session = Depends(get_session)
) -> EventSourceResponse:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"case {case_id} not found")

    return EventSourceResponse(_stream(case_id, request))
