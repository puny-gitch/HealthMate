from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services.advice import AdviceResult, AdviceService, LLMAdviceProvider


CASES = [
    {
        "name": "sleep_weight_loss",
        "metrics": {
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
                }
            ],
            "latest_summary": {"summaryContent": "本周睡眠偏少，饮食中高热量餐次较多，运动消耗偏低。"},
        },
    },
    {
        "name": "hotpot_milk_tea",
        "metrics": {
            "completion_rate": 70,
            "avg_sleep_minutes": 430,
            "gap_days": 0,
            "health_goal": "控制饮食",
            "recent_records": [
                {
                    "date": "2026-05-21",
                    "sleepMinutes": 430,
                    "intakeKcal": 1600,
                    "burnKcal": 80,
                    "tags": ["高热量饮食", "饮食关注"],
                    "rawInput": "今天吃了火锅、油碟和奶茶。",
                }
            ],
            "latest_summary": {"summaryContent": "今日饮食热量密度偏高，运动消耗偏少。"},
        },
    },
    {
        "name": "sedentary_low_activity",
        "metrics": {
            "completion_rate": 30,
            "avg_sleep_minutes": 460,
            "gap_days": 0,
            "health_goal": "提高体能",
            "recent_records": [
                {
                    "date": "2026-05-22",
                    "sleepMinutes": 460,
                    "intakeKcal": 900,
                    "burnKcal": 40,
                    "tags": ["久坐", "运动不足"],
                    "rawInput": "今天久坐一整天，只散步了10分钟。",
                }
            ],
            "latest_summary": {"summaryContent": "最近活动量不足，任务完成率偏低。"},
        },
    },
    {
        "name": "late_night_snack",
        "metrics": {
            "completion_rate": 50,
            "avg_sleep_minutes": 390,
            "gap_days": 0,
            "health_goal": "保持健康",
            "recent_records": [
                {
                    "date": "2026-05-23",
                    "sleepMinutes": 390,
                    "intakeKcal": 1100,
                    "burnKcal": 150,
                    "tags": ["夜宵", "睡眠不足"],
                    "rawInput": "昨晚熬夜，睡前吃了炸鸡夜宵。",
                }
            ],
            "latest_summary": {"summaryContent": "夜宵和熬夜同时出现，可能影响睡眠连续性。"},
        },
    },
    {
        "name": "joint_history_exercise",
        "metrics": {
            "completion_rate": 65,
            "avg_sleep_minutes": 450,
            "gap_days": 0,
            "health_goal": "减脂",
            "medical_history": "膝盖旧伤",
            "recent_records": [
                {
                    "date": "2026-05-24",
                    "sleepMinutes": 450,
                    "intakeKcal": 900,
                    "burnKcal": 60,
                    "tags": ["低冲击运动", "伤病史"],
                    "rawInput": "膝盖旧伤，今天只走路10分钟。",
                }
            ],
            "latest_summary": {"summaryContent": "有膝盖旧伤，运动建议需要控制冲击。"},
        },
    },
    {
        "name": "blood_sugar_boundary",
        "metrics": {
            "completion_rate": 55,
            "avg_sleep_minutes": 420,
            "gap_days": 0,
            "health_goal": "控制血糖",
            "medical_history": "血糖偏高",
            "recent_records": [
                {
                    "date": "2026-05-25",
                    "sleepMinutes": 420,
                    "intakeKcal": 1300,
                    "burnKcal": 100,
                    "tags": ["血糖管理", "高糖饮品"],
                    "rawInput": "今天喝了甜奶茶，晚饭主食比较多。",
                }
            ],
            "latest_summary": {"summaryContent": "近期含糖饮品和主食摄入偏多，需要生活方式层面提醒。"},
        },
    },
    {
        "name": "stress_emotional_eating",
        "metrics": {
            "completion_rate": 25,
            "avg_sleep_minutes": 350,
            "gap_days": 0,
            "health_goal": "保持健康",
            "recent_records": [
                {
                    "date": "2026-05-26",
                    "sleepMinutes": 350,
                    "intakeKcal": 1400,
                    "burnKcal": 30,
                    "tags": ["压力", "情绪性进食", "睡眠不足"],
                    "rawInput": "最近压力很大，熬夜后吃了很多甜食。",
                }
            ],
            "latest_summary": {"summaryContent": "压力、睡眠不足和高糖饮食同时出现，任务完成率较低。"},
        },
    },
    {
        "name": "low_quality_record",
        "metrics": {
            "completion_rate": 80,
            "avg_sleep_minutes": 430,
            "gap_days": 1,
            "health_goal": "提升记录质量",
            "recent_records": [
                {
                    "date": "2026-05-27",
                    "sleepMinutes": None,
                    "intakeKcal": None,
                    "burnKcal": None,
                    "tags": ["低质量输入", "记录不完整"],
                    "rawInput": "今天还行，吃了点东西，运动了一下。",
                }
            ],
            "latest_summary": {"summaryContent": "最近记录缺少餐次、份量、运动时长等关键信息。"},
        },
    },
    {
        "name": "muscle_gain_recovery",
        "metrics": {
            "completion_rate": 60,
            "avg_sleep_minutes": 410,
            "gap_days": 0,
            "health_goal": "增肌",
            "recent_records": [
                {
                    "date": "2026-05-28",
                    "sleepMinutes": 410,
                    "intakeKcal": 1000,
                    "burnKcal": 260,
                    "tags": ["力量训练", "蛋白质摄入", "恢复不足"],
                    "rawInput": "今天力量训练45分钟，吃得不多，睡了不到7小时。",
                }
            ],
            "latest_summary": {"summaryContent": "有力量训练，但摄入和睡眠恢复可能不足。"},
        },
    },
]

