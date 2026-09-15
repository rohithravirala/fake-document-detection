"""Configuration, and the one decision that shapes local development.

The system runs in two shapes from the same code:

**Postgres + Redis** — the real deployment. ``pgvector`` does the prior-encounter
face search in SQL, and RQ workers do the screening off the request thread.

**SQLite, in-process** — a clone-and-run mode for a teammate with no Docker, and
the mode the test suite uses. Face similarity becomes a scan in Python instead of
an index lookup, which is slower and identical in result.

Nothing above this layer knows which one is active. Choosing is a matter of
setting ``DATABASE_URL`` or leaving it unset.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Everything the stack reads from the environment."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "SVARAM Document Screening"
    environment: str = Field(default="development")
    debug: bool = Field(default=True)

    # -- storage ---------------------------------------------------------
    database_url: str = Field(default="")
    """Empty means SQLite at ``var/svaram.db``, which is the zero-setup path."""

    upload_dir: Path = Field(default=REPO_ROOT / "var" / "uploads")
    model_dir: Path = Field(default=REPO_ROOT / "var" / "models")

    # -- queue -----------------------------------------------------------
    redis_url: str = Field(default="")
    """Empty means run screening jobs in-process instead of through RQ."""

    queue_name: str = Field(default="screening")

    # -- demo identity ---------------------------------------------------
    officer_id: str = Field(default="demo-officer-01")
    """No authentication system is built. See the non-goals in the README."""

    # -- behaviour -------------------------------------------------------
    max_upload_bytes: int = Field(default=20 * 1024 * 1024)
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
        ]
    )
    face_search_limit: int = Field(default=5)
    face_search_threshold: float = Field(default=0.85)

    @field_validator("upload_dir", "model_dir", mode="before")
    @classmethod
    def _expand(cls, value: object) -> object:
        if isinstance(value, str) and value:
            return Path(os.path.expanduser(value))
        return value

    # -- derived ---------------------------------------------------------

    @property
    def resolved_database_url(self) -> str:
        """The URL actually used, defaulting to SQLite under ``var/``."""
        if self.database_url:
            return self.database_url
        target = REPO_ROOT / "var" / "svaram.db"
        target.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{target}"

    @property
    def is_postgres(self) -> bool:
        return self.resolved_database_url.startswith(
            ("postgresql", "postgres://", "postgresql+")
        )

    @property
    def use_queue(self) -> bool:
        """Whether screening runs through RQ rather than in-process."""
        return bool(self.redis_url)

    @property
    def storage_mode(self) -> str:
        return "postgres+pgvector" if self.is_postgres else "sqlite"

    @property
    def execution_mode(self) -> str:
        return "rq-worker" if self.use_queue else "in-process"

    def ensure_directories(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.model_dir.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings. Call ``get_settings.cache_clear()`` in tests."""
    settings = Settings()
    settings.ensure_directories()
    return settings
