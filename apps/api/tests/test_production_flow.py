from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.repository import Repository
from app.workers.outbox_worker import process_once
from app.db.session import SessionLocal


def _headers() -> dict[str, str]:
    return {"X-Actor-Id": "owner-1", "X-Actor-Role": "owner"}


def test_transition_endpoint_and_timeline() -> None:
    client = TestClient(app)
    headers = _headers()

    project = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Workflow Project",
            "description": "Flow checks",
            "objective": "Ensure process",
            "owner": "owner-1",
            "status": "active",
            "tags": ["workflow"],
        },
    ).json()

    task = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "project_id": project["id"],
            "title": "Task A",
            "description": "Task flow",
            "created_by": "owner-1",
            "assigned_to": "owner-1",
            "priority": "medium",
            "status": "assigned",
            "dependencies": [],
            "acceptance_criteria": "Done",
            "context_refs": [],
            "parent_task_depth": 0,
        },
    ).json()

    in_progress = client.post(
        f"/api/v1/tasks/{task['id']}/transition",
        headers=headers,
        json={"target_status": "in_progress"},
    )
    assert in_progress.status_code == 200

    evaluation = client.post(
        f"/api/v1/tasks/{task['id']}/transition",
        headers=headers,
        json={"target_status": "evaluation"},
    )
    assert evaluation.status_code == 409

    review = client.post(
        f"/api/v1/tasks/{task['id']}/transition",
        headers=headers,
        json={"target_status": "under_review"},
    )
    assert review.status_code == 200
    evaluation = client.post(
        f"/api/v1/tasks/{task['id']}/transition",
        headers=headers,
        json={"target_status": "evaluation"},
    )
    assert evaluation.status_code == 200

    timeline = client.get(f"/api/v1/tasks/{task['id']}/timeline", headers=headers)
    assert timeline.status_code == 200
    assert len(timeline.json()["transitions"]) >= 3


def test_outbox_worker_processes_queued_events() -> None:
    client = TestClient(app)
    headers = _headers()

    project = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Outbox Project",
            "description": "Outbox checks",
            "objective": "Queue processing",
            "owner": "owner-1",
            "status": "active",
            "tags": ["outbox"],
        },
    ).json()

    response = client.post(
        "/api/v1/evaluations/request",
        headers=headers,
        json={
            "project_id": project["id"],
            "task_id": "task-1",
            "agent_id": "agent-1",
            "requested_by": "owner-1",
        },
    )
    assert response.status_code == 200

    processed = process_once()
    assert processed >= 1

    session = SessionLocal()
    try:
        lag = Repository(session).outbox_lag_seconds()
    finally:
        session.close()
    assert lag >= 0
