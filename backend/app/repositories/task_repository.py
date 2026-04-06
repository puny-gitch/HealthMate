from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.daily_task import DailyTask


class TaskRepository:
    def create_batch(self, db: Session, tasks: list[DailyTask]) -> list[DailyTask]:
        db.add_all(tasks)
        db.commit()
        for task in tasks:
            db.refresh(task)
        return tasks

    def get_by_id(self, db: Session, task_id: int, user_id: int) -> DailyTask | None:
        stmt = select(DailyTask).where(DailyTask.task_id == task_id, DailyTask.user_id == user_id)
        return db.scalar(stmt)

    def list_by_date(self, db: Session, user_id: int, target_date: date | None = None) -> list[DailyTask]:
        stmt = select(DailyTask).where(DailyTask.user_id == user_id)
        if target_date:
            stmt = stmt.where(DailyTask.task_date == target_date)
        stmt = stmt.order_by(DailyTask.task_date.desc(), DailyTask.task_id.desc())
        return list(db.scalars(stmt).all())

