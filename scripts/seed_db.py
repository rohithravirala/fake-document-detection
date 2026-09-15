"""Seed the database with verification profiles and demonstration cases.

    python scripts/seed_db.py             # profiles only
    python scripts/seed_db.py --demo      # profiles plus screened demo cases

The ``--demo`` cases include Aadhaar, which the frontend's own demonstration
buttons cannot offer: a Secure QR payload is tens of kilobytes and has to be
generated against a signing key. This script generates one, writes the matching
certificate where the Aadhaar module will find it, and screens both a genuine
card and a forged one so the case history has something in it before a demo
starts.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def seed_profiles() -> int:
    from backend.app.db import session_scope
    from backend.app.services import profiles

    with session_scope() as session:
        return profiles.seed(session)


def provision_certificate() -> tuple[str, Path]:
    """Generate a synthetic signing key and install its certificate.

    This is for demonstration only. In a real deployment the UIDAI public
    certificate goes in the same directory and nothing else changes.
    """
    from modules.aadhaar import testing

    generated = testing.generate()
    certs_dir = REPO_ROOT / "modules" / "aadhaar" / "certs"
    path = testing.write_certificate(
        certs_dir, generated.certificate_pem, "demo-signer.pem"
    )
    return generated.payload_text, path


def seed_demo_cases() -> int:
    from backend.app.config import get_settings
    from backend.app.db import session_scope
    from backend.app.models.case import Case, CaseStatus
    from backend.app.models.document import Document
    from backend.app.services import screening

    qr_text, certificate_path = provision_certificate()
    print(f"  demo signing certificate -> {certificate_path}")
    print("     (replace with the real UIDAI certificate for production)")

    settings = get_settings()
    cases = [
        (
            "aadhaar",
            {
                "aadhaar_qr": qr_text,
                "name": "ANITA SHARMA",
                "date_of_birth": "12/05/1990",
                "gender": "Female",
                "pincode": "500032",
                "state": "Telangana",
            },
        ),
        (
            "aadhaar",
            {"aadhaar_qr": qr_text, "name": "PRIYA VERMA", "date_of_birth": "12/05/1990"},
        ),
        ("pan", {"pan_number": "ABCPK1234X", "name": "RAHUL KUMAR"}),
        ("pan", {"pan_number": "ABCPS1234X", "name": "RAHUL KUMAR"}),
        (
            "passport",
            {
                "mrz": (
                    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
                    "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
                )
            },
        ),
    ]

    created = 0
    for doc_type, fields in cases:
        with session_scope() as session:
            case = Case(officer_id=settings.officer_id, status=CaseStatus.QUEUED)
            session.add(case)
            session.flush()
            session.add(
                Document(
                    case_id=case.id,
                    doc_type=doc_type,
                    extracted_fields=fields,
                    bboxes={},
                )
            )
            session.flush()
            result = screening.run_case(session, case.id)
            print(f"  {doc_type:9} -> {(result.verdict or '?').upper()}")
            created += 1
    return created


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demo", action="store_true", help="also screen a set of demonstration cases"
    )
    args = parser.parse_args()

    from backend.app.db import init_db

    init_db()
    print("database ready")

    added = seed_profiles()
    print(f"verification profiles: {added} added")

    if args.demo:
        print("demonstration cases:")
        created = seed_demo_cases()
        print(f"{created} cases screened")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
