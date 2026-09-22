"""Tests for modules/forensics — tampering signals and verification invariants.

Owner: Gaddam Ramu
Scope:
- Signal strength bounding, serialization, and thresholding
- System invariant: Forensic check can NEVER return PASS
- System invariant: Forensic check can NEVER directly cause REJECT
- ForensicsVerifier execution across clean, missing, and tampered documents
- Metadata extraction for benign scanners vs editing software (Photoshop, Canva, Photopea)
- Copy-move, ELA, and noise analysis baseline behaviour
- Tamper risk aggregation across detectors
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from backend.app.verdict import decide
from modules.common.types import (
    BBox,
    Check,
    CheckResult,
    CheckType,
    DocumentInput,
    DocumentType,
    Severity,
    Verdict,
    failed,
)
from modules.forensics import copymove, ela, metadata, noise
from modules.forensics.signals import (
    Signal,
    aggregate_tampering_risk,
)
from modules.forensics.verifier import ForensicsVerifier, _severity_for

# -- 1. Signal creation, bounding & serialization ---------------------------


def test_signal_clamping():
    s_low = Signal(kind="test", strength=-0.5, note="below zero")
    assert s_low.strength == 0.0

    s_high = Signal(kind="test", strength=1.5, note="above one")
    assert s_high.strength == 1.0

    s_valid = Signal(kind="test", strength=0.72, note="normal")
    assert s_valid.strength == 0.72


def test_signal_to_dict():
    bbox = BBox(x=10, y=20, w=100, h=50)
    sig = Signal(
        kind="copy_move",
        strength=0.6789,
        note="duplicated block",
        region=bbox,
        detail={"matched_pairs": 42},
    )
    data = sig.to_dict()
    assert data["type"] == "copy_move"
    assert data["strength"] == 0.679
    assert data["note"] == "duplicated block"
    assert data["region"] == {"x": 10, "y": 20, "w": 100, "h": 50}
    assert data["detail"]["matched_pairs"] == 42


# -- 2. Severity mapping ----------------------------------------------------


@pytest.mark.parametrize(
    ("strength", "expected_severity"),
    [
        (0.95, Severity.HIGH),
        (0.80, Severity.HIGH),
        (0.79, Severity.MEDIUM),
        (0.55, Severity.MEDIUM),
        (0.54, Severity.LOW),
        (0.10, Severity.LOW),
        (0.00, Severity.LOW),
    ],
)
def test_severity_thresholds(strength, expected_severity):
    assert _severity_for(strength) == expected_severity


# -- 3. Architectural Invariant: Forensic check can NEVER return PASS -------


def test_forensic_check_cannot_pass():
    """Check.__post_init__ strictly forbids CheckType.FORENSIC with CheckResult.PASS.

    Absence of a tampering signal is never proof that a document is genuine.
    """
    with pytest.raises(ValueError, match="cannot return PASS"):
        Check(
            check_id="forensics.test",
            check_type=CheckType.FORENSIC,
            result=CheckResult.PASS,
            citation="This should fail",
            severity=Severity.LOW,
            module="forensics",
        )


# -- 4. Architectural Invariant: Forensics can NEVER drive REJECT ----------


def test_forensics_failure_never_causes_reject():
    """Even a high-severity forensic failure routes to REFER, never REJECT."""
    from modules.common.types import passed

    failing_forensic = failed(
        check_id="forensics.metadata_editor",
        check_type=CheckType.FORENSIC,
        citation="Edited with Adobe Photoshop.",
        severity=Severity.HIGH,
        module="forensics",
    )

    # Case A: Forensic failure alone
    verdict_alone = decide([failing_forensic])
    assert verdict_alone.verdict.value == "refer"
    assert verdict_alone.verdict != Verdict.REJECT

    # Case B: Authoritative pass + forensic failure
    auth_pass = passed(
        check_id="pan.format",
        check_type=CheckType.STRUCTURAL,
        citation="The PAN format is valid.",
        severity=Severity.CRITICAL,
        module="pan",
    )
    verdict_mixed = decide([auth_pass, failing_forensic])
    assert verdict_mixed.verdict.value == "refer"
    assert "examiner" in verdict_mixed.reason.lower()
    assert verdict_mixed.verdict != Verdict.CLEAR
    assert verdict_mixed.verdict != Verdict.REJECT


# -- 5. ForensicsVerifier execution & edge cases ----------------------------


def test_verifier_without_image():
    verifier = ForensicsVerifier()
    doc = DocumentInput(doc_type=DocumentType.PAN, fields=[])
    result = verifier.verify(doc)

    assert result.module == "forensics"
    assert len(result.checks) == 1
    assert result.checks[0].check_id == "forensics.source"
    assert result.checks[0].result == CheckResult.INCONCLUSIVE
    assert "No image was supplied" in result.checks[0].citation


def test_verifier_with_nonexistent_image():
    verifier = ForensicsVerifier()
    doc = DocumentInput(
        doc_type=DocumentType.PAN,
        fields=[],
        image_path="/nonexistent/path/to/image.jpg",
    )
    result = verifier.verify(doc)

    assert result.module == "forensics"
    assert len(result.checks) == 1
    assert result.checks[0].check_id == "forensics.source"
    assert result.checks[0].result == CheckResult.INCONCLUSIVE
    assert "could not be opened" in result.checks[0].citation


def test_verifier_clean_image(tmp_path):
    """A clean image with uniform noise/texture produces no reportable signal and returns INCONCLUSIVE summary."""
    img_path = tmp_path / "clean.png"
    # Create a simple synthetic document image
    img = Image.new("RGB", (300, 200), color=(245, 245, 245))
    img.save(str(img_path))

    verifier = ForensicsVerifier()
    doc = DocumentInput(
        doc_type=DocumentType.PAN,
        fields=[],
        image_path=str(img_path),
    )
    result = verifier.verify(doc)

    assert result.module == "forensics"
    assert len(result.checks) == 1
    summary = result.checks[0]
    assert summary.check_id == "forensics.summary"
    assert summary.result == CheckResult.INCONCLUSIVE
    assert "found no significant signal" in summary.citation
    assert "This is not evidence that the document is genuine" in summary.citation


# -- 6. Metadata Analysis ---------------------------------------------------


def test_metadata_detects_editors(tmp_path):
    """Saving with editor signatures triggers metadata_editor signal."""
    for editor_name in ["Adobe Photoshop 2024", "Canva Desktop", "Photopea Web App", "GIMP 2.10"]:
        img_path = tmp_path / f"edited_{editor_name.split()[0]}.jpg"
        img = Image.new("RGB", (100, 100), color="white")
        exif = img.getexif()
        # Exif tag 305 is 'Software'
        exif[305] = editor_name
        img.save(str(img_path), exif=exif)

        signals = metadata.analyse(str(img_path))
        editor_signals = [s for s in signals if s.kind == "metadata_editor"]
        assert len(editor_signals) == 1, f"Failed to detect editor: {editor_name}"
        assert editor_signals[0].strength == 0.7
        assert editor_name in editor_signals[0].note


def test_metadata_ignores_benign_scanners(tmp_path):
    """Hardware scanners and cameras must not be flagged as tampering editors."""
    img_path = tmp_path / "scanned.jpg"
    img = Image.new("RGB", (100, 100), color="white")
    exif = img.getexif()
    exif[305] = "Epson Perfection V600 Scanner"
    img.save(str(img_path), exif=exif)

    signals = metadata.analyse(str(img_path))
    editor_signals = [s for s in signals if s.kind == "metadata_editor"]
    assert len(editor_signals) == 0


def test_metadata_detects_timestamp_discrepancy(tmp_path):
    """A discrepancy between DateTimeOriginal and DateTime is captured as context."""
    img_path = tmp_path / "timestamp_diff.jpg"
    img = Image.new("RGB", (100, 100), color="white")
    exif = img.getexif()
    # 36867: DateTimeOriginal, 306: DateTime
    exif[36867] = "2024:01:10 10:00:00"
    exif[306] = "2026:09:22 14:00:00"
    img.save(str(img_path), exif=exif)

    signals = metadata.analyse(str(img_path))
    time_signals = [s for s in signals if s.kind == "metadata_modified"]
    assert len(time_signals) == 1
    assert time_signals[0].strength == 0.35


# -- 7. ELA, Noise, and Copy-Move baseline tests ----------------------------


def test_ela_on_flat_image():
    """Flat uniform images do not trigger false positive ELA signals."""
    flat = np.full((150, 150, 3), 200, dtype=np.uint8)
    signals = ela.analyse(flat)
    assert len(signals) == 0


def test_noise_on_uniform_image():
    """Uniform images produce no false positive noise discrepancy signals."""
    uniform = np.full((200, 200, 3), 180, dtype=np.uint8)
    signals = noise.analyse(uniform)
    assert len(signals) == 0


def test_copymove_on_featureless_image():
    """Featureless images do not trigger copy-move findings."""
    blank = np.zeros((200, 200, 3), dtype=np.uint8)
    signals = copymove.analyse(blank)
    assert len(signals) == 0


# -- 8. Tamper Risk Aggregation ---------------------------------------------


def test_aggregate_tampering_risk_clean():
    summary = aggregate_tampering_risk([])
    assert summary.risk_level == "clean"
    assert summary.max_strength == 0.0
    assert summary.reportable_count == 0
    assert "No anomalous forensic signals" in summary.recommendation


def test_aggregate_tampering_risk_low():
    weak_signal = Signal(kind="metadata_modified", strength=0.35, note="Timestamp shifted")
    summary = aggregate_tampering_risk([weak_signal])
    assert summary.risk_level == "low_risk"
    assert summary.max_strength == 0.35
    assert summary.reportable_count == 0


def test_aggregate_tampering_risk_suspicious():
    reportable_signal = Signal(kind="metadata_editor", strength=0.70, note="Canva edited")
    summary = aggregate_tampering_risk([reportable_signal])
    assert summary.risk_level == "suspicious"
    assert summary.reportable_count == 1
    assert "Refer to questioned-document examiner" in summary.recommendation


def test_aggregate_tampering_risk_high():
    high_signal = Signal(kind="copy_move", strength=0.85, note="Cloned text region")
    summary = aggregate_tampering_risk([high_signal])
    assert summary.risk_level == "high_risk"
    assert "Mandatory physical inspection required" in summary.recommendation
