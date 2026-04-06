from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HealthSummary(Base):
    __tablename__ = "t_health_summary"

    summary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("t_user.user_id"), nullable=False, index=True)
    summary_cycle: Mapped[str] = mapped_column(String(10), nullable=False)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    summary_content: Mapped[str] = mapped_column(String(200), nullable=False)
    health_trend: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

