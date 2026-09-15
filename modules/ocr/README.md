# modules/ocr/ — extraction pipeline

**Owner:** M2 · **Difficulty:** Medium

Turns a photograph of a document into clean text with coordinates. Everything
downstream depends on this being trustworthy, including its own confidence.

## Scope

- [ ] Preprocessing: perspective correction → deskew → denoise → glare removal
- [ ] **Quality gate** — Laplacian variance for blur, DPI estimate. Below threshold
      return `RETAKE`, do not analyse. This removes most false positives.
- [ ] PaddleOCR (or docTR, whichever wins on our samples) for printed zones
- [ ] Tesseract with OCR-B for the MRZ, restricted to `A-Z 0-9 <`
- [ ] Word-level bounding boxes returned with every field
- [ ] Document type classification

## Rules

- Never strip `<` from an MRZ. It carries field boundaries.
- Return confidence with every field. A low-confidence read is not a failed check.
- Also owns `scripts/download_models.py` and `docs/SETUP.md`.
