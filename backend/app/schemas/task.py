from datetime import date, datetime

from pydantic import BaseModel, Field


class TaskCheckReq(BaseModel):
    taskId: int
    status: int = Field(ge=0, le=1)


class TaskGeneratePreviewReq(BaseModel):
    targetDate: date | None = None
    maxTasks: int = Field(default=3, ge=1, le=5)


class TaskDraftItem(BaseModel):
    draftId: str | None = None
    taskContent: str = Field(min_length=1, max_length=255)
    aiReason: str | None = None
    difficulty: str | None = None
    similarityWarning: bool | None = None


class TaskAddSelectedReq(BaseModel):
    targetDate: date | None = None
    tasks: list[TaskDraftItem] = Field(min_length=1, max_length=5)


class TaskItem(BaseModel):
    taskId: int
    taskDate: date
    taskContent: str
    status: int
    aiReason: str | None = None
    updatedAt: datetime


class TaskHistoryResp(BaseModel):
    tasks: list[TaskItem]
    completionRate: int
