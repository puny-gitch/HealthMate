from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent_trace import AgentRetrievalHit, AgentRun, AgentStep, AgentToolCall


class AgentRepository:
    def create_run(self, db: Session, run: AgentRun) -> AgentRun:
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    def save_run(self, db: Session, run: AgentRun) -> AgentRun:
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    def create_step(self, db: Session, step: AgentStep) -> AgentStep:
        db.add(step)
        db.commit()
        db.refresh(step)
        return step

    def create_tool_call(self, db: Session, call: AgentToolCall) -> AgentToolCall:
        db.add(call)
        db.commit()
        db.refresh(call)
        return call

    def create_retrieval_hits(self, db: Session, hits: list[AgentRetrievalHit]) -> list[AgentRetrievalHit]:
        if not hits:
            return []
        db.add_all(hits)
        db.commit()
        for hit in hits:
            db.refresh(hit)
        return hits

    def list_runs(self, db: Session, user_id: int, limit: int = 20) -> list[AgentRun]:
        stmt = (
            select(AgentRun)
            .where(AgentRun.user_id == user_id)
            .order_by(AgentRun.run_id.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def get_run(self, db: Session, user_id: int, run_id: int) -> AgentRun | None:
        stmt = select(AgentRun).where(AgentRun.user_id == user_id, AgentRun.run_id == run_id)
        return db.scalar(stmt)

    def list_steps(self, db: Session, run_id: int) -> list[AgentStep]:
        stmt = select(AgentStep).where(AgentStep.run_id == run_id).order_by(AgentStep.step_id.asc())
        return list(db.scalars(stmt).all())

    def list_tool_calls(self, db: Session, run_id: int) -> list[AgentToolCall]:
        stmt = select(AgentToolCall).where(AgentToolCall.run_id == run_id).order_by(AgentToolCall.call_id.asc())
        return list(db.scalars(stmt).all())

    def list_retrieval_hits(self, db: Session, run_id: int) -> list[AgentRetrievalHit]:
        stmt = (
            select(AgentRetrievalHit)
            .where(AgentRetrievalHit.run_id == run_id)
            .order_by(AgentRetrievalHit.score.desc(), AgentRetrievalHit.hit_id.asc())
        )
        return list(db.scalars(stmt).all())
