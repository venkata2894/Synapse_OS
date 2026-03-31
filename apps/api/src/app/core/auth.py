from __future__ import annotations

import hmac
import json
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

import jwt
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


@dataclass
class _JwksCache:
    keys: dict[str, Any]
    fetched_at: float


_JWKS_CACHE: _JwksCache | None = None


def _resolve_jwks_url() -> str:
    if settings.sentientops_clerk_jwks_url:
        return settings.sentientops_clerk_jwks_url
    if settings.sentientops_clerk_issuer:
        issuer = settings.sentientops_clerk_issuer.rstrip("/")
        return f"{issuer}/.well-known/jwks.json"
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Clerk JWKS is not configured.",
    )


def _load_jwks() -> dict[str, Any]:
    global _JWKS_CACHE
    now = time.time()
    if _JWKS_CACHE and now - _JWKS_CACHE.fetched_at < 900:
        return _JWKS_CACHE.keys

    url = _resolve_jwks_url()
    with urllib.request.urlopen(url, timeout=5) as response:  # nosec B310 - controlled HTTPS URL
        payload = json.loads(response.read().decode("utf-8"))
    _JWKS_CACHE = _JwksCache(keys=payload, fetched_at=now)
    return payload


def _map_role_from_claims(claims: dict[str, Any]) -> str:
    if isinstance(claims.get("role"), str):
        return claims["role"]
    if isinstance(claims.get("https://sentientops.dev/role"), str):
        return claims["https://sentientops.dev/role"]
    metadata = claims.get("metadata")
    if isinstance(metadata, dict) and isinstance(metadata.get("role"), str):
        return metadata["role"]
    return "owner"


def _verify_clerk_jwt(token: str) -> Actor:
    jwks = _load_jwks()
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing JWT key id.")
    key_data = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            key_data = key
            break
    if not key_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT key id not found.")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
    options = {"verify_aud": bool(settings.sentientops_clerk_audience)}
    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=settings.sentientops_clerk_issuer or None,
            audience=settings.sentientops_clerk_audience or None,
            options=options,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Clerk token: {exc}") from exc

    subject = claims.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token subject.")
    return Actor(actor_id=str(subject), role=_map_role_from_claims(claims), auth_mode="clerk_jwt")


def get_current_actor(
    authorization: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_actor_id: str | None = Header(default=None, alias="X-Actor-Id"),
    x_actor_role: str | None = Header(default="owner", alias="X-Actor-Role"),
    x_auth_mode: str | None = Header(default=None, alias="X-Auth-Mode"),
) -> Actor:
    _ = x_auth_mode
    if authorization and authorization.scheme.lower() == "bearer":
        token = authorization.credentials
        agent_actor = _authenticate_agent_token(token)
        if agent_actor:
            return agent_actor
        return _verify_clerk_jwt(token)

    if settings.sentientops_enforce_clerk_jwt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer Clerk token.",
        )

    if settings.sentientops_allow_header_auth_dev and x_actor_id:
        return Actor(actor_id=x_actor_id, role=x_actor_role or "owner", auth_mode="header")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing auth credentials. Provide Bearer token.",
    )
