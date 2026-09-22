# SVARAM — AI-Based Fake Identity & Document Screening System

**Problem Statement ID:** SIH26188 · **Organisation:** Ministry of Home Affairs
**Category:** Software · **Theme:** Blockchain & Cybersecurity
**Team:** SVARAM · Smart India Hackathon 2026

> One verdict. One reason. Evidence the officer can point at.

```bash
git clone <repo> && cd svaram-sih26188
./scripts/setup_dev.sh

./.venv/bin/python -m uvicorn backend.app.main:app --reload   # API   :8000
cd frontend && npm run dev                                    # App   :5173
```

No Docker needed. Full instructions in [`docs/SETUP.md`](docs/SETUP.md); the
containerised path is `docker compose up --build`.

| | |
|---|---|
| Backend tests | 175 passing |
| Frontend tests | 12 passing |
| Evaluation set | 17/17 verdicts, 17/17 checks, **0 false clears** |
| Screening time | 0.8 ms field-only · ~0.9 s with OCR on an image |
| Works offline | Aadhaar signature, PAN structure, MRZ check digits — all of it |

---

## Contents

1. [The problem](#1-the-problem)
2. [The question](#2-the-question)
3. [What exists today, and where it breaks](#3-what-exists-today-and-where-it-breaks)
4. [Our approach](#4-our-approach)
5. [How we close each gap](#5-how-we-close-each-gap)
6. [Architecture](#6-architecture)
7. [Technology stack](#7-technology-stack)
8. [Repository layout](#8-repository-layout)
9. [Who owns what](#9-who-owns-what)
10. [Build stages](#10-build-stages)
11. [Working agreement](#11-working-agreement)
12. [Known gaps](#12-known-gaps)
13. [Deliberate non-goals](#13-deliberate-non-goals)
14. [Data handling rule](#14-data-handling-rule)

---

## 1. The problem

At a border checkpoint or a verification counter, an officer has roughly **thirty
seconds** per person. In that window they must check the photograph, the expiry
date, the visa, and the watchlist.

Deciding whether the document *itself* is forged is the one task that does not fit.
A trained forensic examiner needs around ten minutes to do it properly.

So in practice, that check is skipped.

And a forged document is not the criminal's goal — it is the **key**. It opens a bank
account, a SIM card, a border crossing, or a fresh identity for someone already
blacklisted. Every downstream system that trusts the document inherits the forgery.

---

## 2. The question

> Can a machine answer in two seconds whether a document is genuine,
> and can the officer **trust** that answer?

Speed is the easy half.

Trust is the hard half. A system that reports *"87% likely fake"* gives an officer
nothing they can act on, and nothing they can defend afterwards in an inquiry. A
number is not a reason.

---

## 3. What exists today, and where it breaks

| Approach | Representative of | What it does well | Where it breaks |
|---|---|---|---|
| **Manual visual inspection** | The officer at the counter, today | Instant, free, already deployed | Under 30 seconds the forgery check is simply skipped. Human accuracy on a good forgery is close to chance. |
| **Forensic document examination** | State FSL, questioned-document experts | Near-certain, court-admissible | Hours to days. Cannot run at the counter. Does not scale to the volume. |
| **Commercial KYC / IDV SaaS** | Onfido, Jumio, Veriff, IDfy, Signzy, HyperVerge, AuthBridge | Polished, fast, production-ready | Returns a **probability**, not a reason. Cloud-only, so document images and biometrics leave the deployment boundary. Tuned for customer onboarding, not border control. Per-check licence cost. |
| **Government lookup portals** | UIDAI offline e-KYC / mAadhaar, NSDL & Income-Tax PAN verification, DigiLocker | Authoritative — the issuer's own record | Need live connectivity. One document at a time, manually. They confirm *a number exists in a database*, not that **this piece of paper** is genuine. Useless at a remote post. |
| **Passport reader hardware** | Regula, Access IS, Gemalto / Thales | Reliable MRZ and chip reads | Expensive dedicated hardware, passport-only. No cross-document reasoning, no cross-person reasoning. |
| **Deep-learning forgery classifiers** | Academic image-forensics CNNs | Strong on the dataset they were trained on | Trained on *synthetic* tampering. A forger using an unseen technique walks straight through. No explanation an officer can act on. Accuracy figures derived from self-generated fakes mean nothing. |
| **Blockchain document registries** | Various state and pilot programmes | Genuine provenance for newly issued documents | Requires every issuing authority to participate. Does nothing for the enormous stock of legacy documents already in circulation — which is the actual problem. |

### The six gaps this leaves

1. **A score is not evidence.** The officer cannot act on a percentage, and cannot defend it later.
2. **Cloud dependency.** Remote border posts lack connectivity — and biometric data should not leave the deployment boundary at all.
3. **Appearance-based detection is brittle.** It asks "does this look fake?", so a new technique defeats it.
4. **One document at a time.** Nothing catches one person presenting several different identities.
5. **The screening itself is not auditable.** No tamper-evident record of what was decided and why.
6. **Every document type is hard-coded.** Adding a new type is an engineering project, not a configuration change.

---

## 4. Our approach

Most systems show the document to an AI model and ask whether it looks fake.
**We do the opposite. We check each document against its own source of truth.**

Most official documents store the same information in **two places**. A forger
changes one and misses the other — because changing both would require a key that
only the issuing authority holds.

| Document | What we verify against |
|---|---|
| **Aadhaar** | The QR code is digitally signed by UIDAI. We verify the signature **offline**, then compare the signed data against the text printed on the card. |
| **PAN** | The number encodes the holder category and the first letter of the surname. We check the number against the printed name. |
| **Passport** | The machine-readable zone carries check digits and must agree with the printed data page. |
| **Visa** | Validity window, stay duration, entry rules. |

Any mismatch means the document was **altered** — and we can say so with certainty,
not probability.

### Where there is no source of truth

Older cards, photocopies and visa stamps have nothing to verify against. For those
we run tampering analysis: replaced photographs, edited text, copied stamps.

But this returns a **risk score, never a verdict**. The case goes to a human
examiner. **The system is never allowed to declare a document genuine on appearance
alone.**

### Face verification

Verifying the document is not enough — a genuine card in the wrong hands still
passes. So we compare the live face against:

- the photograph printed on the document,
- the photograph stored inside the QR or chip,
- **and every earlier screening.**

That last comparison is what catches one person operating several identities.

### What the officer sees

One verdict — **CLEAR**, **REJECT**, or **REFER**. One line explaining why. The
cropped pixels behind it.

Every screening is written to a **hash-chained log**, so the record cannot be altered
afterwards and remains usable in an investigation.

### Where the AI actually is

AI reads the document, classifies its type, extracts the fields, compares faces, and
detects tampering. **Verification then validates what the AI extracted.**

> **AI is the eyes. Verification is the judgement.** Both are needed, and they are
> not the same thing.

---

## 5. How we close each gap

| Gap in existing systems | How SVARAM closes it |
|---|---|
| **1. A score is not evidence** | Cryptographic and structural cross-verification produces a deterministic PASS / FAIL with a citation — *"the surname on the card starts with K, the PAN number encodes S"*. Not a probability. The officer can point at the failing field. |
| **2. Cloud dependency** | Aadhaar signature verification, PAN structure validation and MRZ check digits need **no network**. The face model runs locally and stores only embeddings, never images. The whole core works air-gapped — which is what a remote border post actually needs. |
| **3. Brittle appearance-based detection** | We never ask "does this look fake?" first. We ask "does the document agree with itself?" Forensics is the **fallback** for documents with no source of truth, and it can only ever raise a REFER — never a verdict, in either direction. |
| **4. One document at a time** | Every screening writes a 512-dimensional face embedding to `pgvector`. A similarity query against prior encounters runs in SQL on every case. One face, two identity numbers, surfaces immediately. |
| **5. Unauditable screening** | SHA-256 hash chain over the audit log: each record hashes its own payload plus the previous record's hash. Altering any past row breaks every hash after it. Tamper-evidence **without blockchain**, and without its operational cost. |
| **6. Hard-coded document types** | Document rules live in JSON **verification profiles** stored in the database and editable in the UI. Adding a document type is a configuration change, not a deployment. |

---

## 6. Architecture

```
┌─────────────────────────────────────────────────┐
│  BROWSER                                        │
│  React + TypeScript                             │
│  Upload, camera, live check stream, verdict UI  │
└────────────────────┬────────────────────────────┘
                     │  REST + Server-Sent Events
┌────────────────────┴────────────────────────────┐
│  API LAYER                                      │
│  FastAPI (Python)                               │
│  Routing, profile loading, verdict engine       │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
┌──────────────┐ ┌─────────┐ ┌──────────────┐
│ WORKERS      │ │ POSTGRES│ │ REDIS        │
│ RQ / Celery  │ │ cases   │ │ job queue    │
│ OCR          │ │ checks  │ │ cache        │
│ forensics    │ │ audit   │ │              │
│ face         │ │ log     │ │              │
└──────────────┘ └─────────┘ └──────────────┘
```

**Why background workers:** a full screening — OCR, QR decode, signature
verification, forensics, face comparison — takes three to eight seconds. Blocking an
HTTP request for that long makes the live check stream impossible. Submit returns a
`case_id` immediately; the worker publishes each check as it completes; the frontend
receives them over SSE.

**Why one Python service and not a Node API plus a Python analysis service:** the
OCR, forensics and face libraries are all Python. Splitting means two services, two
deployments and a network hop, for no benefit inside the timeline.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 7. Technology stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite, Tailwind, shadcn/ui, TanStack Query + Table, Zustand, react-dropzone, Recharts, Monaco |
| **Backend** | FastAPI, Pydantic v2, Uvicorn, SQLAlchemy 2, Alembic, RQ |
| **Data** | PostgreSQL 16 + JSONB + `pgvector`, Redis |
| **Document processing** | OpenCV, Pillow, PaddleOCR / docTR, Tesseract (OCR-B for MRZ), pyzbar / zxing-cpp |
| **Cryptography** | `cryptography`, pyOpenSSL, hashlib |
| **Face** | InsightFace, ONNX Runtime, `pgvector` |
| **Forensics** | ELA (OpenCV/Pillow), PyWavelets, scikit-image, ExifRead, pikepdf |
| **Tooling** | Docker Compose, pytest, Vitest, ruff, ESLint, GitHub Actions |

Full rationale — including every alternative considered and rejected — is in the
team's tech-stack document. Setup instructions go in [`docs/SETUP.md`](docs/SETUP.md).

> **Do not install everything in week 1.** Each dependency is added when its stage
> begins. A requirements file full of unused packages is a liability, not preparation.

---

## 8. Repository layout

```
.
├── backend/
│   ├── app/api/                FastAPI routes + SSE stream
│   ├── app/models/             SQLAlchemy: cases, documents, checks,
│   │                           face_encounters, audit_log, profiles
│   ├── app/schemas/            Pydantic — the API contract, executable
│   ├── app/services/           Orchestration, audit chain, profiles, storage
│   ├── app/verdict/engine.py   CLEAR / REJECT / REFER, and the four invariants
│   ├── app/workers/            RQ jobs, with an in-process fallback
│   ├── alembic/                Migrations
│   └── tests/                  149 tests
│
├── modules/                    Detection and verification
│   ├── common/                 The shared contract. Zero dependencies
│   ├── ocr/                    Quality gate, preprocessing, engines, extraction
│   ├── aadhaar/                Secure QR parsing, UIDAI signature, Verhoeff
│   ├── pan/                    Structure, category, surname initial
│   ├── passport/               ICAO check digits, MRZ, cross-field comparison
│   ├── face/                   Local embeddings, three-band comparison
│   └── forensics/              ELA, noise residual, copy-move, metadata
│
├── frontend/src/
│   ├── pages/                  Upload, Processing, Verdict, CaseList,
│   │                           Audit, Profiles
│   ├── components/             upload/ · verdict/ · layout/ · common/
│   ├── api/                    Typed client, TanStack Query hooks, SSE
│   └── mocks/                  Field-value cases that need no models
│
├── evaluation/                 17-sample set with ground truth, and the scorer
├── docs/                       Contract, architecture, setup, deployment, demo
├── scripts/                    setup_dev.sh · seed_db.py · download_models.py
├── docker-compose.yml          Postgres + pgvector, Redis, API, worker, web
└── var/                        Runtime only — database, uploads, models
```

Three module folders were added to the original plan: `passport/`, `face/` and
`forensics/`. Stages 3, 4 and 5 need them, and folding passport MRZ logic into
`aadhaar/` would have made both worse.

Each folder has its own `README.md` with scope and a definition of done.

## 9. Who owns what

| Member | Folder | Task | Difficulty | Status |
|---|---|---|---|---|
| **M1 · Rohith** | `backend/` + `modules/common/` + docker | Core, DB, queue, verdict engine | Medium | scaffolded end to end |
| **M2** | `modules/ocr/` | Extraction pipeline | Medium | working; Paddle engine unwired |
| **M3** | `modules/aadhaar/` | Secure QR + UIDAI signature | **HARD** | working against synthetic keys |
| **M4** | `frontend/` — upload side | Upload + Processing | Easy | working |
| **M5** | `modules/pan/` → `frontend/` verdict side | PAN, then Verdict + CaseList | Easy | working |
| **M6** | `evaluation/` | Samples, accuracy, demo script | Medium | 17 samples, harness in CI |
| **M7 · Ramu** | `modules/forensics/` + `backend/tests/` | Image forensics, metadata analysis & test suite | **HARD** | working, 24 tests passing |

A first working version of every module is in place, so nobody starts from an
empty folder. **What is there is a floor, not a ceiling** — each owner's real
work is in their folder's README, and the honest gaps are listed in
[§12](#12-known-gaps).

### Dependency order — read this before assigning

```
  M1: modules/common/ + docs/API_CONTRACT.md      ← EVERYTHING WAITS ON THIS
        │
        ├──→ M2  ocr/          ──→ M3  aadhaar/   (aadhaar needs OCR text to compare against)
        ├──→ M5  pan/          ──→ M5  frontend verdict side
        ├──→ M4  frontend      (starts immediately against src/mocks/, not the real API)
        └──→ M6  evaluation    (starts immediately — samples need no code)
```

**Three things that must not block:**

- **M1 ships the contract first.** Until `modules/common/` and
  `docs/API_CONTRACT.md` are merged, everyone else is guessing at shapes.
- **M4 builds against `src/mocks/`** from day one. Never idle waiting for a backend.
- **M3 confirms a real Aadhaar QR decodes in week 1.** It is the hardest item and the
  strongest claim in the project — if the signature path stalls, the field-comparison
  path still has demo value. Raise the risk early, do not sit on it.

---

## 10. Build stages

Each stage is a working product, not a layer. All five are wired end to end; the
column on the right is what is genuinely finished versus what still needs a real
document in front of it.

| Stage | Delivers | State |
|---|---|---|
| **1 · PAN** | Upload → validate → verdict → history | Complete. 37 tests over every category letter and malformed shape |
| **2 · Aadhaar** | QR decode, UIDAI signature, printed-text comparison | Crypto path complete and tested. **Needs the real UIDAI certificate and real Secure QR samples** |
| **3 · Passport** | MRZ extraction, ICAO check digits | Complete against published ICAO specimens. Chip reading is out of scope |
| **4 · Face + audit** | Local embeddings, multiple-identity search, hash chain | Audit chain complete and tested. Face code complete, **untested against real faces** — InsightFace is not installed here |
| **5 · Forensics** | Tampering signals where no source of truth exists | Implemented & tested. Covered by 24 tests over ELA, noise, copy-move, and editor metadata |

## 11. Working agreement

**Branches** — `<member>/<area>-<what>`, e.g. `m3/aadhaar-qr-decode`

**Commits** — `<area>: <what changed>`, e.g. `pan: reject unknown category letter`

**Pull requests**
- Into `main`, never push to `main` directly.
- Small and frequent. A PR open for three days is a merge conflict in waiting.
- Anything touching `modules/common/` or `docs/API_CONTRACT.md` needs **M1's review** — those shapes are everyone's foundation.

**Before you open a PR**
- [ ] `ruff check` / `eslint` clean
- [ ] Tests pass, and new logic has tests
- [ ] No real identity document anywhere in the diff
- [ ] No `.env`, key, or model weight in the diff
- [ ] Your folder's `README.md` checklist updated

**Every check you write returns `Check`, never a boolean.** Result, severity,
evidence, citation. If it cannot produce a citation, it is not a check.

---

## 12. Known gaps

Written down rather than left to be discovered. Each of these is where the next
real work is, and each is something an evaluator could find on their own.

| Gap | What it means |
|---|---|
| **No real Aadhaar QR has been verified** | The cryptographic path is proven end to end against a synthetic signing key in exactly the real byte layout. Swapping in the real UIDAI certificate changes the key and nothing else — but that swap has not happened, and until it does no claim should be made about a real card |
| **Forensic thresholds are uncalibrated** | Tuned so that clean captures produce nothing, verified over synthetic images. Sensitivity against real forgeries is unmeasured. They are set to stay quiet, which costs recall |
| **ELA and noise detect nothing on our splice fixtures** | Both stay silent on a re-saved composite. Honest limitation of the techniques, not a bug — copy-move does fire. Real samples are needed to tune this or to conclude the techniques do not earn their place |
| **Face module never run against real faces** | The code path, the three-band logic and the resolution floor are complete. InsightFace is not installed in this environment, so the module reports `unavailable` and cases route to REFER |
| **MRZ check digits do not stop a competent forger** | They are modulo 10 and recomputable. Documented at length in `modules/passport/checkdigit.py`, with a test that demonstrates it. The defence is the printed-page comparison and, properly, the signed chip |
| **PaddleOCR is wired but not installed** | The engine abstraction supports it. Only Tesseract is active here, which is weaker on Indian scripts |
| **No authentication** | `OFFICER_ID` is hard-coded. The columns exist on every case and audit record |
| **Hash chain has no external anchor** | It detects edits. An administrator with full table access could recompute the whole chain. Publishing the head hash somewhere append-only closes that |

## 13. Deliberate non-goals

Each of these is a decision, not an omission. Be ready to defend them — an evaluator
will ask.

| Not doing | Why |
|---|---|
| **Blockchain** | A hash chain gives identical tamper-evidence with none of the operational cost. Using blockchain here signals buzzword-chasing, not engineering. |
| **Cloud face APIs** | Biometric data must not leave the deployment boundary. Non-negotiable for a Ministry of Home Affairs deployment. |
| **Deep-learning forgery classifier** | No lawful training corpus exists. No explainability. An accuracy figure derived from self-generated fakes is meaningless. |
| **Microservices** | One API plus a worker pool is the correct size for this system and this timeline. |
| **Custom cryptography** | Standard libraries only. Always. |
| **MongoDB** | Cases, checks and audit records are relational. Postgres with JSONB gives flexibility exactly where it is needed. |
| **Full authentication system** | Officer identity is hard-coded for the demonstration. The screening logic is the project. |

---

## 14. Data handling rule

> **No real identity document ever enters this repository.**
>
> Not in a branch. Not "temporarily". Not renamed. Git history is permanent and this
> repository is public.
>
> Synthetic or published specimen data only. Real samples stay on one local machine,
> outside the repo. `.gitignore` blocks the obvious paths, but it is a safety net —
> not a substitute for the rule.
>
> A leaked Aadhaar image disqualifies the project and is a real harm to a real person.

The same principle is in the system design: we store **face embeddings, never face
images**. An embedding is not reversible into a usable photograph, the model runs
locally, and no biometric leaves the machine.

---

*Smart India Hackathon 2026 · SIH26188 · Ministry of Home Affairs*
