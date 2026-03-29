from fastapi import APIRouter

from app.api.v1.endpoints import agent_tools, agents, dashboard, evaluations, handovers, health, memory, projects, tasks, worklogs

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(agent_tools.router, prefix="/agent-tools", tags=["agent-tools"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(worklogs.router, prefix="/worklogs", tags=["worklogs"])
api_router.include_router(handovers.router, prefix="/handovers", tags=["handovers"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
