from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.advice_history import AdviceHistory
from app.models.daily_task import DailyTask
from app.repositories.advice_repository import AdviceRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.services.advice import AdviceResult, AdviceService, LLMAdviceProvider, MockAdviceProvider
from app.services.cache import CacheService
from app.services.summary import SummaryService
from app.services.task import TaskService


class MaintenanceService:
    def __init__(self):
        self.user_repository = UserRepository()
        self.health_repository = HealthRepository()
        self.task_repository = TaskRepository()
        self.summary_repository = SummaryRepository()
        self.advice_repository = AdviceRepository()
        self.summary_service = SummaryService(self.health_repository, self.summary_repository)
        self.task_service = TaskService()
        self.cache_service = CacheService()

    def archive_previous_tasks(self, db: Session, today: date | None = None) -> int:
        return self.task_repository.archive_before(db, today or date.today())

    def generate_weekly_summaries(self, db: Session, end: date | None = None) -> dict:
        end_date = end or date.today()
        start_date = end_date - timedelta(days=6)
        generated = []
        for user in self.user_repository.list_all(db):
            summary = self.summary_service.generate_summary(db, user.user_id, start_date, end_date, "week")
            generated.append(
                {
                    "userId": user.user_id,
                    "summaryId": summary.summary_id,
                    "summaryDate": summary.summary_date.isoformat(),
                }
            )
        return {"count": len(generated), "items": generated}

    def pre_generate_daily_advice(self, db: Session, target_date: date | None = None) -> dict:
        day = target_date or date.today()
        generated = []
        for user in self.user_repository.list_all(db):
            result = self._generate_advice_for_user(db, user.user_id, day)
            cache_key = f"advice:daily:{user.user_id}:{day.isoformat()}"
            self.cache_service.set_json(
                cache_key,
                {"adviceText": result.advice_text, "tasks": result.tasks},
            )
            tasks = [
                DailyTask(
                    user_id=user.user_id,
                    task_date=day,
                    task_content=task["taskContent"],
                    ai_reason=task.get("aiReason"),
                    status=0,
                )
                for task in result.tasks
            ]
            created_tasks = self.task_repository.upsert_for_date(db, user.user_id, day, tasks)
            self.advice_repository.create(db, AdviceHistory(user_id=user.user_id, advice_text=result.advice_text))
            generated.append({"userId": user.user_id, "taskCount": len(created_tasks)})
        return {"count": len(generated), "items": generated}

    def run_daily_jobs(self, db: Session, today: date | None = None) -> dict:
        target = today or date.today()
        archived = self.archive_previous_tasks(db, target)
        advice = self.pre_generate_daily_advice(db, target)
        return {"archivedTaskCount": archived, "preGeneratedAdvice": advice}

    def _generate_advice_for_user(self, db: Session, user_id: int, target_date: date) -> AdviceResult:
        user = self.user_repository.get_by_id(db, user_id)
        recent = self.health_repository.get_recent(db, user_id, 7)
        yesterday_tasks = self.task_repository.list_by_date(db, user_id, target_date - timedelta(days=1))
        latest_record = self.health_repository.get_latest(db, user_id)
        latest_summary = self.summary_repository.get_latest(db, user_id, "week")

        avg_sleep = int(sum(record.sleep_minutes or 0 for record in recent) / max(len(recent), 1)) if recent else 0
        gap_days = max((target_date - latest_record.record_date).days, 0) if latest_record else 0
        metrics = {
            "completion_rate": self.task_service.completion_rate(yesterday_tasks),
            "avg_sleep_minutes": avg_sleep,
            "gap_days": gap_days,
            "health_goal": user.health_goal if user else None,
            "health_goal_version": user.health_goal_version.isoformat() if user else None,
            "medical_history": user.medical_history if user else None,
            "recent_records": [
                {
                    "date": record.record_date.isoformat(),
                    "sleepMinutes": record.sleep_minutes,
                    "intakeKcal": record.estimated_intake_kcal,
                    "burnKcal": record.estimated_burn_kcal,
                    "tags": record.health_tags or [],
                    "rawInput": record.raw_input,
                }
                for record in recent
            ],
            "latest_summary": {
                "summaryDate": latest_summary.summary_date.isoformat(),
                "summaryContent": latest_summary.summary_content,
                "healthTrend": latest_summary.health_trend,
            }
            if latest_summary
            else None,
        }
        settings = get_settings()
        provider = LLMAdviceProvider() if settings.ai_mode == "llm" else MockAdviceProvider()
        return AdviceService(provider=provider).generate_daily(metrics)
