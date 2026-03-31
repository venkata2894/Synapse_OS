from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class TesterSettings(BaseSettings):
    openai_api_key: str
    openai_tester_model: str = "gpt-5"
    sentientops_uat_base_url: str = "http://localhost:3000"
    sentientops_api_base_url: str = "http://localhost:8000/api/v1"
    sentientops_agent_api_key: str
    sentientops_tester_auth_mode: str = "local_bypass"
    sentientops_qa_project_prefix: str = "qa"
    sentientops_owner_actor_id: str = "owner-local-dev"
    sentientops_browser_headless: bool = True
    sentientops_browser_timeout_ms: int = 20000
    sentientops_browser_viewport_width: int = 1440
    sentientops_browser_viewport_height: int = 1024
    sentientops_report_dir: str = "reports/uat"
    sentientops_mcp_pythonpath: str = "apps/api/src"
    sentientops_mcp_workdir: str = "."
    sentientops_max_runtime_seconds: int = Field(default=600, ge=60, le=7200)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
