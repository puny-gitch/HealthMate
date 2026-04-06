import re


class ParseService:
    def parse_from_text(self, raw_input: str) -> dict:
        text = raw_input or ""
        sleep_minutes = None
        intake_kcal = None
        burn_kcal = None
        tags: list[str] = []

        sleep_hour_match = re.search(r"(\d+(?:\.\d+)?)\s*小?时", text)
        sleep_min_match = re.search(r"(\d+)\s*分钟", text)
        intake_match = re.search(r"(吃|摄入).{0,8}?(\d+)\s*(kcal|卡)", text)
        burn_match = re.search(r"(跑|运动|消耗).{0,8}?(\d+)\s*(kcal|卡)", text)

        if sleep_hour_match:
            sleep_minutes = int(float(sleep_hour_match.group(1)) * 60)
        elif sleep_min_match:
            sleep_minutes = int(sleep_min_match.group(1))

        if intake_match:
            intake_kcal = int(intake_match.group(2))
        if burn_match:
            burn_kcal = int(burn_match.group(2))

        if "跑" in text or "走" in text or "运动" in text:
            tags.append("有氧训练")
        if "睡" in text:
            tags.append("睡眠记录")
        if "糖" in text:
            tags.append("饮食关注")

        recognized_count = len([v for v in [sleep_minutes, intake_kcal, burn_kcal] if v is not None])
        confidence = "high" if recognized_count >= 2 else "low"

        return {
            "sleep_minutes": sleep_minutes,
            "estimated_intake_kcal": intake_kcal,
            "estimated_burn_kcal": burn_kcal,
            "tags": tags,
            "confidence": confidence,
        }

