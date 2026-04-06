from datetime import date

from pydantic import BaseModel, Field


class HealthDataSubmitReq(BaseModel):
    recordDate: date | None = None
    rawInput: str | None = Field(default=None, max_length=500)
    sleepHours: float | None = Field(default=None, ge=0, le=24)
    sleepMinutes: int | None = Field(default=None, ge=0, le=1440)
    intakeCalories: int | None = Field(default=None, ge=0, le=10000)
    exerciseCalories: int | None = Field(default=None, ge=0, le=10000)
    tags: list[str] | None = None
    nutritionDetails: dict | None = None


class HealthDataSubmitResp(BaseModel):
    recordId: int
    confidence: str


class DashboardResp(BaseModel):
    completionRate: int
    categories: list[str]
    sleepSeries: list[int]
    intakeSeries: list[int]
    burnSeries: list[int]


class TrendsResp(BaseModel):
    dimension: str
    categories: list[str]
    sleepSeries: list[int]
    intakeSeries: list[int]
    burnSeries: list[int]
    tagDistribution: dict[str, int]