ACTION_WORDS = ["建议", "避免", "记录", "提前", "增加", "减少", "控制", "选择", "进行", "保持", "替换", "优先"]
MOCK_PATTERNS = ["优先修复睡眠节律", "保持中等强度", "稳步推进", "先从最容易完成的习惯开始"]


@dataclass
class EvaluationRow:
    case: str
    mode: str
    is_fallback: bool
    retrieved_chunks: int
    advice_chars: int
    task_count: int
    numeric_suggestions: int
    action_word_hits: int
    knowledge_overlap_hits: int
    advice_text: str


def main() -> None:
    settings = get_settings()
    if not (settings.llm_api_base and settings.llm_api_key):
        print("LLM_API_BASE or LLM_API_KEY is not configured. This evaluation needs real LLM output.")
        return

    provider = LLMAdviceProvider()
    service = AdviceService(provider=provider)
    original_enabled = settings.knowledge_enabled
    rows: list[EvaluationRow] = []

    for case in CASES:
        for enabled, mode in [(False, "no_rag"), (True, "rag")]:
            settings.knowledge_enabled = enabled
            context = service.build_context(case["metrics"])
            result = provider.generate(context)
            rows.append(evaluate_result(service, case["name"], mode, context, result))

    settings.knowledge_enabled = original_enabled
    print_table(rows)
    write_json(rows)


def evaluate_result(
    service: AdviceService,
    case: str,
    mode: str,
    context: dict,
    result: AdviceResult,
) -> EvaluationRow:
    knowledge_context = context.get("knowledge_context") or ""
    advice_text = result.advice_text
    task_count = len(result.tasks or [])
    numeric_suggestions = len(re.findall(r"\d+(?:\.\d+)?", advice_text))
    action_word_hits = sum(1 for word in ACTION_WORDS if word in advice_text)
    knowledge_terms = extract_terms(knowledge_context)
    knowledge_overlap_hits = sum(1 for term in knowledge_terms if term in advice_text)
    retrieved_chunks = len(service.knowledge_service.search(build_search_query(context), top_k=3)) if knowledge_context else 0
    return EvaluationRow(
        case=case,
        mode=mode,
        is_fallback=is_fallback_result(result),
        retrieved_chunks=retrieved_chunks,
        advice_chars=len(advice_text),
        task_count=task_count,
        numeric_suggestions=numeric_suggestions,
        action_word_hits=action_word_hits,
        knowledge_overlap_hits=knowledge_overlap_hits,
        advice_text=advice_text,
    )


def extract_terms(text: str) -> set[str]:
    if not text:
        return set()
    candidates = re.findall(r"[\u4e00-\u9fff]{2,6}", text)
    stopwords = {"建议", "可以", "如果", "通常", "应该", "避免", "进行", "优先", "相关", "影响"}
    return {item for item in candidates if item not in stopwords}


def build_search_query(context: dict) -> str:
    parts: list[str] = []
    if context.get("health_goal"):
        parts.append(str(context["health_goal"]))
    latest_summary = context.get("latest_summary") or {}
    if latest_summary.get("summaryContent"):
        parts.append(str(latest_summary["summaryContent"]))
    for record in context.get("recent_records") or []:
        parts.extend(record.get("tags") or [])
    return " ".join(parts)


def is_fallback_result(result: AdviceResult) -> bool:
    text = result.advice_text or ""
    return any(pattern in text for pattern in MOCK_PATTERNS)


def print_table(rows: list[EvaluationRow]) -> None:
    print("| Case | Mode | Fallback | Chunks | Chars | Tasks | Numbers | Actions | Knowledge Hits |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for row in rows:
        print(
            f"| {row.case} | {row.mode} | {row.is_fallback} | {row.retrieved_chunks} | {row.advice_chars} | "
            f"{row.task_count} | {row.numeric_suggestions} | {row.action_word_hits} | "
            f"{row.knowledge_overlap_hits} |"
        )
    print()
    print("Metrics are reported separately to avoid hiding quality tradeoffs behind a subjective weighted score.")
    print("Fallback=True means the row likely came from MockAdviceProvider and should not be used as LLM quality evidence.")
    print("Full advice texts were saved to backend/rag_evaluation_results.json")


def write_json(rows: list[EvaluationRow]) -> None:
    output_path = Path(__file__).resolve().parents[1] / "rag_evaluation_results.json"
    output_path.write_text(json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
