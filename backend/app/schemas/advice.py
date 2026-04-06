from datetime import datetime

from pydantic import BaseModel


class AdviceHistoryRespItem(BaseModel):
    adviceId: int
    adviceText: str
    createdAt: datetime


class AdviceTaskItem(BaseModel):
    taskId: int
    taskContent: str
    aiReason: str | None = None


class AdviceResult(BaseModel):
    adviceText: str
    tasks: list[dict]

