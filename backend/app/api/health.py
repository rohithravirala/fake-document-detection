"""What this deployment can actually do.

Deliberately detailed. An officer, or an evaluator, must be able to see that face
comparison is unavailable here rather than discover it by its silent absence from
a verdict. A system that hides its own gaps is not trustworthy regardless of how
good its checks are.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.app.config import get_settings
from backend.app.schemas.system import HealthOut

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthOut, summary="Deployment capabilities")
def health() -> HealthOut:
    from backend.app.services.screening import ensure_modules_loaded
    from modules.aadhaar import signature as aadhaar_signature
    from modules.common.verifier import registry
    from modules.ocr import engine_availability

    ensure_modules_loaded()
    settings = get_settings()

    return HealthOut(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        storage=settings.storage_mode,
        execution=settings.execution_mode,
        modules=registry.availability(),
        ocr_engines=engine_availability(),
        aadhaar_certificate=aadhaar_signature.available(),
        # The decisive checks — Aadhaar signature verification, PAN structure and
        # MRZ check digits — need no network. That is a selling point rather than
        # a limitation: border posts in remote areas genuinely lack connectivity.
        offline_capable=True,
    )
