from typing import Protocol


class IRiskDetector(Protocol):
    def contains_high_risk(self, text: str) -> bool: ...


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
        return self.detect(text) is not None

    def detect(self, text: str) -> str | None:
        if not text:
            return None
        source = text.lower()
        for word in self._risk_words:
            if word.lower() in source:
                return word
        return None

    def warning_message(self, text: str) -> str:
        word = self.detect(text)
        if word:
            return f"检测到可能涉及病痛或高危症状（{word}），本条记录不会保存，请及时就医或咨询专业医生。"
        return "检测到可能涉及病痛或高危症状，本条记录不会保存，请及时就医或咨询专业医生。"
