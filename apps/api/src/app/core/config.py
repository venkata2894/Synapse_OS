from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[5]


class Settings(BaseSettings):
    app_name: str = "SentientOps API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./sentientops.db"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    sentientops_max_subtask_depth: int = 2
    sentientops_max_subtasks_per_parent: int = 10
    # Comma-separated credentials: agent_id:api_key:role
    sentientops_agent_api_keys: str = "agent-system:soa_dev_agent_key:agent"
    sentientops_enable_mcp: bool = True
    sentientops_seed_demo_data: bool = True
    sentientops_allow_header_auth_dev: bool = True
    sentientops_enforce_clerk_jwt: bool = False
    sentientops_clerk_jwks_url: str | None = None
    sentientops_clerk_issuer: str | None = None
    sentientops_clerk_audience: str | None = None
    sentientops_default_page_size: int = 100
    sentientops_max_page_size: int = 500

    model_config = SettingsConfigDict(env_file=str(REPO_ROOT / ".env"), extra="ignore")


settings = Settings()
