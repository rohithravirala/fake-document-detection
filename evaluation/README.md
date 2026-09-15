# evaluation/ — samples, accuracy, demo

**Owner:** M6 · **Difficulty:** Medium

The part that makes the claims believable. Without this the project is a demo;
with it, it is a result.

## Scope

- [x] Sample set: genuine, tampered, mismatched, unreadable — per document type
- [x] Ground-truth labels and the script that scores a run against them
- [~] Accuracy report: verdict accuracy, check accuracy, referral rate and
      false clears are reported. **Per-check precision/recall is not** — it needs
      more samples per check than 17 total to mean anything
- [ ] False-positive analysis — where the quality gate saves us
      *(needs image-based samples; every sample today is field values)*
- [x] `docs/DEMO_SCRIPT.md` and the root `README.md` results section
- [x] Published ICAO specimen MRZ values as test vectors for M2/M3

## State

17 samples across five categories, each with a stated expectation and the
specific checks it exercises. `python evaluation/run.py` scores them: currently
17/17 verdicts, 17/17 checks, zero false clears. `--strict` runs in CI, and a
false clear fails the build regardless of the flag.

The harness calls `screening.run_modules` — the same function the API uses — so
it measures the real code rather than a reimplementation that could drift.

## What is still open

**Every sample is synthetic.** These figures show each claimed check works. They
say nothing about a forgery technique nobody here thought of, and must never be
quoted as an accuracy figure. Getting that would need a real corpus, which does
not lawfully exist for us to test against.

**Forensic thresholds are uncalibrated.** They are set to stay quiet, which is
the safe direction but costs sensitivity. Calibrating them against real samples
is the single highest-value thing in this folder.

**No image-based samples.** Everything runs through field values, which exercises
the validators and the verdict engine but not OCR. Image fixtures that exercise
the quality gate and extraction are missing.

## Hard rule

**No real identity documents in this repository.** Synthetic or published specimen
data only. Real samples stay on a local machine, outside the repo, and `.gitignore`
already blocks the obvious paths. One leaked Aadhaar image disqualifies the project
and is a genuine harm to a real person.

---

`[x]` done and tested · `[~]` written but not verified against the real thing · `[ ]` not done
