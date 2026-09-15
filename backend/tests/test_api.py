"""End-to-end through the HTTP API.

These drive the real code path — real modules, real verdict engine, real audit
chain — rather than mocks, so a regression anywhere between the route and the
database shows up here.
"""

from __future__ import annotations

import io

import pytest

from modules.aadhaar import testing as aadhaar_testing


def submit_manual(client, documents):
    response = client.post("/api/cases/manual", json={"documents": documents})
    assert response.status_code == 202, response.text
    return response.json()["case_id"]


def fetch(client, case_id):
    response = client.get(f"/api/cases/{case_id}")
    assert response.status_code == 200, response.text
    return response.json()


# -- health ---------------------------------------------------------------


def test_health_reports_what_this_deployment_can_do(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["storage"] in ("sqlite", "postgres+pgvector")
    assert body["execution"] in ("in-process", "rq-worker")
    # Every module must be listed, present or not — silent absence is the thing
    # this endpoint exists to prevent.
    for module in ("aadhaar", "face", "forensics", "ocr", "pan", "passport"):
        assert module in body["modules"]
    assert body["offline_capable"] is True


# -- PAN, the stage 1 path ------------------------------------------------


def test_valid_pan_is_cleared(client):
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "pan",
                "fields": {"pan_number": "ABCPK1234X", "name": "RAHUL KUMAR"},
            }
        ],
    )
    case = fetch(client, case_id)
    assert case["status"] == "complete"
    assert case["verdict"] == "clear"
    assert case["reason"]


def test_pan_surname_mismatch_is_rejected_with_a_citation(client):
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "pan",
                "fields": {"pan_number": "ABCPS1234X", "name": "RAHUL KUMAR"},
            }
        ],
    )
    case = fetch(client, case_id)
    assert case["verdict"] == "reject"
    assert "RAHUL KUMAR" in case["reason"]

    failures = [
        check
        for document in case["documents"]
        for check in document["checks"]
        if check["result"] == "fail"
    ]
    assert failures
    for failure in failures:
        assert failure["citation"].strip()
        assert failure["evidence"]


def test_malformed_pan_is_rejected(client):
    case_id = submit_manual(
        client, [{"doc_type": "pan", "fields": {"pan_number": "NOTAPAN", "name": "X Y"}}]
    )
    assert fetch(client, case_id)["verdict"] == "reject"


# -- Aadhaar --------------------------------------------------------------


@pytest.fixture()
def certificate(tmp_path_factory, monkeypatch):
    generated = aadhaar_testing.generate()
    path = aadhaar_testing.write_certificate(
        tmp_path_factory.mktemp("certs"), generated.certificate_pem
    )
    monkeypatch.setenv("AADHAAR_CERT_PATH", str(path))
    return generated


def test_genuine_aadhaar_is_cleared(client, certificate):
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "aadhaar",
                "fields": {
                    "aadhaar_qr": certificate.payload_text,
                    "name": "ANITA SHARMA",
                    "date_of_birth": "12/05/1990",
                    "gender": "Female",
                    "pincode": "500032",
                },
            }
        ],
    )
    case = fetch(client, case_id)
    assert case["verdict"] == "clear"

    signature_checks = [
        check
        for document in case["documents"]
        for check in document["checks"]
        if check["check_id"] == "aadhaar.qr_signature"
    ]
    assert signature_checks[0]["result"] == "pass"
    assert signature_checks[0]["check_type"] == "cryptographic"


def test_aadhaar_with_an_edited_name_is_rejected(client, certificate):
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "aadhaar",
                "fields": {
                    "aadhaar_qr": certificate.payload_text,
                    "name": "PRIYA VERMA",
                },
            }
        ],
    )
    case = fetch(client, case_id)
    assert case["verdict"] == "reject"
    assert "ANITA SHARMA" in case["reason"]


# -- passport -------------------------------------------------------------

TD3 = (
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
    "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
)


def test_passport_mrz_check_digits_run_through_the_api(client):
    case_id = submit_manual(client, [{"doc_type": "passport", "fields": {"mrz": TD3}}])
    case = fetch(client, case_id)

    digit_checks = [
        check
        for document in case["documents"]
        for check in document["checks"]
        if check["check_id"].startswith("passport.check_digit")
    ]
    assert len(digit_checks) == 5
    assert all(check["result"] == "pass" for check in digit_checks)
    # The ICAO specimen expired in 2012, so the case is not clear.
    assert case["verdict"] == "reject"


def test_printed_page_contradicting_the_mrz_is_rejected(client):
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "passport",
                "fields": {"mrz": TD3, "passport_number": "L898902C9"},
            }
        ],
    )
    assert fetch(client, case_id)["verdict"] == "reject"


# -- the REFER path -------------------------------------------------------


def test_a_document_with_no_source_of_truth_is_referred_not_cleared(client):
    """The invariant, observed end to end: appearance cannot clear."""
    case_id = submit_manual(
        client, [{"doc_type": "unknown", "fields": {"name": "SOMEONE"}}]
    )
    case = fetch(client, case_id)
    assert case["verdict"] == "refer"


