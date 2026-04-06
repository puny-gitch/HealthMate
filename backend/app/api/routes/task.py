from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.exceptions import AppException
from app.core.response import api_success
from app.db.session import get_db
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCheckReq
from app.services.task import TaskService

router = APIRouter(prefix="/task", tags=["task"])
task_repository = TaskRepository()
task_service = TaskService()


@router.post("/check")
def check_task(
    payload: TaskCheckReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    task = task_repository.get_by_id(db, payload.taskId, user_id)
    if not task:
        raise AppException("任务不存在", code=40420, status_code=404)
    task.status = payload.status
    db.add(task)
    db.commit()
    db.refresh(task)
    return api_success(
        {
            "taskId": task.task_id,
            "status": task.status,
            "updatedAt": task.updated_at.isoformat(),
        },
        "更新成功",
    )


@router.get("/history")
def task_history(
    date_str: str | None = Query(default=None, alias="date"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    target_date = date.fromisoformat(date_str) if date_str else None
    tasks = task_repository.list_by_date(db, user_id, target_date)
    completion = task_service.completion_rate(tasks)
    return api_success(
        {
            "tasks": [
                {
                    "taskId": t.task_id,
                    "taskDate": t.task_date.isoformat(),
                    "taskContent": t.task_content,
                    "status": t.status,
                    "aiReason": t.ai_reason,
                    "updatedAt": t.updated_at.isoformat(),
                }
                for t in tasks
            ],
            "completionRate": completion,
        }
    )

