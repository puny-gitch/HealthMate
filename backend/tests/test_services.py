from app.services.advice import AdviceService, MockAdviceProvider
from app.services.parse import ParseService
from app.services.risk import RiskWordService


def test_risk_detector():
    svc = RiskWordService()
    assert svc.contains_high_risk("今天有胸痛和呼吸困难")
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

