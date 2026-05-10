from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import json
import re
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.services.parse import ParseService


@dataclass
class HealthParsePreview:
    parse_id: str
    confidence: str
    confidence_score: float
    warnings: list[str]
    preview_data: dict


class HealthAIParseService:
    def __init__(self, fallback: ParseService | None = None):
        self.fallback = fallback or ParseService()

    def parse(self, raw_input: str, recorded_at: datetime | None = None, record_date: date | None = None) -> HealthParsePreview:
        settings = get_settings()
        if settings.ai_mode == "llm" and settings.llm_api_base and settings.llm_api_key:
            try:
                payload = self._parse_with_llm(raw_input, recorded_at, record_date)
                return self._normalize_payload(payload, raw_input, recorded_at, record_date)
            except Exception:
                pass
        return self._parse_with_rules(raw_input, recorded_at, record_date)

    def _parse_with_llm(self, raw_input: str, recorded_at: datetime | None, record_date: date | None) -> dict:
        settings = get_settings()
        response = httpx.post(
            self._chat_completions_url(settings.llm_api_base or ""),
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "你是健康记录结构化解析器，只输出 JSON。"
                            "字段必须面向数据库落库，不要输出诊断或医疗建议。"
                            "如果信息不足，保留 null 并给 warnings。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "将用户输入解析为 JSON："
                            "{\"confidence\":\"high|medium|low\",\"confidenceScore\":0-1,"
                            "\"warnings\":[\"...\"],\"previewData\":{\"recordedAt\":\"ISO时间\","
                            "\"recordDate\":\"YYYY-MM-DD\",\"recordType\":\"diet|exercise|sleep|mixed|other\","
                            "\"rawInput\":\"原文\",\"sleepMinutes\":null或整数,"
                            "\"intakeCalories\":null或整数,\"exerciseCalories\":null或整数,"
                            "\"nutritionDetails\":{\"foods\":[],\"mealType\":null},"
                            "\"exerciseDetails\":{\"items\":[]},\"healthTags\":[],"
                            "\"parseWarnings\":[]}}\n"
                            f"recordedAt={recorded_at.isoformat() if recorded_at else None}, "
                            f"recordDate={record_date.isoformat() if record_date else None}, "
                            f"rawInput={raw_input}"
                        ),
                    },
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)

    def _parse_with_rules(
        self,
        raw_input: str,
        recorded_at: datetime | None,
        record_date: date | None,
    ) -> HealthParsePreview:
        parsed = self.fallback.parse_from_text(raw_input)
        warnings: list[str] = []
        recognized_count = len(
            [
                value
                for value in [
                    parsed["sleep_minutes"],
                    parsed["estimated_intake_kcal"],
                    parsed["estimated_burn_kcal"],
                ]
                if value is not None
            ]
        )
        if recognized_count == 0:
            warnings.append("未识别出明确睡眠、饮食或运动数据，请补充时间、数量或类型。")
        if parsed["sleep_minutes"] is not None and self._looks_like_previous_night(raw_input):
            warnings.append("睡眠时间可能指昨晚，请确认记录日期。")

        confidence_score = {0: 0.25, 1: 0.55, 2: 0.78, 3: 0.9}.get(recognized_count, 0.25)
        confidence = "high" if confidence_score >= 0.8 else "medium" if confidence_score >= 0.6 else "low"
        preview_data = {
            "recordedAt": (recorded_at or datetime.utcnow()).isoformat(),
            "recordDate": (record_date or date.today()).isoformat(),
            "recordType": self._infer_record_type(parsed, raw_input),
            "rawInput": raw_input,
            "sleepMinutes": parsed["sleep_minutes"],
            "intakeCalories": parsed["estimated_intake_kcal"],
            "exerciseCalories": parsed["estimated_burn_kcal"],
            "nutritionDetails": self._extract_nutrition_details(raw_input),
            "exerciseDetails": self._extract_exercise_details(raw_input, parsed["estimated_burn_kcal"]),
            "healthTags": parsed["tags"],
            "confidence": confidence,
            "parseWarnings": warnings,
        }
        return HealthParsePreview(str(uuid4()), confidence, confidence_score, warnings, preview_data)

    def _normalize_payload(
        self,
        payload: dict,
        raw_input: str,
        recorded_at: datetime | None,
        record_date: date | None,
    ) -> HealthParsePreview:
        preview = payload.get("previewData") or {}
        warnings = payload.get("warnings") or preview.get("parseWarnings") or []
        if not isinstance(warnings, list):
            warnings = [str(warnings)]

        preview_data = {
            "recordedAt": preview.get("recordedAt") or (recorded_at or datetime.utcnow()).isoformat(),
            "recordDate": preview.get("recordDate") or (record_date or date.today()).isoformat(),
            "recordType": preview.get("recordType") or "mixed",
            "rawInput": preview.get("rawInput") or raw_input,
            "sleepMinutes": self._int_or_none(preview.get("sleepMinutes")),
            "intakeCalories": self._int_or_none(
                preview.get("intakeCalories") or preview.get("estimatedIntakeKcal") or preview.get("intakeKcal")
            ),
            "exerciseCalories": self._int_or_none(
                preview.get("exerciseCalories") or preview.get("estimatedBurnKcal") or preview.get("burnKcal")
            ),
            "nutritionDetails": preview.get("nutritionDetails") if isinstance(preview.get("nutritionDetails"), dict) else {},
            "exerciseDetails": preview.get("exerciseDetails") if isinstance(preview.get("exerciseDetails"), dict) else {},
            "healthTags": preview.get("healthTags") or preview.get("tags") or [],
            "parseWarnings": warnings,
        }
        score = float(payload.get("confidenceScore") or 0)
        if score <= 0:
            score = self._score_from_preview(preview_data)
        confidence = str(payload.get("confidence") or self._confidence_from_score(score))
        if confidence not in {"high", "medium", "low"}:
            confidence = self._confidence_from_score(score)
        if confidence == "low" and not warnings:
            warnings.append("解析可信度较低，请确认字段后再提交。")
            preview_data["parseWarnings"] = warnings
        preview_data["confidence"] = confidence
        return HealthParsePreview(str(payload.get("parseId") or uuid4()), confidence, min(max(score, 0), 1), warnings, preview_data)

    def _infer_record_type(self, parsed: dict, raw_input: str) -> str:
        types = []
        if parsed["sleep_minutes"] is not None or "睡" in raw_input:
            types.append("sleep")
        if parsed["estimated_intake_kcal"] is not None or any(word in raw_input for word in ["吃", "摄入", "早餐", "午餐", "晚餐"]):
            types.append("diet")
        if parsed["estimated_burn_kcal"] is not None or any(word in raw_input for word in ["跑", "走", "运动", "骑"]):
            types.append("exercise")
        if len(types) > 1:
            return "mixed"
        return types[0] if types else "other"

    def _extract_nutrition_details(self, raw_input: str) -> dict:
        foods = []
        match = re.search(r"(吃了|吃|摄入)(.{1,30}?)(，|,|。|$)", raw_input)
        if match:
            foods.append(match.group(2).strip())
        meal_type = None
        for key in ["早餐", "午餐", "中午", "晚餐", "晚上"]:
            if key in raw_input:
                meal_type = "lunch" if key in ["午餐", "中午"] else "dinner" if key in ["晚餐", "晚上"] else "breakfast"
                break
        return {"foods": foods, "mealType": meal_type}

    def _extract_exercise_details(self, raw_input: str, burn_kcal: int | None) -> dict:
        items = []
        duration = None
        duration_match = re.search(r"(\d+)\s*分钟", raw_input)
        if duration_match:
            duration = int(duration_match.group(1))
        for exercise_type in ["跑步", "快走", "散步", "骑行", "运动"]:
            if exercise_type in raw_input:
                items.append({"type": exercise_type, "durationMinutes": duration, "estimatedBurnKcal": burn_kcal})
                break
        return {"items": items}

    def _score_from_preview(self, preview_data: dict) -> float:
        recognized_count = len(
            [
                value
                for value in [
                    preview_data.get("sleepMinutes"),
                    preview_data.get("intakeCalories"),
                    preview_data.get("exerciseCalories"),
                ]
                if value is not None
            ]
        )
        return {0: 0.25, 1: 0.55, 2: 0.78, 3: 0.9}.get(recognized_count, 0.25)

    def _confidence_from_score(self, score: float) -> str:
        if score >= 0.8:
            return "high"
        if score >= 0.6:
            return "medium"
        return "low"

    def _looks_like_previous_night(self, raw_input: str) -> bool:
        return any(word in raw_input for word in ["昨晚", "昨天晚上", "昨夜"])

    def _int_or_none(self, value) -> int | None:
        if value is None or value == "":
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    def _chat_completions_url(self, api_base: str) -> str:
        base = api_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"
