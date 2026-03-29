from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.schemas.evaluation import EvaluationCreate, EvaluationOverrideRequest, EvaluationRequest
from app.services.policies import build_override_audit
from app.services.repository import (
    EVALUATIONS,
    EVALUATION_OVERRIDE_AUDIT,
    EVALUATION_QUEUE,
    create_evaluation,
)

router = APIRouter()


@router.post("/request")
def request_evaluation(payload: EvaluationRequest, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    job = payload.model_dump()
    EVALUATION_QUEUE.append(job)
    return {"queued": True, "job": job}


@router.post("/submit")
def submit_evaluation(payload: EvaluationCreate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    return create_evaluation(payload)


@router.post("/{evaluation_id}/override")
def override_evaluation(
    evaluation_id: str,
    payload: EvaluationOverrideRequest,
    actor: Actor = Depends(get_current_actor),
) -> dict:
    _ = actor
    evaluation = EVALUATIONS.get(evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="evaluation not found")

    original = {
        "score_completion": evaluation["score_completion"],
        "score_quality": evaluation["score_quality"],
        "score_reliability": evaluation["score_reliability"],
        "score_handover": evaluation["score_handover"],
        "score_context": evaluation["score_context"],
        "score_clarity": evaluation["score_clarity"],
        "score_improvement": evaluation["score_improvement"],
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
    EVALUATION_OVERRIDE_AUDIT.append(
        {
            "evaluation_id": evaluation_id,
            "owner_id": audit.owner_id,
            "reason": audit.reason,
            "original_scores": audit.original_scores,
            "override_scores": audit.override_scores,
            "timestamp": audit.timestamp.isoformat(),
        }
    )
    evaluation.update(override_scores)
    evaluation["override_reason"] = payload.reason
    return {"evaluation": evaluation, "audit_recorded": True}

