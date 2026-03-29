from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import repository
from app.services.idempotency import IDEMPOTENCY_CACHE


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer soa_dev_agent_key"}


def _reset_state() -> None:
    repository.PROJECTS.clear()
    repository.AGENTS.clear()
    repository.TASKS.clear()
    repository.WORKLOGS.clear()
    repository.HANDOVERS.clear()
    repository.MEMORY.clear()
    repository.EVALUATIONS.clear()
    repository.EVALUATION_QUEUE.clear()
    repository.EVALUATION_OVERRIDE_AUDIT.clear()
    repository.TASK_CHILDREN.clear()
    IDEMPOTENCY_CACHE.clear()


def test_agent_manifest_requires_and_accepts_bearer_auth() -> None:
    _reset_state()
    client = TestClient(app)

    unauthorized = client.get("/api/v1/agent-tools/manifest")
    assert unauthorized.status_code == 401

    authorized = client.get("/api/v1/agent-tools/manifest", headers=_auth_headers())
    assert authorized.status_code == 200
    body = authorized.json()
    assert body["tool_count"] >= 10
    assert any(tool["name"] == "create_project" for tool in body["tools"])


def test_agent_tool_idempotency_reuses_first_response() -> None:
    _reset_state()
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

