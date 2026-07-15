from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.agents import HealthAgentService
from app.api.deps import get_current_user_id
from app.core.exceptions import AppException
from app.core.response import api_success
from app.db.session import get_db
from app.models.daily_task import DailyTask
from app.repositories.advice_repository import AdviceRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.schemas.task import TaskAddSelectedReq, TaskCheckReq, TaskGeneratePreviewReq
from app.services.task_generation import TaskGenerationService
from app.services.task import TaskService

router = APIRouter(prefix="/task", tags=["task"])
task_repository = TaskRepository()
health_repository = HealthRepository()
user_repository = UserRepository()
advice_repository = AdviceRepository()
summary_repository = SummaryRepository()
task_service = TaskService()
task_generation_service = TaskGenerationService()
health_agent_service = HealthAgentService()


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


@router.get("/today")
def task_today(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    tasks = task_repository.list_by_date(db, user_id, date.today())
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
        },
        "查询成功",
    )


@router.post("/generate-preview")
def generate_task_preview(
    payload: TaskGeneratePreviewReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    target_date = payload.targetDate or date.today()
    agent_result = health_agent_service.generate_task_preview(db, user_id, target_date, payload.maxTasks)
    return api_success(
        {
            "runId": agent_result["runId"],
            "targetDate": target_date.isoformat(),
            "candidates": agent_result["candidates"],
            "skippedReasons": agent_result["skippedReasons"],
            "warnings": agent_result["warnings"],
        },
        "候选任务生成成功",
    )


@router.post("/add-selected")
def add_selected_tasks(
    payload: TaskAddSelectedReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    target_date = payload.targetDate or date.today()
    completed_tasks = [task for task in task_repository.list_by_date(db, user_id, target_date) if task.status == 1]
    skipped: list[str] = []
    tasks: list[DailyTask] = []
    for item in payload.tasks:
        if task_generation_service.is_similar_to_any(item.taskContent, [task.task_content for task in completed_tasks]):
            skipped.append(f"已完成相似任务，未添加：{item.taskContent}")
            continue
        tasks.append(
            DailyTask(
                user_id=user_id,
                task_date=target_date,
                task_content=item.taskContent,
                ai_reason=item.aiReason,
                status=0,
            )
        )
    archived_count = task_repository.archive_unfinished_by_date(db, user_id, target_date)
    created = task_repository.upsert_for_date(db, user_id, target_date, tasks) if tasks else []
    return api_success(
        {
            "archivedUnfinishedTaskCount": archived_count,
            "tasks": [
                {
                    "taskId": task.task_id,
                    "taskDate": task.task_date.isoformat(),
                    "taskContent": task.task_content,
                    "status": task.status,
                    "aiReason": task.ai_reason,
                    "updatedAt": task.updated_at.isoformat(),
                }
                for task in created
            ],
            "skippedReasons": skipped,
        },
        "任务添加完成",
    )
