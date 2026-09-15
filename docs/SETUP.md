# Setup

**Owner:** M2 · **Status:** implemented

Two paths. The first needs nothing but Python and takes about two minutes.

---

## Fast path — no Docker

```bash
git clone <repo> && cd svaram-sih26188
./scripts/setup_dev.sh
```

That creates a virtualenv, installs the backend, prepares a SQLite database,
seeds the verification profiles and a few screened demonstration cases, installs
the frontend, and runs the test suite.

Then, in two terminals:

```bash
./.venv/bin/python -m uvicorn backend.app.main:app --reload
cd frontend && npm run dev
```

| | |
|---|---|
| App | http://localhost:5173 |
| API reference | http://localhost:8000/docs |
| Capabilities | http://localhost:8000/api/health |

This path runs against SQLite with screening in-process. **Every decisive check
works here** — Aadhaar signature verification, PAN structure, MRZ check digits,
the verdict engine, the audit chain. What it does not give you is pgvector, so
the prior-encounter face search is a scan rather than an index lookup.

---

## Full path — Docker

```bash
docker compose up --build
```

Postgres 16 with pgvector, Redis, the API, an RQ worker, and the frontend behind
nginx. App on http://localhost:5173, API on http://localhost:8000.

---

## Prerequisites

| | Version | Needed for |
|---|---|---|
| Python | 3.9+ | Backend. CI tests 3.9, 3.11 and 3.12; the container uses 3.11 |
| Node | 20+ | Frontend |
| Docker | any recent | Only the full path |

Python 3.9 is supported deliberately: it is what a teammate's system Python may
be on macOS, and being blocked on a Python upgrade during a 26-day build is not a
trade worth making. The code uses `typing.Optional` and `typing.List` rather than
`X | None` for that reason.

---

## Optional dependencies

The system runs without all of these. Each module reports itself `unavailable`
when its dependency is absent, which sends cases to REFER — it never turns a
missing model into a rejection.

### OCR

Without an engine, you can still submit field values directly
(`POST /api/cases/manual`, or the buttons on the upload screen) and every
validator runs.

```bash
# Tesseract — also reads the MRZ, constrained to the OCR-B character set
brew install tesseract                      # macOS
sudo apt-get install tesseract-ocr          # Debian/Ubuntu
./.venv/bin/pip install pytesseract

# PaddleOCR — better on Indian scripts, considerably larger
./.venv/bin/pip install paddleocr paddlepaddle
./.venv/bin/python scripts/download_models.py --ocr
```

### QR decoding

OpenCV's detector is built in and handles most captures. An Aadhaar Secure QR is
around version 40 — the densest the standard allows — and `pyzbar` reads those
more reliably:

```bash
brew install zbar                           # macOS
sudo apt-get install libzbar0               # Debian/Ubuntu
./.venv/bin/pip install pyzbar
```

### Face comparison

```bash
./.venv/bin/pip install insightface onnxruntime
./.venv/bin/python scripts/download_models.py --face
```

Roughly 350 MB. The model runs locally and only embeddings are stored — no
biometric data leaves the machine, and no cloud face API is ever called.

### Forensics extras

```bash
./.venv/bin/pip install PyWavelets scikit-image pikepdf
```

The module degrades to simpler filters without them.

### Check what is installed

```bash
./.venv/bin/python scripts/download_models.py --list
curl -s localhost:8000/api/health | python3 -m json.tool
```

---

## The UIDAI certificate

Aadhaar signature verification needs UIDAI's public certificate. It is published
by UIDAI and is not a secret.

```bash
cp uidai-public.cer modules/aadhaar/certs/
# or
export AADHAAR_CERT_PATH=/path/to/uidai-public.cer
```

Without it, `aadhaar.qr_signature` reports `unavailable` — never `fail`. "We have
no certificate" and "this card is forged" are different statements and the system
will not conflate them.

`scripts/seed_db.py --demo` generates a **synthetic** signing certificate so the
cryptographic path can be demonstrated end to end. It is named `demo-signer.pem`
and is excluded by `.gitignore`: a demo signer sitting next to the real UIDAI
certificate is how a deployment ends up verifying cards against the wrong key.

---

## Verifying the install

```bash
./.venv/bin/python -m pytest -q          # 149 tests
./.venv/bin/python evaluation/run.py     # 17 samples, expect 17/17
./.venv/bin/ruff check .
cd frontend && npm test && npm run build
```

---

## Platform notes

**macOS, Apple Silicon.** `opencv-python-headless` and `onnxruntime` ship arm64
wheels. If pip tries to build OpenCV from source, your pip is too old:
`pip install --upgrade pip`.

**Debian/Ubuntu.** Headless OpenCV still needs `libgl1` and `libglib2.0-0`. The
container installs both.

**`pyzbar` reports "Unable to find zbar shared library".** The Python package is
installed but the system library is not — install `zbar` / `libzbar0` above.

**Port already in use.** `--port 8001` on uvicorn, and set
`VITE_API_TARGET=http://127.0.0.1:8001` for the frontend proxy.
