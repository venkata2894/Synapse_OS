from __future__ import annotations

import hmac

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings


class Actor(BaseModel):
    actor_id: str
    role: str = "owner"
    auth_mode: str = "header"


bearer_scheme = HTTPBearer(auto_error=False)


def _load_agent_credentials() -> dict[str, tuple[str, str]]:
    credentials: dict[str, tuple[str, str]] = {}
    raw = settings.sentientops_agent_api_keys.strip()
    if not raw:
        return credentials
    for chunk in raw.split(","):
        parts = [piece.strip() for piece in chunk.split(":")]
        if len(parts) < 2:
            continue
        agent_id = parts[0]
        agent_key = parts[1]
        role = parts[2] if len(parts) > 2 else "agent"
        if agent_id and agent_key:
            credentials[agent_id] = (agent_key, role)
    return credentials


def _authenticate_agent_token(token: str) -> Actor | None:
    for agent_id, (expected_token, role) in _load_agent_credentials().items():
        if hmac.compare_digest(token, expected_token):
            return Actor(actor_id=agent_id, role=role, auth_mode="agent_key")
    return None


def get_current_actor(
    authorization: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_actor_id: str | None = Header(default=None, alias="X-Actor-Id"),
    x_actor_role: str | None = Header(default="owner", alias="X-Actor-Role"),
) -> Actor:
    if authorization and authorization.scheme.lower() == "bearer":
        actor = _authenticate_agent_token(authorization.credentials)
        if not actor:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid agent API key.",
            )
        return actor

    # Clerk JWT verification is still deferred; header auth remains available for local/manual usage.
    if not x_actor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth credentials. Provide Bearer agent API key or X-Actor-Id header.",
        )
    return Actor(actor_id=x_actor_id, role=x_actor_role or "owner", auth_mode="header")
