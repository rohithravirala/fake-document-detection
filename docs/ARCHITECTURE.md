# Architecture

**Owner:** M1 · Rohith · **Status:** implemented

---

## The shape of a screening

```
POST /api/cases ──► case row + document rows ──► 202 {case_id}   (≈10 ms)
                            │
                            ▼
                    queue (RQ, or in-process)
                            │
                            ▼
            ┌──────── screening.run_case ────────┐
            │  per document, in registry order:  │
            │    ocr       → fields              │
            │    aadhaar / pan / passport        │
            │    face                            │
            │    forensics                       │
            │  each check: persist + publish     │
            └────────────────┬───────────────────┘
                             ▼
                      verdict.decide()
                             ▼
                 audit.append() (same transaction)
                             ▼
            SSE: check, check, … case.complete
```

Submit returns in about ten milliseconds. The screening itself takes three to
eight seconds with models loaded, and under a millisecond for the field-only path
the validators use.

---

## Why a worker and not a blocking request

A full screening is OCR, QR decoding, signature verification, forensic analysis
and face comparison. Holding an HTTP connection open for that is bad practice and
makes the live stream impossible — there is nothing to stream if the response
only arrives once everything is done.

So: submit returns a `case_id`, the worker publishes each check as it completes,
and the frontend receives them over SSE.

**RQ rather than Celery.** Enough at this scale and far less setup. Celery is the
better long-term choice and is a swap of
[`backend/app/workers/queue.py`](../backend/app/workers/queue.py).

**And a mode with no queue at all.** With `REDIS_URL` unset, screening runs in a
FastAPI background task in the API process. Identical behaviour, does not survive
a restart, and means a teammate can clone and run without Docker. Both paths call
the same `screening.run_case`.

---

## Two storage shapes, one codebase

| | Postgres | SQLite |
|---|---|---|
| Set by | `DATABASE_URL` | unset |
| JSON columns | `JSONB` | `JSON` |
| Face embeddings | `vector(512)` via pgvector | JSON array |
| Similarity search | `ORDER BY embedding <=> $1` in SQL | scan in Python |
| Background work | RQ workers | in-process tasks |

Both differences are isolated in [`backend/app/db.py`](../backend/app/db.py) as
two `TypeDecorator` classes. No model and no service knows which is active.

The SQLite path is genuinely slower for face search — linear rather than indexed
— and that is stated rather than hidden. It is a development and demonstration
convenience, not the deployment target.

---

## Schema

```sql
cases                  (id, created_at, officer_id, status, verdict, reason, duration_ms, error)
documents              (id, case_id, doc_type, image_path, image_hash,
                        extracted_fields JSONB, bboxes JSONB)
checks                 (id, document_id, sequence, check_id, check_type,
                        result, severity, citation NOT NULL, module, evidence JSONB)
face_encounters        (id, case_id, embedding vector(512), source, doc_type, doc_number, name)
audit_log              (id, sequence, timestamp, officer_id, action, case_id,
                        payload JSONB, payload_hash, previous_hash, record_hash)
verification_profiles  (id, doc_type, version, is_active, profile JSONB, updated_at)
```

**Why JSONB for `extracted_fields`, `bboxes`, `evidence` and `profile`.** These
differ completely between document types. A passport has MRZ fields; a PAN has
none. Fixed columns would mean a wide, mostly-null table that grows a column
every time a document type is added — which would make "adding a type is a
configuration change" false.

**Why `citation` is `NOT NULL`.** The database enforces the same rule the type
does. A check that cannot explain itself has no business being recorded.

---

## Verdict engine

[`backend/app/verdict/engine.py`](../backend/app/verdict/engine.py). Rules fire in
this order:

1. Any `retake` → **REFER**, with "retake the photograph". Judging an unreadable
   capture is worse than asking for another.
2. Any non-forensic `fail` at `critical` or `high` → **REJECT**.
3. No authoritative `pass` → **REFER**. This is the one that matters most:
   appearance alone can never clear a document.
4. Any open question remaining → **REFER**.
5. Otherwise → **CLEAR**.

### Four invariants

| | Enforced by |
|---|---|
| Appearance can never clear a document | rule 3 — CLEAR requires a `cryptographic`, `structural` or `cross_field` pass |
| Forensics can never reject a document | rule 2 excludes `forensic` entirely, whatever severity it carries |
| "Could not run" is not "failed" | `unavailable` routes to REFER, never toward REJECT |
| An unreadable capture gets a retake, not a verdict | rule 1 fires before everything |

Each has a test in
[`backend/tests/test_verdict.py`](../backend/tests/test_verdict.py). They are the
substance of the design: without them the system is still fast and still
explainable, and is no longer trustworthy.

### One subtlety worth knowing

A `forensic` check can never return `pass` — the type forbids it. So "no
tampering signal found" arrives as `inconclusive` on every document that ran
forensics, which is every document. Treating that as an open question made CLEAR
unreachable in practice. Rule 4 therefore excludes forensic `inconclusive`
results specifically; a forensic **failure** still blocks a clear.

---

## Audit hash chain

```python
record_hash = sha256(canonical_json(payload) + previous_record_hash)
```

Altering any past record changes its hash, which no longer matches what the next
record stored as its `previous_hash`. `verify_chain()` walks the chain and names
the first record where history stops adding up.

Canonical serialisation — sorted keys, no insignificant whitespace, ASCII
escaping — is fixed in one place. Two encodings of the same data must hash
identically or the chain reports false breaks on every read.

**This is deliberately not a blockchain.** A hash chain gives the same
tamper-evidence with none of the consensus machinery, none of the operational
cost, and no dependency on a network. Say this out loud in the presentation:
evaluators expect blockchain when they hear "tamper-evident", and explaining the
choice is better than hoping it goes unnoticed.

What a hash chain does **not** give you is distributed trust. An administrator
with write access to the whole table could recompute the entire chain. Defending
against that needs an external anchor — publishing the head hash somewhere
append-only — which is a deployment decision, not a code one.

---

## Verification profiles

Document rules live in rows, not in `if` statements:

```json
{
  "label": "Aadhaar card",
  "modules": ["ocr", "aadhaar", "face", "forensics"],
  "required_fields": ["aadhaar_number", "name"],
  "quality": { "min_sharpness": 90.0, "min_short_edge": 800, "max_clipped_ratio": 0.20 },
  "face": { "match_threshold": 0.85, "no_match_threshold": 0.60 }
}
```

Editing one publishes a new version and deactivates the previous, so a past
screening can be traced to the rules that were in force when it ran. The profile
editor screen exists to demonstrate this directly — it is the answer to the
scalability question an evaluator will ask.

---

## Module registry

Modules register themselves at import time. `registry.for_document(doc_type)`
returns the applicable ones in `order`, and the profile filters that list
further. Adding a module is a new package that registers itself; the backend does
not change.

`order` matters in one place: **OCR is 10 and runs first**, because everything
downstream compares against what it extracted.

| Module | Order | Required | What it establishes |
|---|---|---|---|
| `ocr` | 10 | yes | Quality gate, document type, printed fields with boxes |
| `pan` | 20 | yes | Structure, category letter, surname initial |
| `aadhaar` | 25 | yes | UIDAI signature, signed fields vs printed, Verhoeff |
| `passport` | 30 | yes | ICAO check digits, MRZ vs printed page, validity |
| `face` | 60 | no | Bearer vs document, printed photo vs signed photo |
| `forensics` | 70 | no | Compression, noise, copy-move, metadata |

`required = False` means the module's absence is reported at `low` severity, so
losing a bonus signal does not block a clear the way losing a source of truth
does.
