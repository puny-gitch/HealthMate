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

    def save(self, db: Session, record: HealthRecord) -> HealthRecord:
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def get_by_user_date(self, db: Session, user_id: int, target_date: date) -> HealthRecord | None:
        stmt = select(HealthRecord).where(
            HealthRecord.user_id == user_id,
            HealthRecord.record_date == target_date,
        )
        return db.scalar(stmt)

    def upsert_by_user_date(self, db: Session, record: HealthRecord) -> HealthRecord:
        existing = self.get_by_user_date(db, record.user_id, record.record_date)
        if not existing:
            return self.create(db, record)

        if record.raw_input is not None:
            existing.raw_input = record.raw_input
        existing.estimated_intake_kcal = record.estimated_intake_kcal
        existing.estimated_burn_kcal = record.estimated_burn_kcal
        existing.sleep_minutes = record.sleep_minutes
        existing.nutrition_details = record.nutrition_details
        existing.health_tags = record.health_tags
        existing.confidence = record.confidence
        return self.save(db, existing)

    def get_recent(self, db: Session, user_id: int, days: int) -> list[HealthRecord]:
        start = date.today() - timedelta(days=days - 1)
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id, HealthRecord.record_date >= start)
            .order_by(HealthRecord.record_date.asc())
        )
        return list(db.scalars(stmt).all())

    def get_latest(self, db: Session, user_id: int) -> HealthRecord | None:
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id)
            .order_by(HealthRecord.record_date.desc(), HealthRecord.record_id.desc())
            .limit(1)
        )
        return db.scalar(stmt)

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
