from datetime import date, timedelta

from sqlalchemy import delete, select
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
        ).order_by(HealthRecord.recorded_at.desc(), HealthRecord.record_id.desc())
        return db.scalar(stmt)

    def get_recent(self, db: Session, user_id: int, days: int) -> list[HealthRecord]:
        start = date.today() - timedelta(days=days - 1)
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id, HealthRecord.record_date >= start)
            .order_by(HealthRecord.record_date.asc(), HealthRecord.recorded_at.asc(), HealthRecord.record_id.asc())
        )
        return list(db.scalars(stmt).all())

    def get_latest(self, db: Session, user_id: int) -> HealthRecord | None:
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id)
            .order_by(HealthRecord.recorded_at.desc(), HealthRecord.record_id.desc())
            .limit(1)
        )
        return db.scalar(stmt)

    def get_by_id(self, db: Session, user_id: int, record_id: int) -> HealthRecord | None:
        stmt = select(HealthRecord).where(
            HealthRecord.user_id == user_id,
            HealthRecord.record_id == record_id,
        )
        return db.scalar(stmt)

    def list_all(self, db: Session, user_id: int) -> list[HealthRecord]:
        stmt = (
            select(HealthRecord)
            .where(HealthRecord.user_id == user_id)
            .order_by(HealthRecord.recorded_at.desc(), HealthRecord.record_id.desc())
        )
        return list(db.scalars(stmt).all())

    def delete_by_id(self, db: Session, user_id: int, record_id: int) -> bool:
        stmt = delete(HealthRecord).where(
            HealthRecord.user_id == user_id,
            HealthRecord.record_id == record_id,
        )
        result = db.execute(stmt)
        db.commit()
        return bool(result.rowcount)

    def get_by_range(self, db: Session, user_id: int, start: date, end: date) -> list[HealthRecord]:
        stmt = (
            select(HealthRecord)
            .where(
                HealthRecord.user_id == user_id,
                HealthRecord.record_date >= start,
                HealthRecord.record_date <= end,
            )
            .order_by(HealthRecord.record_date.asc(), HealthRecord.recorded_at.asc(), HealthRecord.record_id.asc())
        )
        return list(db.scalars(stmt).all())
