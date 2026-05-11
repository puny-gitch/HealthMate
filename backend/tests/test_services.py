from app.services.advice import AdviceService, MockAdviceProvider
from app.services.health_parse_ai import HealthAIParseService
from app.services.parse import ParseService
from app.services.risk import RiskWordService
from app.services.task_generation import TaskGenerationService


def test_risk_detector():
    svc = RiskWordService()
    assert svc.contains_high_risk("今天有胸痛和呼吸困难")
    assert svc.contains_high_risk("今天胃痛还发烧")
    assert not svc.contains_high_risk("今天慢跑20分钟")


def test_parse_service():
    svc = ParseService()
    parsed = svc.parse_from_text("我睡了7小时，运动消耗300kcal")
    assert parsed["sleep_minutes"] == 420
    assert parsed["estimated_burn_kcal"] == 300
    assert parsed["confidence"] in {"high", "low"}


def test_mock_advice():
    svc = AdviceService(provider=MockAdviceProvider())
    result = svc.generate_daily({"completion_rate": 80, "avg_sleep_minutes": 360})
    assert "睡眠" in result.advice_text
    assert 1 <= len(result.tasks) <= 3


def test_health_ai_parse_rule_fallback_preview():
    svc = HealthAIParseService()
    result = svc.parse("中午吃了鸡胸肉沙拉，晚上跑步30分钟，昨晚睡了6小时")
    assert result.parse_id
    assert result.should_save
    assert result.preview_data["sleepMinutes"] == 360
    assert result.preview_data["recordType"] in {"mixed", "sleep"}
    assert "previewData" not in result.preview_data


def test_health_ai_parse_rule_fallback_rejects_empty_record():
    svc = HealthAIParseService()
    result = svc.parse("今天还行")
    assert not result.should_save
    assert result.failure_reason
    assert result.preview_data == {}


def test_task_generation_filters_completed_similarity():
    class Task:
        def __init__(self, content, status):
            self.task_content = content
            self.status = status

    svc = TaskGenerationService()
    candidates, skipped = svc.generate_candidates(
        {
            "health_goal": "减脂",
            "recent_records": [],
            "completed_tasks": [Task("晚饭后快走或慢跑 20 分钟", 1)],
            "pending_tasks": [],
            "history_completion_rate": 0,
        },
        max_tasks=3,
    )
    assert skipped
    assert all("晚饭后快走或慢跑 20 分钟" != item.task_content for item in candidates)
