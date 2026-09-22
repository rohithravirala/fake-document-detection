# modules/forensics/ — tampering signals, never a verdict

**Owner:** Gaddam Ramu · **Difficulty:** HARD to do honestly
**Status:** implemented with 24 dedicated tests (175 total in backend), expanded editor signatures, and tamper risk aggregation

Not in the original folder plan; stage 5 needs it.

This runs only on documents with **no source of truth** — old cards, photocopies,
visa stamps. Everything else is decided by arithmetic and signatures long before
appearance is considered.

## What is implemented

- [x] **Comprehensive test suite** (`backend/tests/test_forensics.py` - 24 passing tests)
- [x] **Core invariant enforcement**:
      - Forensic checks can never return PASS (enforced in `Check.__post_init__`)
      - Forensic checks can never drive REJECT directly in verdict engine (routes to REFER)
- [x] **Metadata detection**:
      - Image editing tools (Photoshop, Canva, Photopea, GIMP, Figma, Procreate, Pixlr)
      - Online document manipulation platforms (Sejda, iLovePDF, SmallPDF, PDF2Go)
      - Benign scanner whitelist (Epson, Canon, HP, Scansnap)
      - EXIF timestamp divergence (`DateTimeOriginal` vs `DateTime`)
      - PDF incremental-update revision tracking and producer checks
- [x] **Tamper risk aggregation**:
      - `aggregate_tampering_risk` helper evaluating multi-detector findings into officer-facing risk tiers
- [x] **Error Level Analysis (ELA)**, **noise residual**, and **copy-move** detectors

## The contract

**A forensic check can never return PASS.** `Check.__post_init__` raises if one
tries. Absence of a detectable signal is not evidence of authenticity, and
reporting it as a pass is how an appearance-based system ends up clearing a good
forgery.

**A forensic check can never produce REJECT.** The verdict engine excludes
forensics from the rejection path entirely, whatever severity a signal carries.
It can raise a REFER. That is the ceiling.

Both are enforced in two places — the type and the engine — because the
consequence of getting it wrong is a traveller stopped on the strength of a
texture statistic.

## Techniques

| | Detects | Blind to |
|---|---|---|
| `ela` | Double compression from a pasted region | A page re-saved at high quality, which homogenises the history |
| `noise` | A region whose sensor noise differs | Anything on a heavily processed capture |
| `copymove` | Content duplicated within the image | Nothing much — but capped at MEDIUM, since documents legitimately repeat text |
| `metadata` | Editing software traces | Everything, when EXIF was stripped — which most upload paths do |

## Calibration — read this before quoting any number

Thresholds are set so a clean capture produces **nothing**. Verified over five
independent synthetic captures: zero false positives. The cost is sensitivity —
a subtle splice passes without a signal.

That trade is deliberate. Forensics runs where the system knows least, so a false
signal there does the most damage, and a missed one costs only what the system
never had.

**These thresholds were set against synthetic images and are not validated
against real forgeries. No accuracy claim should be made from them.**

## What is still open

- [ ] **Calibrate against real samples.** The highest-value work in this folder
- [ ] ELA and noise detect nothing on the current splice fixtures. Either tune
      them against real data or conclude they do not earn their place. Copy-move
      does fire correctly
- [ ] Template deviation — layout elements shifted from reference positions

## Why no deep learning here

No lawful training corpus of real forged Indian identity documents. No
explainability — an officer cannot act on an activation. And an accuracy figure
derived from fakes we generated ourselves, evaluated on fakes we generated
ourselves, would be measuring us against us.
