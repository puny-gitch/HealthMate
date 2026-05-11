from dataclasses import dataclass
import json
from typing import Protocol

import httpx

from app.core.config import get_settings


class IRiskDetector(Protocol):
    def contains_high_risk(self, text: str) -> bool: ...


@dataclass
class RiskDetection:
    is_risky: bool
    reason: str | None = None
    matched_word: str | None = None
    suggestions: list[str] | None = None
    source: str = "rule"


class RiskWordService:
    _risk_words = {
        "疼",
        "痛",
        "不适",
        "难受",
        "发烧",
        "发热",
        "高烧",
        "咳血",
        "吐血",
        "流血不止",
        "腹泻",
        "呕吐",
        "头晕",
        "眩晕",
        "麻木",
        "无力",
        "胸闷",
        "胸痛",
        "呼吸困难",
        "晕厥",
        "便血",
        "呕血",
        "抽搐",
        "剧烈头痛",
        "心梗",
        "心悸",
        "自杀",
        "抑郁发作",
    }

    def contains_high_risk(self, text: str) -> bool:
        return self.analyze(text).is_risky

    def analyze(self, text: str) -> RiskDetection:
        if not text:
            return RiskDetection(False, source="empty")
        llm_detection = self._detect_with_llm(text)
        if llm_detection is not None:
            return llm_detection
        return self._detect_with_rules(text)

    def detect(self, text: str) -> str | None:
        detection = self._detect_with_rules(text)
        return detection.matched_word

    def warning_message(self, text: str, detection: RiskDetection | None = None) -> str:
        result = detection or self.analyze(text)
        if result.reason:
            return result.reason
        if result.matched_word:
            return f"检测到可能涉及病痛或高危症状（{result.matched_word}），本条记录不会保存，请及时就医或咨询专业医生。"
        return "检测到可能涉及病痛或高危症状，本条记录不会保存，请及时就医或咨询专业医生。"

    def _detect_with_rules(self, text: str) -> RiskDetection:
        if not text:
            return RiskDetection(False, source="rule")
        source = text.lower()
        for word in self._risk_words:
            if word.lower() in source:
                return RiskDetection(
                    True,
                    reason=f"检测到可能涉及病痛或高危症状（{word}），本条记录不会保存，请及时就医或咨询专业医生。",
                    matched_word=word,
                    suggestions=["请及时就医或咨询专业医生。", "病痛症状不作为普通健康记录保存。"],
                    source="rule",
                )
        return RiskDetection(False, source="rule")

    def _detect_with_llm(self, text: str) -> RiskDetection | None:
        settings = get_settings()
        if settings.ai_mode != "llm" or not settings.llm_api_base or not settings.llm_api_key:
            return None
        try:
            response = httpx.post(
                self._chat_completions_url(settings.llm_api_base),
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
                                "你是健康记录安全分类器，只输出 JSON。"
                                "判断用户输入是否超出日常健康记录范畴。"
                                "如果涉及病痛、症状、急性不适、疾病、用药、心理危机、自伤风险，isRisky=true。"
                                "普通日常健康记录如睡眠、饮食、运动、体重、热量、轻微疲劳且无症状诉求，isRisky=false。"
                                "不要做诊断，只给保存拦截原因和就医提醒。"
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "返回 JSON："
                                "{\"isRisky\":true或false,\"riskType\":null或\"pain|symptom|disease|medicine|mental|emergency|other\","
                                "\"matchedText\":null或原文片段,\"reason\":null或给用户看的中文提示,"
                                "\"suggestions\":[\"...\"]}。"
                                f"用户输入：{text}"
                            ),
                        },
                    ],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            payload = json.loads(response.json()["choices"][0]["message"]["content"])
            is_risky = bool(payload.get("isRisky") or payload.get("is_risky"))
            suggestions = payload.get("suggestions") or []
            if not isinstance(suggestions, list):
                suggestions = [str(suggestions)]
            return RiskDetection(
                is_risky=is_risky,
                reason=str(payload.get("reason") or "").strip() or None,
                matched_word=str(payload.get("matchedText") or payload.get("matchedWord") or "").strip() or None,
                suggestions=suggestions,
                source="llm",
            )
        except Exception:
            return None

    def _chat_completions_url(self, api_base: str) -> str:
        base = api_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"
