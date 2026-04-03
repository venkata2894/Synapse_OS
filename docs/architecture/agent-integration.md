# Agent Integration Architecture

This project is optimized for **machine callers** (AI agents), not only human UI usage.

## Auth Modes
- `Bearer <agent_api_key>` for agent-to-API flows.
- `X-Actor-Id` / `X-Actor-Role` header fallback for local/manual testing.

Environment format:
- `SENTIENTOPS_AGENT_API_KEYS=agent-id:key:role,agent-id-2:key-2:role`

## Agent Tool API
Base path: `/api/v1/agent-tools`

- `GET /manifest`: discover tool names and descriptions.
- `POST /{tool_name}`: invoke one tool call with JSON payload.
- `POST /batch/call`: invoke multiple tools in one request.

Supported tools:
- `create_project`
- `register_agent`
- `create_task`
- `assign_task`
- `claim_task`
- `update_task_status`
- `submit_completion`
- `append_worklog`
- `create_handover`
- `fetch_project_memory`
- `fetch_task_context`
- `request_evaluation`

## Human + Agent Interaction Surfaces
- `/operations` is the primary project-scoped interaction page for staffing and structured work capture.
- `/tasks` remains the detailed execution surface where agents can inspect context and append quick logs.
- `/tools` stays available for raw tool access, debugging, and advanced agent orchestration flows.

## Current Agent Workflow Bias
- Prefer explicit tool/action invocations over conversational ambiguity.
- Prefer structured worklogs over free-form narrative when updating task progress.
- Prefer project-scoped staffing and capability visibility before task mutation.

## Idempotency
Use `Idempotency-Key` header on tool calls to make retries safe from agent orchestrators.

## MCP Integration
- MCP server is mounted at `/mcp` (Streamable HTTP) when enabled.
- Same tool registry is exposed via MCP tools:
  - `tool_manifest`
  - `call_tool`

Run local MCP stdio server:
```powershell
.\.venv\Scripts\python.exe -m app.mcp.server
```

## Security Notes
- Keep real agent keys in secret storage, not in repository.
- Rotate keys regularly and scope keys by environment.
- For production, add persistent credential storage and revocation records.
