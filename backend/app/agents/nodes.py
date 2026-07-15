from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.agents.state import HealthAgentState
from app.core.config import get_settings
from app.models.advice_history import AdviceHistory
from app.repositories.advice_repository import AdviceRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.services.advice import AdviceResult, AdviceService, LLMAdviceProvider, MockAdviceProvider
from app.services.cache import CacheService
from app.services.knowledge import get_knowledge_service
from app.services.memory import MemoryService
from app.services.task import TaskService
from app.services.task_generation import TaskGenerationService
from app.services.vector_store import get_vector_store_service


class HealthAgentNodes:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.user_repository = UserRepository()
        self.health_repository = HealthRepository()
        self.task_repository = TaskRepository()
        self.summary_repository = SummaryRepository()
        self.advice_repository = AdviceRepository()
        self.cache_service = CacheService()
        self.task_service = TaskService()
        self.task_generation_service = TaskGenerationService()
        self.memory_service = MemoryService()
        self.vector_store = get_vector_store_service()
        self.knowledge_service = get_knowledge_service()

    def check_daily_cache(self, state: HealthAgentState) -> HealthAgentState:
        if state.get("force"):
            return state
        cache_key = self._daily_cache_key(state["user_id"])
        cached = self.cache_service.get_json(cache_key)
        if not cached:
            return state
        state["from_cache"] = True
        state["advice_text"] = str(cached.get("adviceText") or "")
        state["advice_tasks"] = cached.get("tasks") or []
        state["output"] = {
            "adviceText": state["advice_text"],
            "tasks": state["advice_tasks"],
            "fromCache": True,
        }
        return state

    def load_profile(self, state: HealthAgentState) -> HealthAgentState:
        user = self.user_repository.get_by_id(self.db, state["user_id"])
        state["profile"] = (
            {
                "userId": user.user_id,
                "gender": user.gender,
                "height": float(user.height) if user.height is not None else None,
                "weight": float(user.weight) if user.weight is not None else None,
                "healthGoal": user.health_goal,
                "medicalHistory": user.medical_history,
                "injuryHistory": user.injury_history,
                "allergyHistory": user.allergy_history,
                "healthGoalVersion": user.health_goal_version.isoformat() if user.health_goal_version else None,
            }
            if user
            else None
        )
        return state

    def load_recent_records(self, state: HealthAgentState) -> HealthAgentState:
        user_id = state["user_id"]
        recent = self.health_repository.get_recent(self.db, user_id, 7)
        yesterday_tasks = self.task_repository.list_by_date(self.db, user_id, date.today() - timedelta(days=1))
        latest_record = self.health_repository.get_latest(self.db, user_id)
        latest_summary = self.summary_repository.get_latest(self.db, user_id, "week")

        avg_sleep = int(sum(record.sleep_minutes or 0 for record in recent) / max(len(recent), 1)) if recent else 0
        gap_days = max((date.today() - latest_record.record_date).days, 0) if latest_record else 0
        profile = state.get("profile") or {}
        recent_records = [self._serialize_health_record(record) for record in recent]
        latest_summary_payload = (
            {
                "summaryDate": latest_summary.summary_date.isoformat(),
                "summaryContent": latest_summary.summary_content,
                "healthTrend": latest_summary.health_trend,
            }
            if latest_summary
            else None
        )
        state["recent_records"] = recent_records
        state["latest_summary"] = latest_summary_payload
        state["metrics"] = {
            "completion_rate": self.task_service.completion_rate(yesterday_tasks),
            "avg_sleep_minutes": avg_sleep,
            "gap_days": gap_days,
            "health_goal": profile.get("healthGoal"),
            "health_goal_version": profile.get("healthGoalVersion"),
            "medical_history": profile.get("medicalHistory"),
            "recent_records": recent_records,
            "latest_summary": latest_summary_payload,
        }
        return state

    def risk_guardrail(self, state: HealthAgentState) -> HealthAgentState:
        state["risk_blocked"] = False
        state.setdefault("warnings", [])
        return state

    def retrieve_user_memory(self, state: HealthAgentState) -> HealthAgentState:
        query = self._build_query(state)
        state["memory_query"] = query
        memories = self.memory_service.retrieve(
            state["user_id"],
            query,
            memory_types=["preference", "constraint", "habit", "summary"],
            top_k=5,
        )
        state["user_memories"] = [
            {
                "text": memory.text,
                "memoryType": memory.memory_type,
                "sourceType": memory.source_type,
                "sourceId": memory.source_id,
                "importance": memory.importance,
                "score": memory.score,
            }
            for memory in memories
        ]
        return state

    def retrieve_health_knowledge(self, state: HealthAgentState) -> HealthAgentState:
        query = self._build_query(state)
        state["knowledge_query"] = query
        hits = self.vector_store.search(
            self.settings.qdrant_knowledge_collection,
            query,
            filters={"risk_level": "normal"},
            top_k=self.settings.knowledge_top_k,
        )
        if hits:
            knowledge_hits = [
                {
                    "source": str(hit.payload.get("source") or "qdrant"),
                    "title": str(hit.payload.get("title") or "knowledge"),
                    "content": hit.text,
                    "score": hit.score,
                }
                for hit in hits
            ]
        else:
            fallback_hits = self.knowledge_service.search(query, top_k=self.settings.knowledge_top_k)
            knowledge_hits = [
                {
                    "source": hit.source,
                    "title": hit.title,
                    "content": hit.content,
                    "score": hit.score,
                }
                for hit in fallback_hits
            ]
        state["knowledge_hits"] = knowledge_hits
        state["knowledge_context"] = "\n\n".join(
            f"[{hit['source']}::{hit['title']}]\n{hit['content']}" for hit in knowledge_hits
        )
        return state

    def generate_advice(self, state: HealthAgentState) -> HealthAgentState:
        if state.get("from_cache"):
            return state
        metrics = dict(state.get("metrics") or {})
        context_memory = self._render_user_memory(state.get("user_memories") or [])
        if context_memory:
            metrics["latest_summary"] = self._append_summary(metrics.get("latest_summary"), context_memory)
        if state.get("knowledge_context"):
            metrics["knowledge_context"] = state["knowledge_context"]
        result = self._advice_service().generate_daily(metrics)
        state["advice_text"] = result.advice_text
        state["advice_tasks"] = result.tasks
        state["fallback_used"] = self.settings.ai_mode == "llm" and not (self.settings.llm_api_base and self.settings.llm_api_key)
        state["output"] = {"adviceText": result.advice_text, "tasks": result.tasks}
        return state

    def output_guardrail(self, state: HealthAgentState) -> HealthAgentState:
        unsafe_terms = ["diagnose", "prescription", "dosage"]
        advice_text = (state.get("advice_text") or "").lower()
        if any(term in advice_text for term in unsafe_terms):
            state.setdefault("warnings", []).append("output_guardrail_flagged_medicalized_content")
        return state

    def persist_advice_result(self, state: HealthAgentState) -> HealthAgentState:
        if state.get("from_cache"):
            return state
        advice_text = state.get("advice_text") or ""
        if advice_text:
            self.cache_service.set_json(
                self._daily_cache_key(state["user_id"]),
                {"adviceText": advice_text, "tasks": state.get("advice_tasks") or []},
            )
            self.advice_repository.create(self.db, AdviceHistory(user_id=state["user_id"], advice_text=advice_text))
        return state

    def load_task_context(self, state: HealthAgentState) -> HealthAgentState:
        target_date = date.fromisoformat(state["target_date"])
        user = self.user_repository.get_by_id(self.db, state["user_id"])
        health_records = self.health_repository.list_all(self.db, state["user_id"])
        today_tasks = self.task_repository.list_by_date(self.db, state["user_id"], target_date)
        history_tasks = self.task_repository.list_by_date(self.db, state["user_id"])
        latest_advice = self.advice_repository.get_latest(self.db, state["user_id"])
        latest_summary = self.summary_repository.get_latest(self.db, state["user_id"], "week")
        context = self.task_generation_service.build_context(
            user=user,
            health_records=health_records,
            today_tasks=today_tasks,
            history_tasks=history_tasks,
            latest_advice=latest_advice,
            latest_summary=latest_summary,
            target_date=target_date,
        )
        state["metrics"] = context
        state["recent_records"] = context.get("health_records") or []
        state["today_tasks"] = context.get("today_unfinished_tasks") or []
        state["task_history"] = context.get("all_tasks") or []
        state["latest_advice"] = context.get("latest_advice")
        return state

    def generate_task_candidates(self, state: HealthAgentState) -> HealthAgentState:
        context = dict(state.get("metrics") or {})
        if state.get("user_memories"):
            context["semantic_memories"] = state["user_memories"]
        candidates, skipped = self.task_generation_service.generate_candidates(context, state.get("max_tasks") or 3)
        state["task_candidates"] = [
            {
                "draftId": item.draft_id,
                "taskContent": item.task_content,
                "aiReason": item.ai_reason,
                "difficulty": item.difficulty,
                "similarityWarning": item.similarity_warning,
            }
            for item in candidates
        ]
        state["skipped_reasons"] = skipped
        state["output"] = {
            "targetDate": state["target_date"],
            "candidates": state["task_candidates"],
            "skippedReasons": skipped,
        }
        return state

    def task_guardrail(self, state: HealthAgentState) -> HealthAgentState:
        profile = (state.get("metrics") or {}).get("profile") or {}
        injury = profile.get("injuryHistory") or ""
        if injury and any("run" in (item.get("taskContent") or "").lower() for item in state.get("task_candidates") or []):
            state.setdefault("warnings", []).append("task_guardrail_detected_running_with_injury_history")
        return state

    def _advice_service(self) -> AdviceService:
        provider = LLMAdviceProvider() if self.settings.ai_mode == "llm" else MockAdviceProvider()
        return AdviceService(provider=provider)

    def _daily_cache_key(self, user_id: int) -> str:
        return f"advice:daily:{user_id}:{date.today().isoformat()}"

    def _build_query(self, state: HealthAgentState) -> str:
        parts: list[str] = []
        profile = state.get("profile") or {}
        if profile.get("healthGoal"):
            parts.append(str(profile["healthGoal"]))
        latest_summary = state.get("latest_summary") or {}
        if latest_summary.get("summaryContent"):
            parts.append(str(latest_summary["summaryContent"]))
        for record in (state.get("recent_records") or [])[:5]:
            parts.extend(record.get("healthTags") or record.get("tags") or [])
            if record.get("rawInput"):
                parts.append(str(record["rawInput"])[:80])
        latest_advice = state.get("latest_advice")
        if latest_advice:
            parts.append(str(latest_advice)[:120])
        return " ".join(part for part in parts if part)

    def _render_user_memory(self, memories: list[dict[str, Any]]) -> str:
        if not memories:
            return ""
        return "\n".join(f"- {item.get('text')}" for item in memories if item.get("text"))

    def _append_summary(self, summary: dict[str, Any] | None, memory_text: str) -> dict[str, Any]:
        payload = dict(summary or {})
        existing = payload.get("summaryContent") or ""
        payload["summaryContent"] = f"{existing}\nUser semantic memory:\n{memory_text}".strip()
        return payload

    def _serialize_health_record(self, record) -> dict[str, Any]:
        return {
            "recordId": record.record_id,
            "recordDate": record.record_date.isoformat(),
            "recordedAt": record.recorded_at.isoformat(),
            "recordType": record.record_type,
            "rawInput": record.raw_input,
            "sleepMinutes": record.sleep_minutes,
            "estimatedIntakeKcal": record.estimated_intake_kcal,
            "estimatedBurnKcal": record.estimated_burn_kcal,
            "healthTags": record.health_tags or [],
            "confidence": record.confidence,
        }
