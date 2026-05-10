import asyncio
import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_current_user_id_from_header_or_query
from app.core.config import get_settings
from app.core.response import api_success
from app.db.session import get_db
from app.models.advice_history import AdviceHistory
from app.repositories.advice_repository import AdviceRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.services.advice import AdviceService, LLMAdviceProvider, MockAdviceProvider
from app.services.cache import CacheService
from app.services.task import TaskService

router = APIRouter(prefix="/advice", tags=["advice"])
settings = get_settings()
advice_repository = AdviceRepository()
task_repository = TaskRepository()
health_repository = HealthRepository()
summary_repository = SummaryRepository()
user_repository = UserRepository()
task_service = TaskService()
cache_service = CacheService()


def get_advice_service() -> AdviceService:
    if settings.ai_mode == "llm":
        provider = LLMAdviceProvider()
    else:
        provider = MockAdviceProvider()
    return AdviceService(provider=provider)


def _serialize_recent_record(record) -> dict:
    return {
        "date": record.record_date.isoformat(),
        "sleepMinutes": record.sleep_minutes,
        "intakeKcal": record.estimated_intake_kcal,
        "burnKcal": record.estimated_burn_kcal,
        "tags": record.health_tags or [],
        "rawInput": record.raw_input,
    }


def _build_metrics(db: Session, user_id: int) -> dict:
    recent = health_repository.get_recent(db, user_id, 7)
    yesterday = date.today() - timedelta(days=1)
    yesterday_tasks = task_repository.list_by_date(db, user_id, yesterday)
    user = user_repository.get_by_id(db, user_id)
    latest_record = health_repository.get_latest(db, user_id)
    latest_summary = summary_repository.get_latest(db, user_id, "week")

    if recent:
        avg_sleep = int(sum((record.sleep_minutes or 0) for record in recent) / max(len(recent), 1))
    else:
        avg_sleep = 0

    gap_days = 0
    if latest_record:
        gap_days = max((date.today() - latest_record.record_date).days, 0)

    return {
        "completion_rate": task_service.completion_rate(yesterday_tasks),
        "avg_sleep_minutes": avg_sleep,
        "gap_days": gap_days,
        "health_goal": user.health_goal if user else None,
        "health_goal_version": user.health_goal_version.isoformat() if user else None,
        "medical_history": user.medical_history if user else None,
        "recent_records": [_serialize_recent_record(record) for record in recent],
        "latest_summary": {
            "summaryDate": latest_summary.summary_date.isoformat(),
            "summaryContent": latest_summary.summary_content,
            "healthTrend": latest_summary.health_trend,
        }
        if latest_summary
        else None,
    }


def _result_to_cache_payload(result) -> dict:
    return {"adviceText": result.advice_text}


def _result_from_cache_payload(payload: dict):
    from app.services.advice import AdviceResult

    return AdviceResult(advice_text=payload["adviceText"], tasks=[])


@router.get("/history")
def advice_history(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    records = advice_repository.list_recent(db, user_id, limit=20)
    return api_success(
        [
            {
                "adviceId": r.advice_id,
                "adviceText": r.advice_text,
                "createdAt": r.created_at.isoformat(),
            }
            for r in records
        ]
    )


def build_advice_stream_response(user_id: int, db: Session, force: bool = False) -> StreamingResponse:
    cache_key = f"advice:daily:{user_id}:{date.today().isoformat()}"
    cached = None if force else cache_service.get_json(cache_key)
    if cached:
        result = _result_from_cache_payload(cached)
    else:
        metrics = _build_metrics(db, user_id)
        result = get_advice_service().generate_daily(metrics)
        cache_service.set_json(cache_key, _result_to_cache_payload(result))
        advice = AdviceHistory(user_id=user_id, advice_text=result.advice_text)
        advice_repository.create(db, advice)

    async def event_generator():
        for chunk in result.advice_text:
            yield f"event: message\ndata: {chunk}\n\n"
            await asyncio.sleep(0.01)
        yield f"event: advice\ndata: {json.dumps({'adviceText': result.advice_text}, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/stream")
def advice_stream(
    force: bool = Query(default=False),
    user_id: int = Depends(get_current_user_id_from_header_or_query),
    db: Session = Depends(get_db),
):
    return build_advice_stream_response(user_id, db, force)
