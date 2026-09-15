"""The rules that turn checks into CLEAR, REJECT or REFER."""

from backend.app.verdict.engine import VerdictResult, combine, decide

__all__ = ["VerdictResult", "combine", "decide"]
