from datetime import date, datetime

from pydantic import AliasChoices, BaseModel, Field


class HealthDataSubmitReq(BaseModel):
    recordDate: date | None = None
    recordedAt: datetime | None = None
    recordType: str | None = Field(default=None, max_length=20)
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
    exerciseDetails: dict | None = None
    confidence: str | None = Field(default=None, max_length=10)
    parseWarnings: list[str] | None = None


class HealthRecordConfirmReq(BaseModel):
    parseId: str | None = None
    previewData: dict | None = None
    userModifiedData: dict | None = None
    recordDate: date | None = None
    recordedAt: datetime | None = None
    rawInput: str | None = Field(default=None, max_length=500)


class HealthAIParseReq(BaseModel):
    rawInput: str = Field(min_length=1, max_length=500)
    recordedAt: datetime | None = None
    recordDate: date | None = None


class HealthAIParseResp(BaseModel):
    parseId: str
    confidence: str
    confidenceScore: float
    warnings: list[str]
    previewData: dict


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
