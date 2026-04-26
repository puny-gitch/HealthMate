from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.daily_task import DailyTask


class TaskRepository:
    def create_batch(self, db: Session, tasks: list[DailyTask]) -> list[DailyTask]:
        db.add_all(tasks)
        db.commit()
        for task in tasks:
            db.refresh(task)
        return tasks

    def upsert_for_date(self, db: Session, user_id: int, task_date: date, tasks: list[DailyTask]) -> list[DailyTask]:
        existing_tasks = self.list_by_date(db, user_id, task_date)
        existing_by_content = {task.task_content: task for task in existing_tasks}
        result: list[DailyTask] = []

        for task in tasks:
            existing = existing_by_content.get(task.task_content)
            if existing:
                existing.ai_reason = task.ai_reason
                result.append(existing)
            else:
                db.add(task)
                result.append(task)

        db.commit()
        for task in result:
            db.refresh(task)
        return result

    def get_by_id(self, db: Session, task_id: int, user_id: int) -> DailyTask | None:
        stmt = select(DailyTask).where(DailyTask.task_id == task_id, DailyTask.user_id == user_id)
        return db.scalar(stmt)

    def list_by_date(self, db: Session, user_id: int, target_date: date | None = None) -> list[DailyTask]:
        stmt = select(DailyTask).where(DailyTask.user_id == user_id)
        if target_date:
            stmt = stmt.where(DailyTask.task_date == target_date)
        stmt = stmt.order_by(DailyTask.task_date.desc(), DailyTask.task_id.desc())
        return list(db.scalars(stmt).all())

    def archive_before(self, db: Session, cutoff_date: date) -> int:
        stmt = (
            update(DailyTask)
            .where(DailyTask.task_date < cutoff_date, DailyTask.status.in_([0, 1]))
            .values(status=2)
        )
        result = db.execute(stmt)
        db.commit()
        return int(result.rowcount or 0)
