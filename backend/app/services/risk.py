from typing import Protocol


class IRiskDetector(Protocol):
    def contains_high_risk(self, text: str) -> bool: ...


class RiskWordService:
    _risk_words = {
        "胸痛",
        "呼吸困难",
        "晕厥",
        "便血",
        "呕血",
        "抽搐",
        "剧烈头痛",
        "心悸",
        "自杀",
        "抑郁发作",
    }

    def contains_high_risk(self, text: str) -> bool:
        if not text:
            return False
        source = text.lower()
        return any(word.lower() in source for word in self._risk_words)

