"""Test fixtures.

``DATABASE_URL`` is set before any backend module is imported, because
``backend.app.db`` builds its engine at import time. Importing first and
patching afterwards would leave the real database wired up.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

_TMP = Path(tempfile.mkdtemp(prefix="svaram-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
os.environ["UPLOAD_DIR"] = str(_TMP / "uploads")
os.environ["MODEL_DIR"] = str(_TMP / "models")
os.environ["REDIS_URL"] = ""
os.environ.pop("AADHAAR_CERT_PATH", None)

import pytest  # noqa: E402

from backend.app.db import SessionLocal, init_db  # noqa: E402
from backend.app.services import profiles as profile_service  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    init_db()
    with SessionLocal() as session:
        profile_service.seed(session)
        session.commit()


@pytest.fixture()
def session():
    """A session that rolls nothing back — tests assert on persisted state."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def clean_audit(session):
    """Empty the audit log so chain tests start from the genesis hash."""
    from backend.app.models.audit import AuditLog

    session.query(AuditLog).delete()
    session.commit()
    yield session
    session.query(AuditLog).delete()
    session.commit()


@pytest.fixture(scope="session")
def tmp_root() -> Path:
    return _TMP


@pytest.fixture(scope="session")
def client():
    """FastAPI test client with the app's lifespan run."""
    from fastapi.testclient import TestClient

    from backend.app.main import app

    with TestClient(app) as test_client:
        yield test_client
