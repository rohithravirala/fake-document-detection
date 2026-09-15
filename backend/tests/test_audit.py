"""The hash chain, and that it actually detects tampering.

A tamper-evident log that is never tested against a tamper is a claim, not a
property. Each test below edits the stored data the way an insider with database
access would, and asserts the chain reports it.
"""

from __future__ import annotations

from sqlalchemy import select

from backend.app.models.audit import GENESIS_HASH, AuditLog
from backend.app.services import audit


def append_records(session, count=5):
    for index in range(count):
        audit.append(
            session,
            action="screening.complete",
            officer_id="demo-officer-01",
            case_id=f"case-{index}",
            payload={"case_id": f"case-{index}", "verdict": "clear", "checks": index},
        )
    session.commit()


def test_chain_verifies_after_appends(clean_audit):
    append_records(clean_audit)
    status = audit.verify_chain(clean_audit)
    assert status.intact
    assert status.records == 5
    assert status.broken_at is None


def test_first_record_links_to_the_genesis_hash(clean_audit):
    append_records(clean_audit, count=1)
    record = clean_audit.execute(select(AuditLog)).scalars().one()
    assert record.previous_hash == GENESIS_HASH
    assert record.sequence == 1


def test_each_record_links_to_the_one_before(clean_audit):
    append_records(clean_audit, count=4)
    records = (
        clean_audit.execute(select(AuditLog).order_by(AuditLog.sequence)).scalars().all()
    )
    for previous, current in zip(records, records[1:]):
        assert current.previous_hash == previous.record_hash


def test_editing_a_past_payload_is_detected(clean_audit):
    """The attack the chain exists to defeat."""
    append_records(clean_audit)
    record = clean_audit.execute(
        select(AuditLog).where(AuditLog.sequence == 2)
    ).scalar_one()
    record.payload = {**record.payload, "verdict": "reject"}
    clean_audit.commit()

    status = audit.verify_chain(clean_audit)
    assert not status.intact
    assert status.broken_at == 2
    assert "edited" in status.detail


def test_deleting_a_record_is_detected(clean_audit):
    append_records(clean_audit)
    record = clean_audit.execute(
        select(AuditLog).where(AuditLog.sequence == 3)
    ).scalar_one()
    clean_audit.delete(record)
    clean_audit.commit()

    status = audit.verify_chain(clean_audit)
    assert not status.intact
    assert "removed or reordered" in status.detail


def test_rewriting_a_record_hash_to_cover_an_edit_is_detected(clean_audit):
    """A sophisticated tamper: edit the payload and its hash together."""
    append_records(clean_audit)
    record = clean_audit.execute(
        select(AuditLog).where(AuditLog.sequence == 2)
    ).scalar_one()
    record.payload = {**record.payload, "verdict": "reject"}
    record.payload_hash = audit.hash_payload(record.payload)
    clean_audit.commit()

    status = audit.verify_chain(clean_audit)
    # The payload now matches its own hash, but the chain link no longer holds.
    assert not status.intact
    assert status.broken_at == 2


def test_empty_log_is_intact(clean_audit):
    status = audit.verify_chain(clean_audit)
    assert status.intact
    assert status.records == 0


def test_canonical_json_is_order_independent():
    """Two encodings of the same data must hash identically, or the chain lies."""
    assert audit.hash_payload({"a": 1, "b": 2}) == audit.hash_payload({"b": 2, "a": 1})


def test_canonical_json_distinguishes_different_data():
    assert audit.hash_payload({"verdict": "clear"}) != audit.hash_payload(
        {"verdict": "reject"}
    )
