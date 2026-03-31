from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer soa_dev_agent_key"}


def test_agent_manifest_requires_and_accepts_bearer_auth() -> None:
    client = TestClient(app)

    unauthorized = client.get("/api/v1/agent-tools/manifest")
    assert unauthorized.status_code == 401

    authorized = client.get("/api/v1/agent-tools/manifest", headers=_auth_headers())
    assert authorized.status_code == 200
    body = authorized.json()
    assert body["tool_count"] >= 10
    assert any(tool["name"] == "create_project" for tool in body["tools"])


def test_agent_tool_idempotency_reuses_first_response() -> None:
    client = TestClient(app)
    headers = {**_auth_headers(), "Idempotency-Key": "create-project-001"}
    payload = {
        "name": "Atlas",
        "description": "Agent-run project",
        "objective": "Ship baseline",
        "owner": "owner-1",
        "status": "active",
        "tags": ["v1"],
    }

    first = client.post("/api/v1/agent-tools/create_project", headers=headers, json=payload)
    second = client.post("/api/v1/agent-tools/create_project", headers=headers, json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["idempotency_reused"] is True
    assert first.json()["result"]["id"] == second.json()["response"]["result"]["id"]


def test_transition_task_tool_enforces_guardrails() -> None:
    client = TestClient(app)
    headers = _auth_headers()

    project = client.post(
        "/api/v1/agent-tools/create_project",
        headers=headers,
        json={
            "name": "Ops Core",
            "description": "Tooling test",
            "objective": "Validate transitions",
            "owner": "owner-1",
            "status": "active",
            "tags": ["v1"],
        },
    ).json()["result"]

    task = client.post(
        "/api/v1/agent-tools/create_task",
        headers=headers,
        json={
            "project_id": project["id"],
            "title": "Transition test",
            "description": "Validate matrix",
            "created_by": "mgr",
            "priority": "medium",
            "status": "ready",
            "dependencies": [],
            "acceptance_criteria": "Transitions validated",
            "context_refs": [],
            "parent_task_depth": 0,
        },
    ).json()["result"]

    illegal = client.post(
        "/api/v1/agent-tools/transition_task",
        headers=headers,
        json={"task_id": task["id"], "target_status": "completed"},
    )
    assert illegal.status_code == 409
