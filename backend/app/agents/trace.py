from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session

from app.agents.serialization import to_jsonable
from app.models.agent_trace import AgentRetrievalHit, AgentRun, AgentStep, AgentToolCall
from app.repositories.agent_repository import AgentRepository


class AgentTraceRecorder:
    def __init__(self, db: Session):
        self.db = db
        self.repository = AgentRepository()

    def start_run(self, user_id: int, run_type: str, input_snapshot: dict[str, Any]) -> AgentRun:
        return self.repository.create_run(
            self.db,
            AgentRun(
                user_id=user_id,
                run_type=run_type,
                status="running",
                input_snapshot=to_jsonable(input_snapshot),
            ),
        )

    def finish_run(
        self,
        run: AgentRun,
        status: str,
        output_snapshot: dict[str, Any] | None,
        started_at: float,
        fallback_used: bool = False,
        error_message: str | None = None,
    ) -> AgentRun:
        run.status = status
        run.output_snapshot = to_jsonable(output_snapshot)
        run.latency_ms = round((time.perf_counter() - started_at) * 1000, 2)
        run.fallback_used = fallback_used
        run.error_message = error_message
        return self.repository.save_run(self.db, run)

    def record_step(
        self,
        run_id: int,
        step_name: str,
        step_type: str,
        status: str,
        input_json: dict[str, Any] | None,
        output_json: dict[str, Any] | None,
        latency_ms: float,
        error_message: str | None = None,
    ) -> AgentStep:
        return self.repository.create_step(
            self.db,
            AgentStep(
                run_id=run_id,
                step_name=step_name,
                step_type=step_type,
                status=status,
                input_json=to_jsonable(input_json),
                output_json=to_jsonable(output_json),
                latency_ms=round(latency_ms, 2),
                error_message=error_message,
            ),
        )

    def record_tool_call(
        self,
        run_id: int,
        step_id: int | None,
        tool_name: str,
        arguments_json: dict[str, Any] | None,
        result_json: dict[str, Any] | None,
        latency_ms: float,
        success: bool = True,
        error_message: str | None = None,
    ) -> AgentToolCall:
        return self.repository.create_tool_call(
            self.db,
            AgentToolCall(
                run_id=run_id,
                step_id=step_id,
                tool_name=tool_name,
                arguments_json=to_jsonable(arguments_json),
                result_json=to_jsonable(result_json),
                latency_ms=round(latency_ms, 2),
                success=success,
                error_message=error_message,
            ),
        )

    def record_retrieval_hits(self, run_id: int, hits: list[dict[str, Any]]) -> None:
        records = [
            AgentRetrievalHit(
                run_id=run_id,
                source=str(hit.get("source") or "unknown"),
                title=str(hit.get("title") or "knowledge"),
                score=float(hit["score"]) if hit.get("score") is not None else None,
                content_preview=str(hit.get("content") or "")[:500],
            )
            for hit in hits
        ]
        self.repository.create_retrieval_hits(self.db, records)
