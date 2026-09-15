# modules/ocr/ — extraction pipeline

**Owner:** M2 · **Difficulty:** Medium

Turns a photograph of a document into clean text with coordinates. Everything
downstream depends on this being trustworthy, including its own confidence.

## Scope

- [x] Preprocessing: perspective correction → deskew → denoise → glare removal
- [x] **Quality gate** — Laplacian variance for blur, DPI estimate. Below threshold
      return `RETAKE`, do not analyse. This removes most false positives.
- [ ] PaddleOCR (or docTR, whichever wins on our samples) for printed zones
      *(engine abstraction supports it and prefers it when present; not installed,
      and the comparison against Tesseract has not been run)*
- [x] Tesseract with OCR-B for the MRZ, restricted to `A-Z 0-9 <`
- [x] Word-level bounding boxes returned with every field
- [x] Document type classification

## Rules

- Never strip `<` from an MRZ. It carries field boundaries.
- Return confidence with every field. A low-confidence read is not a failed check.
- Also owns `scripts/download_models.py` and `docs/SETUP.md`.

## State

Working end to end with Tesseract: quality gate, preprocessing, classification,
field extraction with bounding boxes. Measured at 96% mean confidence and 872 ms
on a synthetic card image.

## What is still open

**PaddleOCR is wired but not installed.** `engines.py` supports it and prefers it
when present; only Tesseract is active. Paddle is the stronger engine on Indian
scripts, which matters for Aadhaar cards printed in regional languages — that
comparison has not been run.

**Extraction patterns are tuned to synthetic cards.** Real cards vary in layout,
font and print quality far more than the fixtures do. Expect the labelled-value
heuristics in `extract.py` to need work against real images.

**The quality gate thresholds are defaults, not measurements.** They live in the
verification profiles, so tuning them is a configuration change — but nobody has
tuned them against real captures yet.
