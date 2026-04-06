from app.db.base import Base
from app.db.session import engine
from app.models import advice_history, daily_task, health_record, health_summary, user


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

