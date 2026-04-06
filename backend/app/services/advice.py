from dataclasses import dataclass
from datetime import date
from typing import Protocol


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

        if completion_rate >= 80:
            difficulty_text = "你最近执行很稳定，今天可以适度提高挑战。"
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
    def generate(self, context: dict) -> AdviceResult:
        raise NotImplementedError("LLM provider is not implemented in V1")


class AdviceService:
    def __init__(self, provider: IAdviceProvider):
        self.provider = provider

    def build_context(self, metrics: dict) -> dict:
        return {
            "date": str(date.today()),
            "completion_rate": metrics.get("completion_rate", 0),
            "avg_sleep_minutes": metrics.get("avg_sleep_minutes", 0),
        }

    def generate_daily(self, metrics: dict) -> AdviceResult:
        context = self.build_context(metrics)
        return self.provider.generate(context)

