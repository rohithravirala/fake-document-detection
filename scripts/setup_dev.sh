#!/usr/bin/env bash
#
# One command from a fresh clone to a running stack.
#
#   ./scripts/setup_dev.sh
#
# Sets up the zero-dependency path: SQLite, screening in-process, no Docker and
# no Redis. That is enough to exercise every check in the system. Postgres and
# RQ workers are a matter of setting DATABASE_URL and REDIS_URL afterwards.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

info() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

info "SVARAM · development setup"
echo

# ---------------------------------------------------------------- python ----
if ! command -v python3 >/dev/null 2>&1; then
  warn "python3 not found. Install Python 3.9 or newer and run this again."
  exit 1
fi

PY_VERSION="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
info "Python ${PY_VERSION}"

if [ ! -d .venv ]; then
  info "creating .venv"
  python3 -m venv .venv
fi

info "installing backend dependencies"
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r backend/requirements.txt

# ------------------------------------------------------------ system deps ----
if command -v tesseract >/dev/null 2>&1; then
  info "tesseract $(tesseract --version 2>&1 | head -1 | awk '{print $2}')"
  ./.venv/bin/pip install --quiet pytesseract
else
  warn "tesseract not found — OCR will report itself unavailable."
  warn "  macOS:  brew install tesseract"
  warn "  Debian: sudo apt-get install tesseract-ocr"
  warn "The validators still run: submit field values instead of an image."
fi

# ---------------------------------------------------------------- database ----
info "preparing the database and seeding profiles"
./.venv/bin/python scripts/seed_db.py --demo

# ---------------------------------------------------------------- frontend ----
if command -v npm >/dev/null 2>&1; then
  info "installing frontend dependencies"
  (cd frontend && npm install --silent)
else
  warn "npm not found — the frontend will not run. Install Node 20 or newer."
fi

# ------------------------------------------------------------------- checks ---
info "running the test suite"
./.venv/bin/python -m pytest -q

echo
info "ready. Two terminals:"
echo "  ./.venv/bin/python -m uvicorn backend.app.main:app --reload"
echo "  cd frontend && npm run dev"
echo
echo "  API   http://localhost:8000/docs"
echo "  App   http://localhost:5173"
echo
echo "Evaluation harness:  ./.venv/bin/python evaluation/run.py"
