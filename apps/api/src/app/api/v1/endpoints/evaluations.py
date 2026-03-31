from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.schemas.evaluation import EvaluationCreate, EvaluationOverrideRequest, EvaluationRequest
from app.services.policies import build_override_audit
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("")
def list_evaluations(
    project_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    limit: int = Query(default=settings.sentientops_default_page_size, ge=1, le=settings.sentientops_max_page_size),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.list_evaluations(project_id=project_id, agent_id=agent_id, limit=limit, offset=offset)


@router.post("/request")
def request_evaluation(
    payload: EvaluationRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    event = repo.enqueue_outbox_event(
        aggregate_type="task",
        aggregate_id=payload.task_id,
        project_id=payload.project_id,
        event_type="evaluation.requested",
        payload=payload.model_dump(),
    )
    repo.db.commit()
    return {"queued": True, "job": payload.model_dump(), "outbox_event_id": event["id"]}


@router.post("/submit")
def submit_evaluation(
    payload: EvaluationCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.create_evaluation(payload)


@router.post("/{evaluation_id}/override")
def override_evaluation(
    evaluation_id: str,
    payload: EvaluationOverrideRequest,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    evaluations = repo.list_evaluations(limit=500, offset=0)["items"]
    match = next((item for item in evaluations if item["id"] == evaluation_id), None)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="evaluation not found")

    original = {
        "score_completion": int(match["score_completion"]),
        "score_quality": int(match["score_quality"]),
        "score_reliability": int(match["score_reliability"]),
        "score_handover": int(match["score_handover"]),
        "score_context": int(match["score_context"]),
        "score_clarity": int(match["score_clarity"]),
        "score_improvement": int(match["score_improvement"]),
    }
    override_scores = {
        "score_completion": payload.score_completion,
        "score_quality": payload.score_quality,
        "score_reliability": payload.score_reliability,
        "score_handover": payload.score_handover,
        "score_context": payload.score_context,
        "score_clarity": payload.score_clarity,
        "score_improvement": payload.score_improvement,
    }
    audit = build_override_audit(
        owner_id=payload.owner_id,
        reason=payload.reason,
        original_scores=original,
        override_scores=override_scores,
    )
    updated = repo.add_evaluation_override(
        evaluation_id=evaluation_id,
        owner_id=audit.owner_id,
        reason=audit.reason,
        original_scores=audit.original_scores,
        override_scores=audit.override_scores,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="evaluation not found")
    return {"evaluation": updated["evaluation"], "audit_recorded": True}
