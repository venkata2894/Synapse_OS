from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SentientOps API"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sentientops"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    sentientops_max_subtask_depth: int = 2
    sentientops_max_subtasks_per_parent: int = 10
    # Comma-separated credentials: agent_id:api_key:role
    sentientops_agent_api_keys: str = "agent-system:soa_dev_agent_key:agent"
    sentientops_enable_mcp: bool = True
    sentientops_seed_demo_data: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
