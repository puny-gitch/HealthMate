import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.exceptions import AppException
from app.core.response import api_success
from app.db.session import get_db
from app.models.health_record import HealthRecord
from app.repositories.health_repository import HealthRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.health import HealthDataSubmitReq
from app.services.parse import ParseService
from app.services.risk import RiskWordService
from app.services.task import TaskService
from app.services.trend import TrendService

router = APIRouter(prefix="/health", tags=["health"])
health_repository = HealthRepository()
task_repository = TaskRepository()
risk_service = RiskWordService()
parse_service = ParseService()
trend_service = TrendService()
task_service = TaskService()


@router.post("/data")
def submit_health_data(
    payload: HealthDataSubmitReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if payload.rawInput and risk_service.contains_high_risk(payload.rawInput):
        raise AppException("检测到高危词汇，请立即就医", code=40020, status_code=400)

    parsed = parse_service.parse_from_text(payload.rawInput or "")
    sleep_minutes = payload.sleepMinutes
    if sleep_minutes is None and payload.sleepHours is not None:
        sleep_minutes = int(payload.sleepHours * 60)
    if sleep_minutes is None:
        sleep_minutes = parsed["sleep_minutes"]

    intake = payload.intakeCalories if payload.intakeCalories is not None else parsed["estimated_intake_kcal"]
    burn = payload.exerciseCalories if payload.exerciseCalories is not None else parsed["estimated_burn_kcal"]
    tags = payload.tags if payload.tags is not None else parsed["tags"]
    confidence = parsed["confidence"] if any([payload.rawInput, sleep_minutes, intake, burn]) else "low"

    record = HealthRecord(
        user_id=user_id,
        record_date=payload.recordDate or date.today(),
        raw_input=payload.rawInput,
        estimated_intake_kcal=intake,
        estimated_burn_kcal=burn,
        sleep_minutes=sleep_minutes,
        nutrition_details=payload.nutritionDetails,
        health_tags=tags,
        confidence=confidence,
    )
    created = health_repository.create(db, record)
    return api_success({"recordId": created.record_id, "confidence": created.confidence}, "提交成功")


@router.post("/parse")
def parse_health_input(
    payload: HealthDataSubmitReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = (user_id, db)
    raw_input = payload.rawInput or ""
    if risk_service.contains_high_risk(raw_input):
        raise AppException("检测到高危词汇，请立即就医", code=40020, status_code=400)
    parsed = parse_service.parse_from_text(raw_input)
    return api_success(
        {
            "estimatedIntakeKcal": parsed["estimated_intake_kcal"],
            "estimatedBurnKcal": parsed["estimated_burn_kcal"],
            "sleepMinutes": parsed["sleep_minutes"],
            "healthTags": parsed["tags"],
            "nutritionDetails": payload.nutritionDetails or {},
            "confidence": parsed["confidence"],
        },
        "解析成功",
    )


@router.get("/dashboard")
def get_dashboard(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    records = health_repository.get_recent(db, user_id, 7)
    tasks = task_repository.list_by_date(db, user_id, date.today())
    trend = trend_service.build_series(records, 7)
    completion = task_service.completion_rate(tasks)
    return api_success(
        {
            "completionRate": completion,
            "categories": trend["categories"],
            "sleepSeries": trend["sleepSeries"],
            "intakeSeries": trend["intakeSeries"],
            "burnSeries": trend["burnSeries"],
        }
    )


@router.get("/trends")
def get_trends(
    dimension: str = Query(default="week", pattern="^(week|month)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    days = 7 if dimension == "week" else 30
    records = health_repository.get_recent(db, user_id, days)
    trend = trend_service.build_series(records, days)
    return api_success({"dimension": dimension, **trend})


@router.get("/export")
def export_data(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    end = date.today()
    start = end - timedelta(days=365)
    records = health_repository.get_by_range(db, user_id, start, end)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "record_date",
            "sleep_minutes",
            "intake_kcal",
            "burn_kcal",
            "confidence",
            "raw_input",
        ]
    )
    for item in records:
        writer.writerow(
            [
                item.record_date.isoformat(),
                item.sleep_minutes or "",
                item.estimated_intake_kcal or "",
                item.estimated_burn_kcal or "",
                item.confidence or "",
                item.raw_input or "",
            ]
        )

    buffer.seek(0)
    filename = f"healthmate_export_{date.today().isoformat()}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers=headers)
