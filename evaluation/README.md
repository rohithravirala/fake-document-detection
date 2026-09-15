# evaluation/ — samples, accuracy, demo

**Owner:** M6 · **Difficulty:** Medium

The part that makes the claims believable. Without this the project is a demo;
with it, it is a result.

## Scope

- [ ] Sample set: genuine, tampered, mismatched, unreadable — per document type
- [ ] Ground-truth labels and the script that scores a run against them
- [ ] Accuracy report: per-check precision/recall, and the REFER rate
- [ ] False-positive analysis — where the quality gate saves us
- [ ] `docs/DEMO_SCRIPT.md` and the root `README.md` results section
- [ ] Published ICAO specimen MRZ values as test vectors for M2/M3

## Hard rule

**No real identity documents in this repository.** Synthetic or published specimen
data only. Real samples stay on a local machine, outside the repo, and `.gitignore`
already blocks the obvious paths. One leaked Aadhaar image disqualifies the project
and is a genuine harm to a real person.
