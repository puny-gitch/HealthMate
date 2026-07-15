from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.exceptions import AppException
from app.core.response import api_success
from app.db.session import get_db
from app.repositories.agent_repository import AgentRepository

router = APIRouter(prefix="/agent", tags=["agent-trace"])
agent_repository = AgentRepository()


@router.get("/runs")
def list_agent_runs(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    runs = agent_repository.list_runs(db, user_id, limit)
    return api_success(
        [
            {
                "runId": run.run_id,
                "runType": run.run_type,
                "status": run.status,
                "latencyMs": run.latency_ms,
                "fallbackUsed": run.fallback_used,
                "errorMessage": run.error_message,
                "createdAt": run.created_at.isoformat(),
            }
            for run in runs
        ],
        "query success",
    )


@router.get("/runs/{run_id}")
def get_agent_run(
    run_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    run = agent_repository.get_run(db, user_id, run_id)
    if not run:
        raise AppException("agent run not found", code=40440, status_code=404)
    steps = agent_repository.list_steps(db, run_id)
    tool_calls = agent_repository.list_tool_calls(db, run_id)
    retrieval_hits = agent_repository.list_retrieval_hits(db, run_id)
    return api_success(
        {
            "run": {
                "runId": run.run_id,
                "runType": run.run_type,
                "status": run.status,
                "inputSnapshot": run.input_snapshot,
                "outputSnapshot": run.output_snapshot,
                "latencyMs": run.latency_ms,
                "fallbackUsed": run.fallback_used,
                "errorMessage": run.error_message,
                "createdAt": run.created_at.isoformat(),
                "updatedAt": run.updated_at.isoformat(),
            },
            "steps": [
                {
                    "stepId": step.step_id,
                    "stepName": step.step_name,
                    "stepType": step.step_type,
                    "status": step.status,
                    "latencyMs": step.latency_ms,
                    "errorMessage": step.error_message,
                    "createdAt": step.created_at.isoformat(),
                }
                for step in steps
            ],
            "toolCalls": [
                {
                    "callId": call.call_id,
                    "stepId": call.step_id,
                    "toolName": call.tool_name,
                    "success": call.success,
                    "latencyMs": call.latency_ms,
                    "errorMessage": call.error_message,
                    "createdAt": call.created_at.isoformat(),
                }
                for call in tool_calls
            ],
            "retrievalHits": [
                {
                    "hitId": hit.hit_id,
                    "source": hit.source,
                    "title": hit.title,
                    "score": hit.score,
                    "contentPreview": hit.content_preview,
                    "createdAt": hit.created_at.isoformat(),
                }
                for hit in retrieval_hits
            ],
        },
        "query success",
    )
