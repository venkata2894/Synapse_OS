from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def _headers() -> dict[str, str]:
    return {"X-Actor-Id": "owner-1", "X-Actor-Role": "owner"}


def test_read_list_endpoints_and_filters() -> None:
    client = TestClient(app)
    headers = _headers()

    project = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Atlas",
            "description": "Delivery workflow",
            "objective": "Ship beta",
            "owner": "owner-1",
            "status": "active",
            "tags": ["v1"],
        },
    ).json()

    worker = client.post(
        "/api/v1/agents",
        headers=headers,
        json={
            "name": "Worker One",
            "role": "worker",
            "type": "project_side",
            "project_id": project["id"],
            "capabilities": ["coding"],
            "status": "active",
        },
    ).json()

    task = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "project_id": project["id"],
            "title": "Build feature",
            "description": "Implement flow",
            "created_by": "manager-1",
            "assigned_to": worker["id"],
            "priority": "high",
            "status": "assigned",
            "dependencies": [],
            "acceptance_criteria": "Feature works",
            "context_refs": [],
            "parent_task_depth": 0,
        },
    ).json()

    client.post(
        "/api/v1/evaluations/submit",
        headers=headers,
        json={
            "project_id": project["id"],
            "task_id": task["id"],
            "agent_id": worker["id"],
            "evaluator_agent_id": "eval-1",
            "score_completion": 4,
            "score_quality": 4,
            "score_reliability": 4,
            "score_handover": 4,
            "score_context": 4,
            "score_clarity": 4,
            "score_improvement": 4,
            "missed_points": ["missing detail"],
            "strengths": ["speed"],
            "weaknesses": ["quality"],
            "recommendations": "Add checks",
        },
    )

    projects = client.get("/api/v1/projects", headers=headers).json()
    project_read = client.get(f"/api/v1/projects/{project['id']}", headers=headers).json()
    tasks = client.get(f"/api/v1/tasks?project_id={project['id']}&status=assigned", headers=headers).json()
    agents = client.get(f"/api/v1/agents?project_id={project['id']}&role=worker", headers=headers).json()
    evaluations = client.get(f"/api/v1/evaluations?project_id={project['id']}", headers=headers).json()
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    board = client.get(f"/api/v1/boards/{project['id']}", headers=headers).json()

    assert projects["count"] == 1
    assert project_read["id"] == project["id"]
    assert tasks["count"] == 1
    assert tasks["items"][0]["id"] == task["id"]
    assert agents["count"] == 1
    assert evaluations["count"] == 1
    assert summary["totals"]["active_projects"] == 1
    assert summary["totals"]["low_score_alerts"] == 1
    assert board["project_id"] == project["id"]
    assert any(lane["status"] == "assigned" for lane in board["lanes"])
