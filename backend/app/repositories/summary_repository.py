from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_summary import HealthSummary


class SummaryRepository:
    def get_by_cycle_date(
        self,
        db: Session,
        user_id: int,
        summary_cycle: str,
        summary_date: date,
    ) -> HealthSummary | None:
        stmt = select(HealthSummary).where(
            HealthSummary.user_id == user_id,
            HealthSummary.summary_cycle == summary_cycle,
            HealthSummary.summary_date == summary_date,
        )
        return db.scalar(stmt)

    def get_latest(self, db: Session, user_id: int, summary_cycle: str = "week") -> HealthSummary | None:
        stmt = (
            select(HealthSummary)
            .where(
                HealthSummary.user_id == user_id,
                HealthSummary.summary_cycle == summary_cycle,
            )
            .order_by(HealthSummary.summary_date.desc(), HealthSummary.summary_id.desc())
            .limit(1)
        )
        return db.scalar(stmt)

    def upsert(self, db: Session, summary: HealthSummary) -> HealthSummary:
        existing = self.get_by_cycle_date(
            db,
            summary.user_id,
            summary.summary_cycle,
            summary.summary_date,
        )
        if existing:
            existing.summary_content = summary.summary_content
            existing.health_trend = summary.health_trend
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing

        db.add(summary)
        db.commit()
        db.refresh(summary)
        return summary
