from datetime import date

from app.models.daily_task import DailyTask


class TaskService:
    def completion_rate(self, tasks: list[DailyTask]) -> int:
        if not tasks:
            return 0
        done = len([t for t in tasks if t.status == 1])
        return int(round(done * 100 / len(tasks)))

    def metrics(self, tasks: list[DailyTask], today: date) -> dict:
        today_tasks = [t for t in tasks if t.task_date == today]
        return {"completion_rate": self.completion_rate(today_tasks)}

