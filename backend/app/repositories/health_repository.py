from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health_record import HealthRecord


class HealthRepository:
    def create(self, db: Session, record: HealthRecord) -> HealthRecord:
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def get_recent(self, db: Session, user_id: int, days: int) -> list[HealthRecord]:
        start = date.today() - timedelta(days=days - 1)
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id, HealthRecord.record_date >= start)
            .order_by(HealthRecord.record_date.asc())
        )
        return list(db.scalars(stmt).all())

    def get_by_range(self, db: Session, user_id: int, start: date, end: date) -> list[HealthRecord]:
        stmt = (
            select(HealthRecord)
            .where(
                HealthRecord.user_id == user_id,
                HealthRecord.record_date >= start,
                HealthRecord.record_date <= end,
            )
            .order_by(HealthRecord.record_date.asc())
        )
        return list(db.scalars(stmt).all())

