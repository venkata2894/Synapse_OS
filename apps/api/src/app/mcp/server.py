from __future__ import annotations

from app.core.auth import Actor
from app.db.session import SessionLocal
from app.services.agent_toolkit import execute_tool, get_tool_manifest
from app.services.repository import Repository

try:
    from mcp.server.fastmcp import FastMCP
except ImportError as exc:  # pragma: no cover - guarded at runtime
    raise RuntimeError("MCP SDK is not installed. Add dependency: mcp>=1.17.0") from exc

mcp = FastMCP("Synapse_OS Agent Toolkit")


@mcp.tool()
def tool_manifest() -> dict:
    return get_tool_manifest()


@mcp.tool()
def call_tool(tool_name: str, payload: dict, agent_id: str = "mcp-agent", role: str = "agent") -> dict:
    actor = Actor(actor_id=agent_id, role=role, auth_mode="mcp")
    session = SessionLocal()
    try:
        repo = Repository(session)
        return execute_tool(tool_name, payload, actor, repo)
    finally:
        session.close()


def get_mcp_asgi_app():
    return mcp.streamable_http_app()


if __name__ == "__main__":
    mcp.run(transport="stdio")