# -- uploads --------------------------------------------------------------


def test_unsupported_file_type_is_refused(client):
    response = client.post(
        "/api/cases",
        files={
            "files": ("payload.exe", io.BytesIO(b"MZ..."), "application/octet-stream")
        },
    )
    assert response.status_code == 422
    assert "supported" in response.json()["detail"]


def test_image_upload_screens_and_returns_a_case(client):
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (1200, 760), (240, 240, 235)).save(buffer, "PNG")
    buffer.seek(0)

    response = client.post(
        "/api/cases",
        files={"files": ("card.png", buffer, "image/png")},
        data={"doc_types": ["pan"]},
    )
    assert response.status_code == 202, response.text
    case_id = response.json()["case_id"]

    case = fetch(client, case_id)
    assert case["status"] == "complete"
    # A blank image cannot be cleared under any circumstance.
    assert case["verdict"] in ("refer", "reject")
    assert case["documents"][0]["image_hash"]


# -- case list ------------------------------------------------------------


def test_case_list_returns_history(client):
    submit_manual(
        client, [{"doc_type": "pan", "fields": {"pan_number": "ABCPK1234X", "name": "K"}}]
    )
    cases = client.get("/api/cases?limit=10").json()
    assert cases
    assert {"id", "verdict", "status", "created_at"} <= set(cases[0])


def test_filtering_by_verdict(client):
    rejected = client.get("/api/cases?verdict=reject").json()
    assert all(case["verdict"] == "reject" for case in rejected)


def test_unknown_case_is_404(client):
    assert client.get("/api/cases/doesnotexist").status_code == 404


# -- profiles -------------------------------------------------------------


def test_profiles_are_seeded_and_editable(client):
    profiles = client.get("/api/profiles").json()
    doc_types = {profile["doc_type"] for profile in profiles}
    assert {"aadhaar", "pan", "passport"} <= doc_types

    current = client.get("/api/profiles/pan").json()
    updated = dict(current["profile"])
    updated["quality"] = {**updated.get("quality", {}), "min_sharpness": 75.0}

    response = client.put("/api/profiles/pan", json={"profile": updated})
    assert response.status_code == 200
    assert response.json()["version"] == current["version"] + 1


def test_a_profile_that_would_run_no_checks_is_refused(client):
    """Editing the rules must not be able to silently disable screening."""
    response = client.put("/api/profiles/pan", json={"profile": {"modules": []}})
    assert response.status_code == 422


# -- audit ----------------------------------------------------------------


def test_every_screening_is_recorded_and_the_chain_verifies(client):
    submit_manual(
        client, [{"doc_type": "pan", "fields": {"pan_number": "ABCPK1234X", "name": "K"}}]
    )
    status = client.get("/api/audit/verify").json()
    assert status["intact"] is True
    assert status["records"] > 0

    records = client.get("/api/audit?limit=5").json()
    assert records
    assert {"record_hash", "previous_hash", "payload_hash"} <= set(records[0])


def test_printed_values_are_not_overwritten_by_signed_ones(client, certificate):
    """Regression: the officer's screen showed the signed name, not the printed one.

    Both the printed card and the signed QR publish a field called `name`. The
    QR module runs after OCR, so a plain dict merge replaced what was read off
    the document with what UIDAI signed — and the verdict screen then showed
    ANITA SHARMA beside a card that reads PRIYA VERMA, hiding the very
    contradiction the screening had just found.
    """
    case_id = submit_manual(
        client,
        [
            {
                "doc_type": "aadhaar",
                "fields": {"aadhaar_qr": certificate.payload_text, "name": "PRIYA VERMA"},
            }
        ],
    )
    case = fetch(client, case_id)
    document = case["documents"][0]

    assert document["extracted_fields"]["name"] == "PRIYA VERMA"

    # The signed value is still available, as the evidence behind the failure.
    mismatch = next(
        check
        for check in document["checks"]
        if check["check_id"] == "aadhaar.qr_vs_printed.name"
    )
    assert mismatch["evidence"][0]["expected"] == "ANITA SHARMA"
    assert mismatch["evidence"][0]["observed"] == "PRIYA VERMA"


def test_timestamps_carry_a_timezone(client):
    """Regression: every case looked hours old the moment it was screened.

    SQLite has no timezone type, so a UTC timestamp came back naive and
    serialised without an offset. A browser then read it as local time — in IST
    that is UTC+5:30, so a case screened a second ago rendered as "6 hours ago".
    """
    submit_manual(
        client, [{"doc_type": "pan", "fields": {"pan_number": "ABCPK1234X", "name": "K"}}]
    )

    case = client.get("/api/cases?limit=1").json()[0]
    assert case["created_at"].endswith("Z") or "+" in case["created_at"][10:], (
        f"created_at has no timezone offset: {case['created_at']}"
    )

    record = client.get("/api/audit?limit=1").json()[0]
    assert record["timestamp"].endswith("Z") or "+" in record["timestamp"][10:]
