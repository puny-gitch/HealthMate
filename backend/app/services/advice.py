from dataclasses import dataclass
from datetime import date
import json
from typing import Protocol

import httpx

from app.core.config import get_settings


@dataclass
class AdviceResult:
    advice_text: str
    tasks: list[dict]


class IAdviceProvider(Protocol):
    def generate(self, context: dict) -> AdviceResult: ...


class MockAdviceProvider:
    def generate(self, context: dict) -> AdviceResult:
        completion_rate = context.get("completion_rate", 0)
        sleep_minutes = context.get("avg_sleep_minutes", 0)
        gap_days = context.get("gap_days", 0)
        health_goal = context.get("health_goal") or "保持健康"

        if gap_days >= 2:
            advice = f"欢迎回来。你已经有{gap_days}天没有记录了，今天先围绕{health_goal}做一个轻量恢复。"
            return AdviceResult(
                advice_text=advice,
                tasks=[
                    {"taskContent": "记录今天的一餐和睡眠计划", "aiReason": "先恢复记录节奏比追求强度更重要"},
                ],
            )

        if completion_rate >= 80:
            difficulty_text = f"你最近执行很稳定，今天可以围绕{health_goal}适度提高挑战。"
            task_count = 3
        elif completion_rate == 0:
            difficulty_text = "先从最容易完成的习惯开始，找回节奏。"
            task_count = 1
        else:
            difficulty_text = "保持中等强度，稳步推进。"
            task_count = 2

        if sleep_minutes and sleep_minutes < 420:
            sleep_text = "优先修复睡眠节律，建议 23:30 前入睡。"
        else:
            sleep_text = "维持当前作息，避免熬夜。"

        advice = f"{sleep_text}{difficulty_text}"

        base_tasks = [
            {"taskContent": "23:30 前入睡", "aiReason": "稳定睡眠有助于恢复和代谢"},
            {"taskContent": "晚饭后快走 20 分钟", "aiReason": "提升消耗并缓解久坐"},
            {"taskContent": "下午茶替换为无糖酸奶+坚果", "aiReason": "减少高糖波动"},
        ]
        return AdviceResult(advice_text=advice, tasks=base_tasks[:task_count])


class LLMAdviceProvider:
    def __init__(self, fallback: IAdviceProvider | None = None):
        self.fallback = fallback or MockAdviceProvider()

    def generate(self, context: dict) -> AdviceResult:
        settings = get_settings()
        if not settings.llm_api_base or not settings.llm_api_key:
            return self.fallback.generate(context)

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
                                "你是非医疗级日常健康习惯监督员。禁止疾病诊断、处方药建议；"
                                "对急性不适应建议立即就医。只输出 JSON。"
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "请基于以下上下文生成今日健康建议和 1-3 个轻量任务。"
                                "JSON 格式：{\"adviceText\":\"...\",\"tasks\":["
                                "{\"taskContent\":\"...\",\"aiReason\":\"...\"}]}\n"
                                f"上下文：{json.dumps(context, ensure_ascii=False)}"
                            ),
                        },
                    ],
                    "temperature": 0.6,
                    "response_format": {"type": "json_object"},
                },
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return self._parse_result(content, context)
        except Exception:
            return self.fallback.generate(context)

    def _parse_result(self, content: str, context: dict) -> AdviceResult:
        payload = json.loads(content)
        advice_text = str(payload.get("adviceText") or payload.get("advice") or "").strip()
        raw_tasks = payload.get("tasks") or []
        tasks = [
            {
                "taskContent": str(item.get("taskContent") or item.get("content") or "").strip(),
                "aiReason": str(item.get("aiReason") or item.get("reason") or "基于今日健康建议生成").strip(),
            }
            for item in raw_tasks
            if isinstance(item, dict) and (item.get("taskContent") or item.get("content"))
        ][:3]
        if not advice_text or not tasks:
            return self.fallback.generate(context)
        return AdviceResult(advice_text=advice_text, tasks=tasks)

    def _chat_completions_url(self, api_base: str) -> str:
        base = api_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"


class AdviceService:
    def __init__(self, provider: IAdviceProvider):
        self.provider = provider

    def build_context(self, metrics: dict) -> dict:
        return {
            "date": str(date.today()),
            "completion_rate": metrics.get("completion_rate", 0),
            "avg_sleep_minutes": metrics.get("avg_sleep_minutes", 0),
            "gap_days": metrics.get("gap_days", 0),
            "health_goal": metrics.get("health_goal"),
            "health_goal_version": metrics.get("health_goal_version"),
            "medical_history": metrics.get("medical_history"),
            "recent_records": metrics.get("recent_records", []),
            "latest_summary": metrics.get("latest_summary"),
        }

    def generate_daily(self, metrics: dict) -> AdviceResult:
        context = self.build_context(metrics)
        return self.provider.generate(context)
