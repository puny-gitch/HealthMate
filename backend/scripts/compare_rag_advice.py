from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services.advice import AdviceService, LLMAdviceProvider


SAMPLE_METRICS = {
    "completion_rate": 40,
    "avg_sleep_minutes": 360,
    "gap_days": 0,
    "health_goal": "减脂",
    "medical_history": "无",
    "recent_records": [
        {
            "date": "2026-05-20",
            "sleepMinutes": 330,
            "intakeKcal": 1200,
            "burnKcal": 120,
            "tags": ["睡眠不足", "高热量饮食"],
            "rawInput": "昨晚睡了5.5小时，晚餐吃了火锅和奶茶。",
        },
        {
            "date": "2026-05-21",
            "sleepMinutes": 390,
            "intakeKcal": 900,
            "burnKcal": 180,
            "tags": ["睡眠记录", "有氧训练"],
            "rawInput": "睡了6.5小时，晚饭后快走30分钟。",
        },
    ],
    "latest_summary": {
        "summaryDate": "2026-05-21",
        "summaryContent": "本周睡眠偏少，饮食中高热量餐次较多，运动消耗偏低。",
        "healthTrend": {
            "avgSleepMinutes": 360,
            "avgIntakeKcal": 1050,
            "avgBurnKcal": 150,
            "tags": {"睡眠不足": 2, "高热量饮食": 1},
        },
    },
}


def main() -> None:
    settings = get_settings()
    provider = LLMAdviceProvider()
    service = AdviceService(provider=provider)
    llm_ready = bool(settings.llm_api_base and settings.llm_api_key)

    original_enabled = settings.knowledge_enabled
    settings.knowledge_enabled = False
    no_rag_context = service.build_context(SAMPLE_METRICS)
    no_rag_result = provider.generate(no_rag_context)

    settings.knowledge_enabled = True
    rag_context = service.build_context(SAMPLE_METRICS)
    rag_result = provider.generate(rag_context)
    settings.knowledge_enabled = original_enabled

    if not llm_ready:
        print("=== Environment Notice ===")
        print(
            "LLM_API_BASE or LLM_API_KEY is not configured. "
            "The script will fall back to MockAdviceProvider, so advice text may not show real RAG quality differences. "
            "Configure LLM_API_BASE and LLM_API_KEY to observe full LLM output comparison."
        )
        print()

    print("=== No RAG Context knowledge_context ===")
    print(no_rag_context.get("knowledge_context") or "[empty]")
    print()
    print("=== RAG Context knowledge_context ===")
    print(rag_context.get("knowledge_context") or "[empty]")
    print()
    print("=== No RAG Advice ===")
    print(no_rag_result.advice_text)
    print()
    print("=== RAG Advice ===")
    print(rag_result.advice_text)


if __name__ == "__main__":
    main()
