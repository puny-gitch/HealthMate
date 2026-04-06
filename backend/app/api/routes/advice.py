import asyncio
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.config import get_settings
from app.core.response import api_success
from app.db.session import get_db
from app.models.advice_history import AdviceHistory
from app.models.daily_task import DailyTask
from app.repositories.advice_repository import AdviceRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.task_repository import TaskRepository
from app.services.advice import AdviceService, LLMAdviceProvider, MockAdviceProvider
from app.services.task import TaskService

router = APIRouter(prefix="/advice", tags=["advice"])
settings = get_settings()
advice_repository = AdviceRepository()
task_repository = TaskRepository()
health_repository = HealthRepository()
task_service = TaskService()


def get_advice_service() -> AdviceService:
    if settings.ai_mode == "llm":
        provider = LLMAdviceProvider()
    else:
        provider = MockAdviceProvider()
    return AdviceService(provider=provider)


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


@router.get("/stream")
def advice_stream(
    token: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    # Note: for EventSource clients that cannot send Authorization header,
    # you can add query token support in phase 2.
    _ = token
    recent = health_repository.get_recent(db, user_id, 7)
    all_tasks = task_repository.list_by_date(db, user_id, None)
    metrics = task_service.metrics(all_tasks, date.today())
    if recent:
        metrics["avg_sleep_minutes"] = int(
            sum((r.sleep_minutes or 0) for r in recent) / max(len(recent), 1)
        )
    else:
        metrics["avg_sleep_minutes"] = 0

    result = get_advice_service().generate_daily(metrics)
    advice = AdviceHistory(user_id=user_id, advice_text=result.advice_text)
    advice_repository.create(db, advice)

    tasks = [
        DailyTask(
            user_id=user_id,
            task_date=date.today(),
            task_content=task["taskContent"],
            ai_reason=task.get("aiReason"),
            status=0,
        )
        for task in result.tasks
    ]
    created_tasks = task_repository.create_batch(db, tasks)

    async def event_generator():
        for chunk in result.advice_text:
            yield f"event: message\ndata: {chunk}\n\n"
            await asyncio.sleep(0.01)
        task_data = [
            {
                "taskId": t.task_id,
                "taskContent": t.task_content,
                "aiReason": t.ai_reason,
            }
            for t in created_tasks
        ]
        yield f"event: tasks\ndata: {task_data}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

