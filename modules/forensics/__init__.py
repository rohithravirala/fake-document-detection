"""Appearance-based tampering analysis. Signals only, never a verdict.

Calibration, stated plainly
---------------------------
These detectors are tuned to be **quiet**. Every threshold in this package is set
so that a clean document produces nothing, and the cost of that choice is real
sensitivity: a subtle splice can pass through without a signal.

That trade is deliberate, and it follows from where forensics sits in the system.
It runs only on documents that have no source of truth to check against — old
cards, photocopies, visa stamps. Those are the cases where the system knows the
least, so an unearned signal there does the most damage: a false REJECT costs a
traveller their journey, while a missed signal costs only what the system never
had, since forensics can never clear a document anyway.

The thresholds that ship here were set against synthetic captures. **They are not
validated against real forged documents and no accuracy claim should be made from
them.** Calibrating against the real sample set is the evaluation harness's job —
see ``evaluation/``. Until that is done, treat a forensic signal as a prompt for a
human examiner and nothing more.

What each technique can and cannot see
--------------------------------------
``ela``
    Double compression. Weak when the whole page has been re-saved at high
    quality, which homogenises the history it looks for.

``noise``
    A region whose sensor noise floor differs from the page. Measured only in
    flat areas, because on a document the residual is otherwise dominated by
    typography rather than by the sensor.

``copymove``
    Content duplicated within the same image. Capped at MEDIUM severity: a
    document legitimately repeats text, so this can raise a REFER and can never
    drive a REJECT on its own.

``metadata``
    Editing software traces. Cheap and occasionally decisive. Absence proves
    nothing — most upload paths strip EXIF.
"""

from modules.common.verifier import registry
from modules.forensics import copymove, ela, metadata, noise
from modules.forensics.signals import REPORT_THRESHOLD, Signal
from modules.forensics.verifier import ForensicsVerifier

registry.register(ForensicsVerifier())

__all__ = [
    "REPORT_THRESHOLD",
    "ForensicsVerifier",
    "Signal",
    "copymove",
    "ela",
    "metadata",
    "noise",
]
