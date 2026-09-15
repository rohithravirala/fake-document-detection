# API Contract

**Owner:** M1 · Rohith · **Status:** implemented

The single source of truth for every shape that crosses a folder boundary.
Nothing in this repository defines its own — if the frontend reads it or a module
returns it, it is specified here first.

Executable definitions live in [`backend/app/schemas/`](../backend/app/schemas/)
(Pydantic) and [`frontend/src/api/types.ts`](../frontend/src/api/types.ts)
(TypeScript). When one changes the other changes with it.

Interactive reference while the API is running: `http://localhost:8000/docs`.

---

## The unit of everything: `Check`

A module never returns a boolean and never returns a verdict. It returns checks.

```jsonc
{
  "id": "5f3c…",
  "check_id": "aadhaar.qr_vs_printed.name",
  "check_type": "cross_field",
  "result": "fail",
  "severity": "critical",
  "citation": "The name printed on the card is 'PRIYA VERMA', but the signed QR states 'ANITA SHARMA'. The printed card contradicts the data issued for it.",
  "module": "aadhaar",
  "sequence": 7,
  "duration_ms": 12.4,
  "evidence": [
    {
      "note": "printed name contradicts the QR",
      "expected": "ANITA SHARMA",
      "observed": "PRIYA VERMA",
      "source_field": "name",
      "region": { "x": 210, "y": 340, "w": 280, "h": 42 }
    }
  ]
}
```

**`citation` is mandatory.** It is the sentence an officer reads out and the
column the database refuses to leave null. A check that cannot explain itself is
not a check, and `Check.__post_init__` raises rather than allowing one.

### `check_type` — what the evidence rests on

This is the axis the verdict engine cares about most.

| Type | Meaning | Can support CLEAR? |
|---|---|---|
| `cryptographic` | A signature from the issuing authority verified | **Yes** |
| `structural` | The document contradicts itself by arithmetic | **Yes** |
| `cross_field` | A trusted source disagrees with the printed text | **Yes** |
| `biometric` | Face comparison — identifies the bearer, not the document | No |
| `forensic` | Appearance-based tampering signal | No — and cannot return `pass` at all |
| `quality` | Capture quality gate | No |
| `policy` | Validity windows, expiry, entry rules | No |

### `result`

| Value | Meaning |
|---|---|
| `pass` | The document satisfied this check |
| `fail` | The document contradicted it |
| `inconclusive` | The check ran and the answer is genuinely uncertain |
| `unavailable` | **The check could not run.** Never a statement about the document |
| `retake` | The capture is unusable. Ask for another photograph |

`unavailable` and `fail` are different results and must never be collapsed. A
missing model is not a forgery.

### `severity`

`critical` · `high` · `medium` · `low` · `info`

A `critical` or `high` failure on any non-forensic check produces REJECT.
Everything else produces REFER at most.

---

## Endpoints

### `POST /api/cases` — submit documents

`multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `files` | file[] | One or more images or PDFs, ≤ 20 MB each |
| `doc_types` | string[] | One per file, in the same order. Optional |

Returns **202** immediately, before any screening has run:

```json
{
  "case_id": "a1b2c3…",
  "status": "queued",
  "documents": 2,
  "stream_url": "/api/cases/a1b2c3…/stream"
}
```

The request does not wait for the result. A full screening takes three to eight
seconds; holding the connection open for that would make the live stream
pointless.

**422** — unsupported file type, empty upload, or a `doc_type` this system does
not screen.

### `POST /api/cases/manual` — submit field values, no image

```json
{
  "documents": [
    { "doc_type": "pan", "fields": { "pan_number": "ABCPK1234X", "name": "RAHUL KUMAR" } }
  ]
}
```

Same 202 response. This is how the validators are demonstrated on a machine with
no OCR engine installed, and how the evaluation harness drives known inputs
through the real checks.

### `GET /api/cases/{id}` — the case and every check

```jsonc
{
  "id": "a1b2c3…",
  "status": "complete",
  "verdict": "reject",
  "reason": "The name printed on the card is 'PRIYA VERMA', but the signed QR states 'ANITA SHARMA'.",
  "duration_ms": 2410,
  "officer_id": "demo-officer-01",
  "created_at": "2026-09-15T09:12:44Z",
  "documents": [
    {
      "id": "d1…",
      "doc_type": "aadhaar",
      "image_hash": "9f86d0…",
      "image_url": "/api/cases/a1b2c3…/documents/d1…/image",
      "extracted_fields": { "name": "PRIYA VERMA", "date_of_birth": "12/05/1990" },
      "bboxes": { "name": { "x": 210, "y": 340, "w": 280, "h": 42 } },
      "checks": [ /* Check[] */ ]
    }
  ]
}
```

`verdict` is `null` until every check has finished. A partially screened case has
no verdict, not a provisional one.

**404** — no such case.

### `GET /api/cases/{id}/stream` — live results

`text/event-stream`. One event per named type:

| Event | Payload |
|---|---|
| `case.start` | `case_id`, `documents` |
| `document.start` | `document_id`, `doc_type`, `modules[]` |
| `module.start` | `document_id`, `module` |
| `check` | `document_id`, `sequence`, `check` |
| `module.complete` | `document_id`, `module`, `duration_ms`, `error` |
| `document.complete` | `document_id`, `verdict`, `reason` |
| `case.complete` | `case_id`, `verdict`, `reason`, `duration_ms`, `needs_retake` |
| `case.failed` | `case_id`, `error` |
| `case.state` | Authoritative state, always sent last |
| `timeout` | Nothing arrived for 90 seconds |

A client that connects late receives the events it missed, replayed.

**The stream is a view of progress; the database is the record.** Every stream
ends with `case.state` read fresh from the database, so a dropped event delays a
row on screen rather than losing it.

### `GET /api/cases` — history

Query: `limit` (≤ 200), `offset`, `verdict`, `status`. Returns `CaseSummary[]`,
newest first.

### `GET /api/cases/{case_id}/documents/{document_id}/image`

The stored image, so the frontend can crop evidence regions from it.

### `GET /api/profiles` · `GET|PUT /api/profiles/{doc_type}`

Verification profiles. `PUT` publishes a new version and deactivates the previous
one — a past screening can always be traced to the rules in force when it ran.

**422** on a profile with an empty `modules` list: an edit must not be able to
silently disable screening for a document type.

### `GET /api/audit` · `GET /api/audit/verify`

Audit records, and the chain integrity check:

```json
{ "intact": false, "records": 42, "broken_at": 17, "detail": "record 17 payload no longer matches its recorded hash; the stored data was edited" }
```

### `GET /api/health` — what this deployment can actually do

```json
{
  "status": "ok",
  "storage": "postgres+pgvector",
  "execution": "rq-worker",
  "modules": { "aadhaar": true, "face": false, "forensics": true, "ocr": true, "pan": true, "passport": true },
  "ocr_engines": { "paddle": false, "tesseract": true },
  "aadhaar_certificate": true,
  "offline_capable": true
}
```

`modules` is the field that matters. A system that quietly omits a check it could
not perform is not trustworthy, so the gaps are reported rather than hidden — and
the interface shows them in its header strip.

---

## Module interface

Every module implements `Verifier` from
[`modules/common/verifier.py`](../modules/common/verifier.py):

```python
class Verifier(ABC):
    name: str
    doc_types: Sequence[DocumentType] = ()  # empty means every type
    order: int = 100  # lower runs first; OCR is 10
    required: bool = True  # False -> absence reports at LOW severity

    @abstractmethod
    def verify(self, document: DocumentInput) -> ModuleResult: ...

    def available(self) -> bool: ...
```

Modules **raise**, they do not swallow. `Verifier.run()` converts
`ModuleUnavailable` into an `unavailable` check, `UnreadableDocument` into a
`retake` check, and any other exception into an `unavailable` check — so a
crashed module and a genuine document are never confused.

Fields a module extracts are appended to the input the next module receives.
That is how the Aadhaar module compares signed QR data against text the OCR
module read, without running OCR itself.

---

## Error envelope

```json
{ "detail": "human-readable explanation" }
```

`422` validation · `404` not found · `500` internal, with a body that says no
screening result should be inferred from it.
