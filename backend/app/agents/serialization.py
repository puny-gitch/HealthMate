from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if is_dataclass(value):
        return to_jsonable(asdict(value))
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    return str(value)


def state_snapshot(state: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = [
        "run_id",
        "user_id",
        "run_type",
        "target_date",
        "profile",
        "metrics",
        "user_memories",
        "knowledge_hits",
        "risk_blocked",
        "warnings",
        "advice_text",
        "task_candidates",
        "skipped_reasons",
        "from_cache",
        "fallback_used",
    ]
    return {key: to_jsonable(state.get(key)) for key in allowed_keys if key in state}
