from datetime import date, datetime

from pydantic import BaseModel, Field


class TaskCheckReq(BaseModel):
    taskId: int
    status: int = Field(ge=0, le=1)


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

