from datetime import date, timedelta

from app.models.health_record import HealthRecord


class TrendService:
    def build_series(self, records: list[HealthRecord], days: int) -> dict:
        start = date.today() - timedelta(days=days - 1)
        buckets: dict[date, dict] = {}
        for i in range(days):
            day = start + timedelta(days=i)
            buckets[day] = {"sleep": 0, "intake": 0, "burn": 0, "count": 0, "tags": {}}

        for record in records:
            day = record.record_date
            if day not in buckets:
                continue
            buckets[day]["sleep"] += int(record.sleep_minutes or 0)
            buckets[day]["intake"] += int(record.estimated_intake_kcal or 0)
            buckets[day]["burn"] += int(record.estimated_burn_kcal or 0)
            buckets[day]["count"] += 1
            for tag in (record.health_tags or []):
                buckets[day]["tags"][tag] = buckets[day]["tags"].get(tag, 0) + 1

        categories: list[str] = []
        sleep_series: list[int] = []
        intake_series: list[int] = []
        burn_series: list[int] = []
        tag_distribution: dict[str, int] = {}

        for day, payload in buckets.items():
            categories.append(day.isoformat())
            count = max(payload["count"], 1)
            sleep_series.append(int(payload["sleep"] / count))
            intake_series.append(int(payload["intake"] / count))
            burn_series.append(int(payload["burn"] / count))
            for tag, val in payload["tags"].items():
                tag_distribution[tag] = tag_distribution.get(tag, 0) + val

        return {
            "categories": categories,
            "sleepSeries": sleep_series,
            "intakeSeries": intake_series,
            "burnSeries": burn_series,
            "tagDistribution": tag_distribution,
        }

