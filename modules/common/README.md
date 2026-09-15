# modules/common/ — the shared contract

**Owner:** M1 · Rohith · **Difficulty:** small but blocking

The single definition of what a module receives and what it must return. Every module
in this folder speaks the same language, which is how the verdict engine can stay
generic and how a new document type becomes a configuration change.

## To define

- [x] `DocumentInput` — image path, doc type, preprocessing hints
- [x] `ExtractedField` — name, value, confidence, bounding box
- [x] `Check` — check id, type, result (PASS / FAIL / INCONCLUSIVE), severity, evidence, citation
- [x] `Evidence` — region, crop reference, human-readable note
- [x] `Verifier` — the interface every module implements
- [x] Severity levels and what each one is allowed to do to a verdict

Nothing here imports OpenCV, FastAPI or a model. Types and interfaces only.
