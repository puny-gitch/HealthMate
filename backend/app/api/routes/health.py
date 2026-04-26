import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_current_user_id_from_header_or_query
from app.api.routes.advice import build_advice_stream_response
from app.core.exceptions import AppException
from app.core.response import api_success
from app.db.session import get_db
from app.models.health_record import HealthRecord
from app.repositories.health_repository import HealthRepository
from app.repositories.summary_repository import SummaryRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.health import HealthDataSubmitReq, HealthRecordConfirmReq
from app.services.parse import ParseService
from app.services.risk import RiskWordService
from app.services.summary import SummaryService
from app.services.task import TaskService
from app.services.trend import TrendService

router = APIRouter(prefix="/health", tags=["health"])
visual_router = APIRouter(prefix="/visual", tags=["visual-compat"])
health_repository = HealthRepository()
summary_repository = SummaryRepository()
task_repository = TaskRepository()
risk_service = RiskWordService()
parse_service = ParseService()
trend_service = TrendService()
task_service = TaskService()
summary_service = SummaryService(health_repository, summary_repository)


def _build_health_record(payload: HealthDataSubmitReq, user_id: int) -> HealthRecord:
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
    has_data = any(value is not None for value in [sleep_minutes, intake, burn]) or bool(tags)
    confidence = parsed["confidence"] if payload.rawInput or has_data else "low"

    return HealthRecord(
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


def _serialize_record(record: HealthRecord) -> dict:
    return {
        "recordId": record.record_id,
        "recordDate": record.record_date.isoformat(),
        "rawInput": record.raw_input,
        "sleepMinutes": record.sleep_minutes,
        "estimatedIntakeKcal": record.estimated_intake_kcal,
        "estimatedBurnKcal": record.estimated_burn_kcal,
        "nutritionDetails": record.nutrition_details,
        "healthTags": record.health_tags or [],
        "confidence": record.confidence,
        "updatedAt": record.updated_at.isoformat(),
    }


@router.post("/record/manual")
@router.post("/data")
def submit_health_data(
    payload: HealthDataSubmitReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    record = _build_health_record(payload, user_id)
    created = health_repository.upsert_by_user_date(db, record)
    return api_success({"recordId": created.record_id, "confidence": created.confidence}, "提交成功")


@router.post("/record/natural")
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


@router.post("/record/confirm")
def confirm_health_record(
    payload: HealthRecordConfirmReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    data = {**(payload.previewData or {}), **(payload.userModifiedData or {})}
    data.setdefault("recordDate", payload.recordDate)
    data.setdefault("rawInput", payload.rawInput)
    record_payload = HealthDataSubmitReq.model_validate(data)
    record = _build_health_record(record_payload, user_id)
    created = health_repository.upsert_by_user_date(db, record)
    return api_success({"recordId": created.record_id}, "提交成功")


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


@router.get("/record/recent")
def get_recent_records(
    days: int = Query(default=7, ge=1, le=365),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    records = health_repository.get_recent(db, user_id, days)
    return api_success({"records": [_serialize_record(record) for record in records]}, "查询成功")


@router.get("/export")
def export_data(
    startDate: date | None = Query(default=None),
    endDate: date | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    end = endDate or date.today()
    start = startDate or (end - timedelta(days=365))
    if start > end:
        raise AppException("开始日期不能晚于结束日期", code=40030, status_code=400)
    records = health_repository.get_by_range(db, user_id, start, end)

    buffer = io.StringIO()
    buffer.write("\ufeff")
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
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/summary/latest")
def get_latest_summary(
    cycle: str = Query(default="week", pattern="^(week|month)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    summary = summary_repository.get_latest(db, user_id, cycle)
    if not summary:
        return api_success(None, "暂无总结")
    return api_success(
        {
            "summaryId": summary.summary_id,
            "summaryCycle": summary.summary_cycle,
            "summaryDate": summary.summary_date.isoformat(),
            "summaryContent": summary.summary_content,
            "healthTrend": summary.health_trend,
            "createdAt": summary.created_at.isoformat(),
        },
        "查询成功",
    )


@router.post("/summary/generate")
def generate_summary(
    startDate: date,
    endDate: date,
    cycle: str = Query(default="week", pattern="^(week|month)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if startDate > endDate:
        raise AppException("开始日期不能晚于结束日期", code=40030, status_code=400)
    summary = summary_service.generate_summary(db, user_id, startDate, endDate, cycle)
    return api_success(
        {
            "summaryId": summary.summary_id,
            "summaryCycle": summary.summary_cycle,
            "summaryDate": summary.summary_date.isoformat(),
            "summaryContent": summary.summary_content,
            "healthTrend": summary.health_trend,
        },
        "总结生成成功",
    )


@router.get("/daily-report")
def legacy_daily_report(
    user_id: int = Depends(get_current_user_id_from_header_or_query),
    db: Session = Depends(get_db),
):
    return build_advice_stream_response(user_id, db)


@visual_router.get("/dashboard")
def visual_dashboard(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return get_dashboard(user_id, db)


@visual_router.get("/trend")
def visual_trend(
    type_: str = Query(default="week", alias="type", pattern="^(week|month)$"),
    indicator: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = indicator
    return get_trends(type_, user_id, db)


@visual_router.get("/tags")
def visual_tags(
    days: int = Query(default=7, ge=1, le=365),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    records = health_repository.get_recent(db, user_id, days)
    tags: dict[str, int] = {}
    for record in records:
        for tag in record.health_tags or []:
            tags[tag] = tags.get(tag, 0) + 1
    return api_success({"tags": tags}, "查询成功")
