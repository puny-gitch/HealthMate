import csv
import io
from datetime import date, datetime, timedelta

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
from app.schemas.health import HealthAIParseReq, HealthDataSubmitReq, HealthRecordConfirmReq
from app.services.health_parse_ai import HealthAIParseService
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
ai_parse_service = HealthAIParseService(parse_service)
trend_service = TrendService()
task_service = TaskService()
summary_service = SummaryService(health_repository, summary_repository)


def _build_health_record(payload: HealthDataSubmitReq, user_id: int) -> HealthRecord:
    if payload.rawInput and risk_service.contains_high_risk(payload.rawInput):
        raise AppException(risk_service.warning_message(payload.rawInput), code=40020, status_code=400)

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
    confidence = payload.confidence or (parsed["confidence"] if payload.rawInput or has_data else "low")
    parse_warnings = payload.parseWarnings or []
    if confidence == "low" and not parse_warnings:
        parse_warnings = ["记录信息可信度较低，请确认后保存。"]
    if not _has_effective_record_data(sleep_minutes, intake, burn, payload.nutritionDetails, payload.exerciseDetails, tags):
        raise AppException(
            "未识别出可保存的健康记录。请补充睡眠时长、饮食内容、运动类型/时长或热量等信息。",
            code=40021,
            status_code=400,
        )

    return HealthRecord(
        user_id=user_id,
        record_date=payload.recordDate or date.today(),
        recorded_at=payload.recordedAt or datetime.utcnow(),
        record_type=payload.recordType,
        raw_input=payload.rawInput,
        estimated_intake_kcal=intake,
        estimated_burn_kcal=burn,
        sleep_minutes=sleep_minutes,
        nutrition_details=payload.nutritionDetails,
        exercise_details=payload.exerciseDetails,
        health_tags=tags,
        confidence=confidence,
        parse_warnings=parse_warnings,
    )


def _has_effective_record_data(
    sleep_minutes: int | None,
    intake: int | None,
    burn: int | None,
    nutrition_details: dict | None,
    exercise_details: dict | None,
    tags: list[str] | None,
) -> bool:
    return any(
        [
            sleep_minutes is not None,
            intake is not None,
            burn is not None,
            bool(nutrition_details and nutrition_details.get("foods")),
            bool(exercise_details and exercise_details.get("items")),
            bool(tags),
        ]
    )


def _serialize_record(record: HealthRecord) -> dict:
    return {
        "recordId": record.record_id,
        "recordDate": record.record_date.isoformat(),
        "recordedAt": record.recorded_at.isoformat(),
        "recordType": record.record_type,
        "rawInput": record.raw_input,
        "sleepMinutes": record.sleep_minutes,
        "estimatedIntakeKcal": record.estimated_intake_kcal,
        "estimatedBurnKcal": record.estimated_burn_kcal,
        "nutritionDetails": record.nutrition_details,
        "exerciseDetails": record.exercise_details,
        "healthTags": record.health_tags or [],
        "confidence": record.confidence,
        "parseWarnings": record.parse_warnings or [],
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
        raise AppException(risk_service.warning_message(raw_input), code=40020, status_code=400)
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


@router.post("/record/natural")
@router.post("/record/parse-ai")
def parse_health_input_ai(
    payload: HealthAIParseReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _ = (user_id, db)
    if risk_service.contains_high_risk(payload.rawInput):
        message = risk_service.warning_message(payload.rawInput)
        return api_success(
            {
                "parseId": None,
                "confidence": "low",
                "confidenceScore": 0,
                "shouldSave": False,
                "failureReason": message,
                "suggestions": ["请及时就医或咨询专业医生。", "病痛症状不作为普通健康记录保存。"],
                "warnings": [message],
                "previewData": {},
            },
            message,
            code=40020,
        )
    result = ai_parse_service.parse(payload.rawInput, payload.recordedAt, payload.recordDate)
    return api_success(
        {
            "parseId": result.parse_id,
            "confidence": result.confidence,
            "confidenceScore": result.confidence_score,
            "shouldSave": result.should_save,
            "failureReason": result.failure_reason,
            "suggestions": result.suggestions,
            "warnings": result.warnings,
            "previewData": result.preview_data,
        },
        "解析成功" if result.should_save else (result.failure_reason or "解析失败，请优化输入后重试"),
    )


@router.post("/record/confirm")
def confirm_health_record(
    payload: HealthRecordConfirmReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    data = {**(payload.previewData or {}), **(payload.userModifiedData or {})}
    data.setdefault("recordDate", payload.recordDate)
    data.setdefault("recordedAt", payload.recordedAt)
    data.setdefault("rawInput", payload.rawInput)
    if data.get("rawInput") and risk_service.contains_high_risk(data["rawInput"]):
        raise AppException(risk_service.warning_message(data["rawInput"]), code=40020, status_code=400)
    record_payload = HealthDataSubmitReq.model_validate(data)
    record = _build_health_record(record_payload, user_id)
    created = health_repository.create(db, record)
    return api_success({"recordId": created.record_id, "confidence": created.confidence}, "提交成功")


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
    force: bool = Query(default=False),
    user_id: int = Depends(get_current_user_id_from_header_or_query),
    db: Session = Depends(get_db),
):
    return build_advice_stream_response(user_id, db, force)


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
