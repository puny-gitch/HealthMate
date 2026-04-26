from datetime import date

from sqlalchemy.orm import Session

from app.models.health_record import HealthRecord
from app.models.health_summary import HealthSummary
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository


class SummaryService:
    def __init__(
        self,
        health_repository: HealthRepository | None = None,
        summary_repository: SummaryRepository | None = None,
    ):
        self.health_repository = health_repository or HealthRepository()
        self.summary_repository = summary_repository or SummaryRepository()

    def generate_summary(
        self,
        db: Session,
        user_id: int,
        start: date,
        end: date,
        cycle: str = "week",
    ) -> HealthSummary:
        records = self.health_repository.get_by_range(db, user_id, start, end)
        content, trend = self._summarize(records, start, end)
        summary = HealthSummary(
            user_id=user_id,
            summary_cycle=cycle,
            summary_date=end,
            summary_content=content[:200],
            health_trend=trend,
        )
        return self.summary_repository.upsert(db, summary)

    def _summarize(self, records: list[HealthRecord], start: date, end: date) -> tuple[str, dict]:
        if not records:
            return f"{start.isoformat()} 至 {end.isoformat()} 暂无健康记录。", {
                "recordDays": 0,
                "avgSleepMinutes": 0,
                "avgIntakeKcal": 0,
                "avgBurnKcal": 0,
                "tags": {},
            }

        count = len(records)
        avg_sleep = int(sum(record.sleep_minutes or 0 for record in records) / count)
        avg_intake = int(sum(record.estimated_intake_kcal or 0 for record in records) / count)
        avg_burn = int(sum(record.estimated_burn_kcal or 0 for record in records) / count)
        tags: dict[str, int] = {}
        for record in records:
            for tag in record.health_tags or []:
                tags[tag] = tags.get(tag, 0) + 1

        tag_text = "、".join(sorted(tags, key=tags.get, reverse=True)[:3]) or "暂无明显标签"
        content = (
            f"本周期记录{count}天，平均睡眠{avg_sleep}分钟，"
            f"平均摄入{avg_intake}千卡，平均消耗{avg_burn}千卡，"
            f"主要健康标签：{tag_text}。"
        )
        trend = {
            "recordDays": count,
            "avgSleepMinutes": avg_sleep,
            "avgIntakeKcal": avg_intake,
            "avgBurnKcal": avg_burn,
            "tags": tags,
        }
        return content, trend
