from pydantic import BaseModel, Field


class ProfileUpsertReq(BaseModel):
    gender: int | None = Field(default=None, ge=0, le=2)
    height: float | None = Field(default=None, gt=0, le=260)
    weight: float | None = Field(default=None, gt=0, le=400)
    healthGoal: str = Field(min_length=1, max_length=50)
    medicalHistory: str | None = Field(default=None, max_length=255)


class ProfileResp(BaseModel):
    userId: int
    gender: int | None = None
    height: float | None = None
    weight: float | None = None
    healthGoal: str
    medicalHistory: str | None = None

