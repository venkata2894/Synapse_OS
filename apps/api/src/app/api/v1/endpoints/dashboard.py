from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import Actor, get_current_actor
from app.services.repository import EVALUATIONS, HANDOVERS, PROJECTS, TASKS

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    projects = list(PROJECTS.values())
    tasks = list(TASKS.values())
    evaluations = list(EVALUATIONS.values())
    handovers = list(HANDOVERS.values())

    blocked_tasks = [task for task in tasks if task.get("status") == "blocked"]
    in_progress_tasks = [task for task in tasks if task.get("status") == "in_progress"]

    low_score_entries = []
    for evaluation in evaluations:
        score_keys = [
            "score_completion",
            "score_quality",
            "score_reliability",
            "score_handover",
            "score_context",
            "score_clarity",
            "score_improvement",
        ]
        values = [int(evaluation[key]) for key in score_keys if key in evaluation]
        avg = sum(values) / len(values) if values else 0
        if avg < 5:
            low_score_entries.append({"evaluation_id": evaluation["id"], "agent_id": evaluation.get("agent_id"), "avg": avg})

    project_cards = []
    for project in projects:
        project_tasks = [task for task in tasks if task.get("project_id") == project["id"]]
        project_evaluations = [evaluation for evaluation in evaluations if evaluation.get("project_id") == project["id"]]
        project_cards.append(
            {
                "project_id": project["id"],
                "name": project.get("name"),
                "status": project.get("status"),
                "task_count": len(project_tasks),
                "blocked_count": len([task for task in project_tasks if task.get("status") == "blocked"]),
                "evaluation_count": len(project_evaluations),
            }
        )

    return {
        "totals": {
            "active_projects": len([project for project in projects if project.get("status") == "active"]),
            "tasks_in_progress": len(in_progress_tasks),
            "blocked_tasks": len(blocked_tasks),
            "recent_handovers": len(handovers),
            "low_score_alerts": len(low_score_entries),
        },
        "alerts": {
            "blocked_tasks": blocked_tasks[:10],
            "low_scores": low_score_entries[:10],
        },
        "projects": project_cards[:20],
        "recent_handovers": sorted(handovers, key=lambda item: item.get("timestamp", ""), reverse=True)[:10],
        "recent_evaluations": sorted(evaluations, key=lambda item: item.get("timestamp", ""), reverse=True)[:10],
    }

