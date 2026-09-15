"""Building the sample set, with ground truth attached.

Every sample here is **synthetic**. No real identity document appears in this
repository, and the accuracy figures the harness produces are figures against
this set — not against real forgeries. Saying so is the difference between a
result and a claim.

What the set does establish honestly:

* that a document whose fields agree with its source of truth is cleared,
* that each specific tampering the system claims to catch is caught,
* that a document with nothing to verify against is referred rather than cleared,
* that an unreadable capture is returned for a retake rather than judged,
* and that a missing dependency never turns into a rejection.

What it cannot establish is how the system behaves against a forgery technique
nobody here thought of. That needs a real corpus, which does not lawfully exist
for us to train or test on.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from modules.aadhaar import testing as aadhaar_testing  # noqa: E402
from modules.aadhaar.verhoeff import generate_check_digit  # noqa: E402

# ICAO Doc 9303 published specimen. Public, verifiable, and expired in 2012.
ICAO_TD3 = (
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
    "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
)


def aadhaar_number(prefix: str = "23456789012") -> str:
    return prefix[:11] + str(generate_check_digit(prefix[:11]))


@dataclass
class Sample:
    """One case, with what the system is expected to say about it."""

    name: str
    category: str
    """``genuine``, ``tampered``, ``mismatched``, ``unverifiable`` or ``degraded``."""

    doc_type: str
    fields: Dict[str, str]
    expected_verdict: str
    """``clear``, ``reject`` or ``refer``."""

    why: str
    """What this sample is testing. Printed in the report beside the result."""

    expected_checks: Dict[str, str] = field(default_factory=dict)
    """check_id -> expected result, for the checks this sample exists to exercise."""

    def as_document(self) -> Dict[str, Any]:
        return {"doc_type": self.doc_type, "fields": self.fields}


def pan_samples() -> List[Sample]:
    return [
        Sample(
            name="pan-genuine",
            category="genuine",
            doc_type="pan",
            fields={"pan_number": "ABCPK1234X", "name": "RAHUL KUMAR"},
            expected_verdict="clear",
            why="The number encodes K and the surname is KUMAR.",
            expected_checks={
                "pan.format": "pass",
                "pan.category": "pass",
                "pan.surname_initial": "pass",
            },
        ),
        Sample(
            name="pan-genuine-surname-first",
            category="genuine",
            doc_type="pan",
            fields={"pan_number": "ABCPR1234X", "name": "RAVIRALA ROHITH"},
            expected_verdict="clear",
            why="Surname written first, which is common and must not be a mismatch.",
            expected_checks={"pan.surname_initial": "pass"},
        ),
        Sample(
            name="pan-name-edited",
            category="tampered",
            doc_type="pan",
            fields={"pan_number": "ABCPS1234X", "name": "RAHUL KUMAR"},
            expected_verdict="reject",
            why="The printed name was changed; the number still encodes S.",
            expected_checks={"pan.surname_initial": "fail"},
        ),
        Sample(
            name="pan-invented-category",
            category="tampered",
            doc_type="pan",
            fields={"pan_number": "ABCZK1234X", "name": "RAHUL KUMAR"},
            expected_verdict="reject",
            why="Z is not an issued holder category, so the number was invented.",
            expected_checks={"pan.category": "fail"},
        ),
        Sample(
            name="pan-malformed",
            category="tampered",
            doc_type="pan",
            fields={"pan_number": "ABC1234XYZ", "name": "RAHUL KUMAR"},
            expected_verdict="reject",
            why="The number does not have the mandatory shape at all.",
            expected_checks={"pan.format": "fail"},
        ),
        Sample(
            name="pan-no-name-read",
            category="degraded",
            doc_type="pan",
            fields={"pan_number": "ABCPK1234X"},
            expected_verdict="refer",
            why="No name to compare against — a gap in evidence, not a forgery.",
            expected_checks={"pan.surname_initial": "inconclusive"},
        ),
    ]


def passport_samples() -> List[Sample]:
    return [
        Sample(
            name="passport-mrz-consistent",
            category="genuine",
            doc_type="passport",
            fields={
                "mrz": ICAO_TD3,
                "passport_number": "L898902C3",
                "name": "ANNA MARIA ERIKSSON",
                "nationality": "UTO",
            },
            expected_verdict="reject",
            why=(
                "Every check digit verifies and the data page agrees — but the ICAO "
                "specimen expired in 2012, so it is correctly not accepted."
            ),
            expected_checks={
                "passport.check_digit.composite": "pass",
                "passport.mrz_vs_printed.passport_number": "pass",
                "passport.expiry": "fail",
            },
        ),
        Sample(
            name="passport-number-edited-on-page",
            category="mismatched",
            doc_type="passport",
            fields={"mrz": ICAO_TD3, "passport_number": "L898902C9"},
            expected_verdict="reject",
            why="The printed data page and the MRZ state different numbers.",
            expected_checks={"passport.mrz_vs_printed.passport_number": "fail"},
        ),
        Sample(
            name="passport-mrz-digit-broken",
            category="tampered",
            doc_type="passport",
            fields={"mrz": ICAO_TD3.replace("7408122F", "7508122F")},
            expected_verdict="reject",
            why="The date of birth was edited without recomputing its check digit.",
            expected_checks={"passport.check_digit.date_of_birth": "fail"},
        ),
        Sample(
            name="passport-mrz-unreadable",
            category="degraded",
            doc_type="passport",
            fields={"mrz": "THIS IS NOT A MACHINE READABLE ZONE"},
            expected_verdict="refer",
            why="An unparseable MRZ is a capture problem, never a forgery finding.",
            expected_checks={"passport.mrz_readable": "inconclusive"},
        ),
    ]


def aadhaar_samples(qr_text: str) -> List[Sample]:
    """Samples built around one synthetic signed QR.

    The signed payload states ANITA SHARMA, 12-05-1990, Telangana, PIN 500032,
    and a reference id ending 9012.
    """
    return [
        Sample(
            name="aadhaar-genuine",
            category="genuine",
            doc_type="aadhaar",
            fields={
                "aadhaar_qr": qr_text,
                "name": "ANITA SHARMA",
                "date_of_birth": "12/05/1990",
                "gender": "Female",
                "pincode": "500032",
                "state": "Telangana",
            },
            expected_verdict="clear",
            why="The printed card agrees with everything UIDAI signed.",
            expected_checks={
                "aadhaar.qr_signature": "pass",
                "aadhaar.qr_vs_printed.name": "pass",
            },
        ),
        Sample(
            name="aadhaar-name-edited",
            category="tampered",
            doc_type="aadhaar",
            fields={
                "aadhaar_qr": qr_text,
                "name": "PRIYA VERMA",
                "date_of_birth": "12/05/1990",
            },
            expected_verdict="reject",
            why="The printed name was changed; the QR could not be re-signed.",
            expected_checks={
                "aadhaar.qr_signature": "pass",
                "aadhaar.qr_vs_printed.name": "fail",
            },
        ),
        Sample(
            name="aadhaar-dob-edited",
            category="tampered",
            doc_type="aadhaar",
            fields={
                "aadhaar_qr": qr_text,
                "name": "ANITA SHARMA",
                "date_of_birth": "12/05/1985",
            },
            expected_verdict="reject",
            why="A changed date of birth, the edit that makes a minor an adult.",
            expected_checks={"aadhaar.qr_vs_printed.date_of_birth": "fail"},
        ),
        Sample(
            name="aadhaar-qr-from-another-card",
            category="mismatched",
            doc_type="aadhaar",
            fields={
                "aadhaar_qr": qr_text,
                "name": "ANITA SHARMA",
                "aadhaar_number": aadhaar_number(),
            },
            expected_verdict="reject",
            why="A genuine QR photographed onto a card with a different number.",
            expected_checks={"aadhaar.number_vs_qr": "fail"},
        ),
        Sample(
            name="aadhaar-invalid-number",
            category="tampered",
            doc_type="aadhaar",
            fields={"aadhaar_qr": qr_text, "aadhaar_number": "123456789012"},
            expected_verdict="reject",
            why="The number fails its Verhoeff check digit, so it was never issued.",
            expected_checks={"aadhaar.number_checksum": "fail"},
        ),
    ]


def unverifiable_samples() -> List[Sample]:
    return [
        Sample(
            name="unknown-document",
            category="unverifiable",
            doc_type="unknown",
            fields={"name": "SOMEONE"},
            expected_verdict="refer",
            why=(
                "Nothing here can be checked against an issuing authority. The "
                "system must never clear this on appearance."
            ),
        ),
        Sample(
            name="visa-no-source-of-truth",
            category="unverifiable",
            doc_type="visa",
            fields={"name": "ANNA ERIKSSON", "nationality": "UTO"},
            expected_verdict="refer",
            why="Most visa stickers carry nothing verifiable. REFER is correct.",
        ),
    ]


@dataclass
class SampleSet:
    samples: List[Sample]
    certificate_pem: bytes
    qr_text: str

    def by_category(self) -> Dict[str, List[Sample]]:
        grouped: Dict[str, List[Sample]] = {}
        for sample in self.samples:
            grouped.setdefault(sample.category, []).append(sample)
        return grouped


def build(seed_photo: bytes = b"\x00" * 256) -> SampleSet:
    """Generate the full sample set and the certificate that verifies it."""
    generated = aadhaar_testing.generate(photo=seed_photo)
    samples = (
        pan_samples()
        + aadhaar_samples(generated.payload_text)
        + passport_samples()
        + unverifiable_samples()
    )
    return SampleSet(
        samples=samples,
        certificate_pem=generated.certificate_pem,
        qr_text=generated.payload_text,
    )
