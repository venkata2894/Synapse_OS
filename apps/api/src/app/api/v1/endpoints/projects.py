from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import Actor, get_current_actor
from app.schemas.project import ManagerAssignment, ProjectCreate, ProjectUpdate
from app.services.policies import PolicyError, ensure_single_manager
from app.services.repository import PROJECTS, create_project, update_project, archive_project

router = APIRouter()


@router.post("")
def create_project_endpoint(payload: ProjectCreate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    return create_project(payload)


@router.patch("/{project_id}")
def update_project_endpoint(project_id: str, payload: ProjectUpdate, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    if project_id not in PROJECTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return update_project(project_id, payload)


@router.post("/{project_id}/archive")
def archive_project_endpoint(project_id: str, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    if project_id not in PROJECTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return archive_project(project_id)


@router.post("/{project_id}/manager")
def assign_manager(project_id: str, payload: ManagerAssignment, actor: Actor = Depends(get_current_actor)) -> dict:
    _ = actor
    project = PROJECTS.get(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    try:
        ensure_single_manager(project.get("manager_agent_id"), payload.manager_agent_id)
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    project["manager_agent_id"] = payload.manager_agent_id
    return project

