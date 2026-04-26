from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.response import api_success
from app.db.session import get_db
from app.services.maintenance import MaintenanceService

router = APIRouter(prefix="/admin/jobs", tags=["admin-jobs"])
maintenance_service = MaintenanceService()


@router.post("/archive-tasks")
def archive_tasks(
    today: date | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = user_id
    count = maintenance_service.archive_previous_tasks(db, today)
    return api_success({"archivedTaskCount": count}, "归档完成")


@router.post("/weekly-summary")
def generate_weekly_summary(
    endDate: date | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = user_id
    result = maintenance_service.generate_weekly_summaries(db, endDate)
    return api_success(result, "周总结生成完成")


@router.post("/pre-generate-advice")
def pre_generate_advice(
    targetDate: date | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = user_id
    result = maintenance_service.pre_generate_daily_advice(db, targetDate)
    return api_success(result, "建议预生成完成")


@router.post("/run-daily")
def run_daily_jobs(
    today: date | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = user_id
    result = maintenance_service.run_daily_jobs(db, today)
    return api_success(result, "每日维护任务完成")
