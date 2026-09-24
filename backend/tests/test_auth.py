"""Tests for officer authentication, session management, and audit tracking."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models.audit import AuditLog
from backend.app.services.audit import verify_chain


def test_login_successful(client: TestClient):
    payload = {
        "name": "Ramu Gaddam",
        "email": "ramu.gaddam@svaram.gov.in",
        "password": "secureOfficerPass123",
        "role": "Senior Verification Officer",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["authenticated"] is True
    assert data["user"]["name"] == "Ramu Gaddam"
    assert data["user"]["email"] == "ramu.gaddam@svaram.gov.in"
    assert data["user"]["role"] == "Senior Verification Officer"
    assert data["user"]["token"].startswith("svaram_tok_")
    assert data["user"]["badge_number"].startswith("IN-")


def test_login_validation_errors(client: TestClient):
    # Invalid email
    res1 = client.post(
        "/api/auth/login",
        json={"name": "Officer", "email": "invalid-email", "password": "pass"},
    )
    assert res1.status_code in (400, 422)

    # Empty name
    res2 = client.post(
        "/api/auth/login",
        json={"name": "  ", "email": "officer@test.com", "password": "pass"},
    )
    assert res2.status_code in (400, 422)

    # Short password
    res3 = client.post(
        "/api/auth/login",
        json={"name": "Valid Name", "email": "officer@test.com", "password": "12"},
    )
    assert res3.status_code in (400, 422)


def test_login_writes_audit_record_and_keeps_chain_intact(client: TestClient, session: Session):
    payload = {
        "name": "Rohith Ravirala",
        "email": "rohith.ravirala@svaram.gov.in",
        "password": "adminPassword456",
        "role": "Lead Administrator",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json()["user"]["token"]

    # Verify audit record was created
    audit_row = (
        session.query(AuditLog)
        .filter(AuditLog.action == "officer_login")
        .order_by(AuditLog.sequence.desc())
        .first()
    )
    assert audit_row is not None
    assert audit_row.payload["officer_name"] == "Rohith Ravirala"
    assert audit_row.payload["email"] == "rohith.ravirala@svaram.gov.in"

    # Verify audit chain integrity remains 100% intact
    chain_status = verify_chain(session)
    assert chain_status.intact is True

    # Check /me endpoint
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["authenticated"] is True
    assert me_resp.json()["user"]["name"] == "Rohith Ravirala"

    # Check /api/officers endpoint lists active officer
    officers_resp = client.get("/api/officers")
    assert officers_resp.status_code == 200
    officers_data = officers_resp.json()
    assert officers_data["authentication"] is True
    officer_names = [o["officer_id"] for o in officers_data["officers"]]
    assert "Rohith Ravirala" in officer_names

    # Sign out
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200

    # /me after logout should return unauthenticated
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_after.status_code == 200
    assert me_after.json()["authenticated"] is False
