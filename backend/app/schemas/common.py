"""Shared field types for the response schemas."""

from __future__ import annotations

import datetime as dt
from typing import Annotated, Any

from pydantic import BeforeValidator


def _as_utc(value: Any) -> Any:
    """Attach UTC to a naive datetime on its way out of the API.

    Every timestamp is written as ``datetime.now(timezone.utc)``, but SQLite has
    no timezone type and hands the value back naive. Serialised without an
    offset, a browser reads it as *local* time — so in IST every case appeared
    five and a half hours old the moment it was screened.

    Postgres round-trips the offset correctly, which is exactly why this has to
    be fixed here rather than in the interface: the bug would appear on one
    backend and not the other, and the officer-facing timestamps have to be right
    on both.
    """
    if isinstance(value, dt.datetime) and value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


#: A datetime that always carries an offset once serialised.
UtcDatetime = Annotated[dt.datetime, BeforeValidator(_as_utc)]
