"""Document reading: quality gate, preprocessing, recognition, extraction."""

from modules.common.verifier import registry
from modules.ocr.engines import availability as engine_availability
from modules.ocr.engines import best_engine
from modules.ocr.extract import classify, extract_fields, extract_mrz_block
from modules.ocr.quality import QualityReport, assess
from modules.ocr.verifier import OcrVerifier

registry.register(OcrVerifier())

__all__ = [
    "OcrVerifier",
    "QualityReport",
    "assess",
    "best_engine",
    "classify",
    "engine_availability",
    "extract_fields",
    "extract_mrz_block",
]
