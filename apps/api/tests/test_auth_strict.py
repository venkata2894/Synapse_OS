from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_header_auth_rejected_when_strict_clerk_enabled() -> None:
    client = TestClient(app)
    original = settings.sentientops_enforce_clerk_jwt
    try:
        settings.sentientops_enforce_clerk_jwt = True
        response = client.get("/api/v1/projects", headers={"X-Actor-Id": "owner-1", "X-Actor-Role": "owner"})
        assert response.status_code == 401
    finally:
        settings.sentientops_enforce_clerk_jwt = original
