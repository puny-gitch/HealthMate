from __future__ import annotations

import time
from datetime import date
from typing import Callable

from sqlalchemy.orm import Session

from app.agents.nodes import HealthAgentNodes
from app.agents.serialization import state_snapshot, to_jsonable
from app.agents.state import HealthAgentState
from app.agents.trace import AgentTraceRecorder
from app.core.config import get_settings
from app.services.advice import AdviceResult


NodeFn = Callable[[HealthAgentState], HealthAgentState]


class HealthAgentService:
    """Application-facing Agent service backed by a LangGraph state graph."""

    def __init__(self):
        self.settings = get_settings()

    def generate_daily_advice(self, db: Session, user_id: int, force: bool = False) -> dict:
        trace = AgentTraceRecorder(db)
        started_at = time.perf_counter()
        run = trace.start_run(user_id, "daily_advice", {"force": force})
        state: HealthAgentState = {
            "run_id": run.run_id,
            "user_id": user_id,
            "run_type": "daily_advice",
            "force": force,
            "from_cache": False,
            "fallback_used": False,
            "warnings": [],
        }
        nodes = HealthAgentNodes(db)
        sequence: list[tuple[str, str, NodeFn]] = [
            ("check_daily_cache", "tool", nodes.check_daily_cache),
            ("load_profile", "tool", nodes.load_profile),
            ("load_recent_records", "tool", nodes.load_recent_records),
            ("risk_guardrail", "guardrail", nodes.risk_guardrail),
            ("retrieve_user_memory", "tool", nodes.retrieve_user_memory),
            ("retrieve_health_knowledge", "tool", nodes.retrieve_health_knowledge),
            ("generate_advice", "llm", nodes.generate_advice),
            ("output_guardrail", "guardrail", nodes.output_guardrail),
            ("persist_advice_result", "tool", nodes.persist_advice_result),
        ]
        try:
            result_state = self._execute_graph(state, sequence, trace)
            if result_state.get("knowledge_hits"):
                trace.record_retrieval_hits(run.run_id, result_state["knowledge_hits"])
            trace.finish_run(
                run,
                "success",
                result_state.get("output") or state_snapshot(result_state),
                started_at,
                fallback_used=bool(result_state.get("fallback_used")),
            )
            return {
                "runId": run.run_id,
                "advice": AdviceResult(
                    advice_text=result_state.get("advice_text") or "",
                    tasks=result_state.get("advice_tasks") or [],
                    knowledge_context=result_state.get("knowledge_context"),
                ),
                "fromCache": bool(result_state.get("from_cache")),
                "fallbackUsed": bool(result_state.get("fallback_used")),
                "warnings": result_state.get("warnings") or [],
            }
        except Exception as exc:
            trace.finish_run(run, "failed", state_snapshot(state), started_at, error_message=str(exc))
            raise

    def generate_task_preview(
        self,
        db: Session,
        user_id: int,
        target_date: date,
        max_tasks: int = 3,
    ) -> dict:
        trace = AgentTraceRecorder(db)
        started_at = time.perf_counter()
        run = trace.start_run(
            user_id,
            "task_preview",
            {"targetDate": target_date.isoformat(), "maxTasks": max_tasks},
        )
        state: HealthAgentState = {
            "run_id": run.run_id,
            "user_id": user_id,
            "run_type": "task_preview",
            "target_date": target_date.isoformat(),
            "max_tasks": max_tasks,
            "warnings": [],
            "fallback_used": False,
        }
        nodes = HealthAgentNodes(db)
        sequence: list[tuple[str, str, NodeFn]] = [
            ("load_profile", "tool", nodes.load_profile),
            ("load_task_context", "tool", nodes.load_task_context),
            ("retrieve_user_memory", "tool", nodes.retrieve_user_memory),
            ("generate_task_candidates", "llm", nodes.generate_task_candidates),
            ("task_guardrail", "guardrail", nodes.task_guardrail),
        ]
        try:
            result_state = self._execute_graph(state, sequence, trace)
            output = result_state.get("output") or {
                "targetDate": target_date.isoformat(),
                "candidates": result_state.get("task_candidates") or [],
                "skippedReasons": result_state.get("skipped_reasons") or [],
            }
            trace.finish_run(run, "success", output, started_at, fallback_used=bool(result_state.get("fallback_used")))
            return {
                "runId": run.run_id,
                "targetDate": target_date.isoformat(),
                "candidates": result_state.get("task_candidates") or [],
                "skippedReasons": result_state.get("skipped_reasons") or [],
                "warnings": result_state.get("warnings") or [],
            }
        except Exception as exc:
            trace.finish_run(run, "failed", state_snapshot(state), started_at, error_message=str(exc))
            raise

    def _execute_graph(
        self,
        initial_state: HealthAgentState,
        sequence: list[tuple[str, str, NodeFn]],
        trace: AgentTraceRecorder,
    ) -> HealthAgentState:
        wrapped_nodes = [(name, self._trace_node(name, step_type, node, trace)) for name, step_type, node in sequence]
        try:
            from langgraph.graph import END, StateGraph
        except Exception:
            state = initial_state
            for _, node in wrapped_nodes:
                state = node(state)
            return state

        try:
            graph = StateGraph(HealthAgentState)
            for name, node in wrapped_nodes:
                graph.add_node(name, node)
            graph.set_entry_point(wrapped_nodes[0][0])
            for current, nxt in zip(wrapped_nodes, wrapped_nodes[1:]):
                graph.add_edge(current[0], nxt[0])
            graph.add_edge(wrapped_nodes[-1][0], END)
            compiled = graph.compile()
        except Exception:
            state = initial_state
            for _, node in wrapped_nodes:
                state = node(state)
            return state
        return compiled.invoke(initial_state)

    def _trace_node(
        self,
        name: str,
        step_type: str,
        node: NodeFn,
        trace: AgentTraceRecorder,
    ) -> NodeFn:
        def wrapped(state: HealthAgentState) -> HealthAgentState:
            started_at = time.perf_counter()
            input_snapshot = state_snapshot(state)
            try:
                next_state = node(dict(state))
                latency_ms = (time.perf_counter() - started_at) * 1000
                step = trace.record_step(
                    state["run_id"],
                    name,
                    step_type,
                    "success",
                    input_snapshot,
                    state_snapshot(next_state),
                    latency_ms,
                )
                if step_type in {"tool", "llm"}:
                    trace.record_tool_call(
                        state["run_id"],
                        step.step_id,
                        name,
                        input_snapshot,
                        state_snapshot(next_state),
                        latency_ms,
                    )
                return next_state
            except Exception as exc:
                latency_ms = (time.perf_counter() - started_at) * 1000
                trace.record_step(
                    state["run_id"],
                    name,
                    step_type,
                    "failed",
                    input_snapshot,
                    None,
                    latency_ms,
                    error_message=str(exc),
                )
                trace.record_tool_call(
                    state["run_id"],
                    None,
                    name,
                    input_snapshot,
                    {"error": str(exc)},
                    latency_ms,
                    success=False,
                    error_message=str(exc),
                )
                raise

        return wrapped
