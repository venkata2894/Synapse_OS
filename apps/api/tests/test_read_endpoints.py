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

    worklog = client.post(
        "/api/v1/worklogs",
        headers=headers,
        json={
            "task_id": task["id"],
            "agent_id": worker["id"],
            "action_type": "progress",
            "summary": "Built initial workflow",
            "detailed_log": "Implemented project staffing API and validated filters.",
            "artifacts": ["api-client.ts", "projects.py"],
            "confidence": 0.82,
        },
    )
    assert worklog.status_code == 200

    projects = client.get("/api/v1/projects", headers=headers).json()
    project_read = client.get(f"/api/v1/projects/{project['id']}", headers=headers).json()
    staffing = client.get(f"/api/v1/projects/{project['id']}/staffing", headers=headers).json()
    tasks = client.get(f"/api/v1/tasks?project_id={project['id']}&status=assigned", headers=headers).json()
    agents = client.get(f"/api/v1/agents?project_id={project['id']}&role=worker", headers=headers).json()
    evaluations = client.get(f"/api/v1/evaluations?project_id={project['id']}", headers=headers).json()
    worklogs = client.get(f"/api/v1/worklogs?project_id={project['id']}&agent_id={worker['id']}", headers=headers).json()
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    board = client.get(f"/api/v1/boards/{project['id']}", headers=headers).json()

    assert projects["count"] == 1
    assert project_read["id"] == project["id"]
    assert staffing["project"]["id"] == project["id"]
    assert staffing["workers"][0]["id"] == worker["id"]
    assert tasks["count"] == 1
    assert tasks["items"][0]["id"] == task["id"]
    assert agents["count"] == 1
    assert evaluations["count"] == 1
    assert worklogs["count"] == 1
    assert worklogs["items"][0]["task_id"] == task["id"]
    assert worklogs["items"][0]["project_id"] == project["id"]
    assert summary["totals"]["active_projects"] == 1
    assert summary["totals"]["low_score_alerts"] == 1
    assert board["project_id"] == project["id"]
    assert any(lane["status"] == "assigned" for lane in board["lanes"])


def test_project_scoped_agent_create_attach_and_detach() -> None:
    client = TestClient(app)
    headers = _headers()

    project_a = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Project A",
            "description": "Ops A",
            "objective": "Ship A",
            "owner": "owner-1",
            "status": "active",
            "tags": ["ops"],
        },
    ).json()
    project_b = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Project B",
            "description": "Ops B",
            "objective": "Ship B",
            "owner": "owner-1",
            "status": "active",
            "tags": ["ops"],
        },
    ).json()

    created = client.post(
        f"/api/v1/projects/{project_a['id']}/agents",
        headers=headers,
        json={
            "name": "Manager A",
            "role": "manager",
            "type": "project_side",
            "capabilities": ["orchestration"],
            "status": "active",
        },
    )
    assert created.status_code == 200
    created_agent = created.json()
    assert created_agent["project_id"] == project_a["id"]

    assign_manager = client.post(
        f"/api/v1/projects/{project_a['id']}/manager",
        headers=headers,
        json={"manager_agent_id": created_agent["id"]},
    )
    assert assign_manager.status_code == 200

    detached = client.post(
        f"/api/v1/projects/{project_a['id']}/agents/{created_agent['id']}/detach",
        headers=headers,
    )
    assert detached.status_code == 200
    assert detached.json()["agent"]["project_id"] is None
    assert detached.json()["project"]["manager_agent_id"] is None

    foreign_agent = client.post(
        "/api/v1/agents",
        headers=headers,
        json={
            "name": "Worker B",
            "role": "worker",
            "type": "project_side",
            "project_id": project_b["id"],
            "capabilities": ["backend"],
            "status": "active",
        },
    ).json()

    attach_conflict = client.post(
        f"/api/v1/projects/{project_a['id']}/agents/attach",
        headers=headers,
        json={"agent_id": foreign_agent["id"]},
    )
    assert attach_conflict.status_code == 409

    attach_success = client.post(
        f"/api/v1/projects/{project_a['id']}/agents/attach",
        headers=headers,
        json={"agent_id": created_agent["id"]},
    )
    assert attach_success.status_code == 200
    assert attach_success.json()["project_id"] == project_a["id"]
