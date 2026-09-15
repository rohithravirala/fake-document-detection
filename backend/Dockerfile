# Backend image: API and worker share it, differing only in the command they run.
#
# Python 3.11 rather than the 3.9 the code also supports: the code is written to
# run on either, and a container has no reason to use the older one.
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libraries the imaging and QR stack needs.
#   libgl1 / libglib2.0-0 : OpenCV runtime
#   libzbar0              : pyzbar, for dense Aadhaar Secure QR symbols
#   tesseract-ocr         : MRZ reading, constrained to the OCR-B character set
RUN apt-get update && apt-get install --no-install-recommends -y \
        libgl1 \
        libglib2.0-0 \
        libzbar0 \
        tesseract-ocr \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements first, so a code change does not invalidate the dependency layer.
COPY backend/requirements.txt backend/requirements-postgres.txt ./backend/
RUN pip install -r backend/requirements-postgres.txt pytesseract

COPY modules ./modules
COPY backend ./backend
COPY evaluation ./evaluation
COPY scripts ./scripts
COPY pyproject.toml ./

# Uploads and models are volumes in compose; these exist so the image runs
# standalone too.
RUN mkdir -p /app/var/uploads /app/var/models

# Do not run as root. A service that accepts file uploads least of all.
RUN useradd --create-home --uid 10001 svaram && chown -R svaram:svaram /app
USER svaram

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
