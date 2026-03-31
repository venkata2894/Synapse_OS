from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import Actor, get_current_actor
from app.core.config import settings
from app.schemas.project import ManagerAssignment, ProjectCreate, ProjectUpdate
from app.services.policies import PolicyError, ensure_single_manager
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("")
def list_projects(
    limit: int = Query(default=settings.sentientops_default_page_size, ge=1, le=settings.sentientops_max_page_size),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.list_projects(limit=limit, offset=offset)


@router.post("")
def create_project_endpoint(
    payload: ProjectCreate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    return repo.create_project(payload)


@router.get("/{project_id}")
def get_project_endpoint(
    project_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    project = repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return project


@router.patch("/{project_id}")
def update_project_endpoint(
    project_id: str,
    payload: ProjectUpdate,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    updated = repo.update_project(project_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return updated


@router.post("/{project_id}/archive")
def archive_project_endpoint(
    project_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    archived = repo.archive_project(project_id)
    if not archived:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return archived


@router.post("/{project_id}/manager")
def assign_manager(
    project_id: str,
    payload: ManagerAssignment,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    project = repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    try:
        ensure_single_manager(project.get("manager_agent_id"), payload.manager_agent_id)
    except PolicyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    updated = repo.assign_manager(project_id, payload.manager_agent_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return updated


@router.post("/{project_id}/process/bootstrap")
def bootstrap_project_process(
    project_id: str,
    actor: Actor = Depends(get_current_actor),
    repo: Repository = Depends(get_repository),
) -> dict:
    _ = actor
    project = repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    config = repo.bootstrap_default_process(project_id)
    return {"bootstrapped": True, "config": config}
