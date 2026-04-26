from datetime import date

from pydantic import AliasChoices, BaseModel, Field


class HealthDataSubmitReq(BaseModel):
    recordDate: date | None = None
    rawInput: str | None = Field(default=None, max_length=500)
    sleepHours: float | None = Field(default=None, ge=0, le=24)
    sleepMinutes: int | None = Field(default=None, ge=0, le=1440)
    intakeCalories: int | None = Field(
        default=None,
        ge=0,
        le=10000,
        validation_alias=AliasChoices("intakeCalories", "intakeKcal", "estimatedIntakeKcal"),
    )
    exerciseCalories: int | None = Field(
        default=None,
        ge=0,
        le=10000,
        validation_alias=AliasChoices("exerciseCalories", "burnKcal", "estimatedBurnKcal"),
    )
    tags: list[str] | None = Field(default=None, validation_alias=AliasChoices("tags", "healthTags"))
    nutritionDetails: dict | None = None


class HealthRecordConfirmReq(BaseModel):
    previewData: dict | None = None
    userModifiedData: dict | None = None
    recordDate: date | None = None
    rawInput: str | None = Field(default=None, max_length=500)


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
