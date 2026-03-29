from __future__ import annotations

from fastapi import Header, HTTPException, status
from pydantic import BaseModel


class Actor(BaseModel):
    actor_id: str
    role: str = "owner"


def get_current_actor(
    x_actor_id: str | None = Header(default=None, alias="X-Actor-Id"),
    x_actor_role: str | None = Header(default="owner", alias="X-Actor-Role"),
) -> Actor:
    # Clerk JWT verification is intentionally deferred to the next implementation pass.
    if not x_actor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Actor-Id header.",
        )
    return Actor(actor_id=x_actor_id, role=x_actor_role or "owner")

