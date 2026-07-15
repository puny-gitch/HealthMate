from __future__ import annotations

from typing import Any, TypedDict


class HealthAgentState(TypedDict, total=False):
    run_id: int
    user_id: int
    run_type: str
    force: bool
    target_date: str
    max_tasks: int
    profile: dict[str, Any] | None
    recent_records: list[dict[str, Any]]
    task_history: list[dict[str, Any]]
    today_tasks: list[dict[str, Any]]
    latest_summary: dict[str, Any] | None
    latest_advice: str | None
    metrics: dict[str, Any]
    memory_query: str
    user_memories: list[dict[str, Any]]
    knowledge_query: str
    knowledge_hits: list[dict[str, Any]]
    knowledge_context: str
    risk_blocked: bool
    warnings: list[str]
    advice_text: str
    advice_tasks: list[dict[str, Any]]
    task_candidates: list[dict[str, Any]]
    skipped_reasons: list[str]
    from_cache: bool
    fallback_used: bool
    output: dict[str, Any]
