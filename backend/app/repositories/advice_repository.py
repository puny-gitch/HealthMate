from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.advice_history import AdviceHistory


class AdviceRepository:
    def create(self, db: Session, advice: AdviceHistory) -> AdviceHistory:
        db.add(advice)
        db.commit()
        db.refresh(advice)
        return advice

    def list_recent(self, db: Session, user_id: int, limit: int = 20) -> list[AdviceHistory]:
        stmt = (
            select(AdviceHistory)
            .where(AdviceHistory.user_id == user_id)
            .order_by(AdviceHistory.advice_id.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

