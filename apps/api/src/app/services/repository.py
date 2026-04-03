from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session
from sqlalchemy.inspection import inspect as sa_inspect

from app.db.session import get_db
from app.models.entities import (
    Agent,
    Evaluation,
    EvaluationOverrideAudit,
    Handover,
    IdempotencyRecord,
    MemoryEntry,
    OutboxEvent,
    Project,
    ProjectProcessConfig,
    Task,
    TaskTransition,
    Worklog,
)
from app.models.enums import (
    AgentRole,
    AgentStatus,
    MemoryPromotionStatus,
    ProjectStatus,
    TaskPriority,
    TaskStatus,
    WorklogActionType,
)
from app.schemas.agent import AgentCreate, AgentStatusUpdate, AgentUpdate
from app.schemas.evaluation import EvaluationCreate
from app.schemas.handover import HandoverCreate
from app.schemas.memory import MemoryPromotionRequest
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.task import TaskCreate
from app.schemas.worklog import WorklogCreate
from app.services.event_stream import broker
from app.services.policies import ensure_assigned_worker_can_claim
from app.services.workflow import (
    DEFAULT_WIP_LIMITS,
    WORKFLOW_STAGES,
    validate_transition_requirements,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def model_to_dict(model: Any) -> dict[str, Any]:
    mapper = sa_inspect(model).mapper
    return {
        attr.columns[0].name: getattr(model, attr.key)
        for attr in mapper.column_attrs
    }


class Repository:
    def __init__(self, session: Session):
        self.db = session

    # -------------------------
    # Project
    # -------------------------
    def list_projects(self, *, limit: int = 100, offset: int = 0) -> dict:
        items = self.db.scalars(
            select(Project).order_by(desc(Project.created_at)).offset(offset).limit(limit)
        ).all()
        count = self.db.scalar(select(func.count()).select_from(Project)) or 0
        return {"items": [model_to_dict(item) for item in items], "count": int(count)}

    def get_project(self, project_id: str) -> dict | None:
        project = self.db.get(Project, project_id)
        return model_to_dict(project) if project else None

    def create_project(self, payload: ProjectCreate) -> dict:
        project = Project(
            name=payload.name,
            description=payload.description,
            objective=payload.objective,
            owner=payload.owner,
            status=payload.status.value,
            tags=payload.tags,
            manager_agent_id=None,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return model_to_dict(project)

    def update_project(self, project_id: str, payload: ProjectUpdate) -> dict | None:
        project = self.db.get(Project, project_id)
        if not project:
            return None
        for key, value in payload.model_dump(exclude_none=True).items():
            setattr(project, key, value.value if hasattr(value, "value") else value)
        self.db.commit()
        self.db.refresh(project)
        return model_to_dict(project)

    def archive_project(self, project_id: str) -> dict | None:
        project = self.db.get(Project, project_id)
        if not project:
            return None
        project.status = ProjectStatus.ARCHIVED.value
        self.db.commit()
        self.db.refresh(project)
        return model_to_dict(project)

    def assign_manager(self, project_id: str, manager_agent_id: str) -> dict | None:
        project = self.db.get(Project, project_id)
        if not project:
            return None
        project.manager_agent_id = manager_agent_id
        self.db.commit()
        self.db.refresh(project)
        return model_to_dict(project)

    def bootstrap_default_process(self, project_id: str) -> dict:
        from app.services.workflow import default_template

        existing = self.db.scalar(
            select(ProjectProcessConfig).where(ProjectProcessConfig.project_id == project_id)
        )
        if existing:
            return model_to_dict(existing)

        template = default_template()
        config = ProjectProcessConfig(
            project_id=project_id,
            template_name=template.name,
            workflow_stages=template.workflow_stages,
            transition_matrix=template.transition_matrix,
            wip_limits=template.wip_limits,
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return model_to_dict(config)

    def get_default_process_template(self) -> dict:
        from app.services.workflow import default_template

        template = default_template()
        return {
            "name": template.name,
            "workflow_stages": template.workflow_stages,
            "transition_matrix": template.transition_matrix,
            "wip_limits": template.wip_limits,
        }

    # -------------------------
    # Agent
    # -------------------------
    def list_agents(
        self,
        *,
        project_id: str | None = None,
        role: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict:
        query = select(Agent)
        if project_id:
            query = query.where(Agent.project_id == project_id)
        if role:
            query = query.where(Agent.role == role)
        items = self.db.scalars(query.order_by(desc(Agent.created_at)).offset(offset).limit(limit)).all()
        count = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        return {"items": [model_to_dict(item) for item in items], "count": int(count)}

    def get_agent(self, agent_id: str) -> dict | None:
        agent = self.db.get(Agent, agent_id)
        return model_to_dict(agent) if agent else None

    def create_agent(self, payload: AgentCreate) -> dict:
        agent = Agent(
            name=payload.name,
            role=payload.role.value,
            type=payload.type.value,
            project_id=payload.project_id,
            capabilities=payload.capabilities,
            status=payload.status.value,
        )
        self.db.add(agent)
        self.db.commit()
        self.db.refresh(agent)
        return model_to_dict(agent)

    def create_project_agent(self, project_id: str, payload: AgentCreate) -> dict:
        project = self.db.get(Project, project_id)
        if not project:
            raise ValueError("project not found")
        return self.create_agent(payload.model_copy(update={"project_id": project_id}))

    def update_agent(self, agent_id: str, payload: AgentUpdate) -> dict | None:
        agent = self.db.get(Agent, agent_id)
        if not agent:
            return None
        for key, value in payload.model_dump(exclude_none=True).items():
            setattr(agent, key, value)
        self.db.commit()
        self.db.refresh(agent)
        return model_to_dict(agent)

    def update_agent_status(self, agent_id: str, payload: AgentStatusUpdate) -> dict | None:
        agent = self.db.get(Agent, agent_id)
        if not agent:
            return None
        agent.status = payload.status.value
        self.db.commit()
        self.db.refresh(agent)
        return model_to_dict(agent)

    def attach_agent_to_project(self, project_id: str, agent_id: str) -> dict:
        project = self.db.get(Project, project_id)
        if not project:
            raise ValueError("project not found")
        agent = self.db.get(Agent, agent_id)
        if not agent:
            raise ValueError("agent not found")

        if agent.project_id and agent.project_id != project_id:
            current_project = self.db.get(Project, agent.project_id)
            if current_project and current_project.status == ProjectStatus.ACTIVE.value:
                raise ValueError("agent is already assigned to a different active project")

        agent.project_id = project_id
        self.db.commit()
        self.db.refresh(agent)
        return model_to_dict(agent)

    def detach_agent_from_project(self, project_id: str, agent_id: str) -> dict:
        project = self.db.get(Project, project_id)
        if not project:
            raise ValueError("project not found")
        agent = self.db.get(Agent, agent_id)
        if not agent:
            raise ValueError("agent not found")
        if agent.project_id != project_id:
            raise ValueError("agent is not attached to this project")

        agent.project_id = None
        if project.manager_agent_id == agent_id:
            project.manager_agent_id = None
        self.db.commit()
        self.db.refresh(agent)
        self.db.refresh(project)
        return {"agent": model_to_dict(agent), "project": model_to_dict(project)}

    def get_project_staffing(self, project_id: str) -> dict | None:
        project = self.db.get(Project, project_id)
        if not project:
            return None

        agents = self.db.scalars(
            select(Agent).where(Agent.project_id == project_id).order_by(Agent.role, Agent.name)
        ).all()
        attachable_agents = self.db.scalars(
            select(Agent).where(Agent.project_id.is_(None)).order_by(desc(Agent.updated_at)).limit(50)
        ).all()
        tasks = self.db.scalars(select(Task).where(Task.project_id == project_id)).all()
        evaluations = self.db.scalars(select(Evaluation).where(Evaluation.project_id == project_id)).all()
        worklogs = self.db.execute(
            select(Worklog.agent_id, func.count(Worklog.id))
            .join(Task, Worklog.task_id == Task.id)
            .where(Task.project_id == project_id)
            .group_by(Worklog.agent_id)
        ).all()
        worklog_counts = {agent_id: count for agent_id, count in worklogs}

        assigned_counts: dict[str, int] = defaultdict(int)
        completed_counts: dict[str, int] = defaultdict(int)
        for task in tasks:
            if task.assigned_to:
                assigned_counts[task.assigned_to] += 1
                if task.status == TaskStatus.COMPLETED.value:
                    completed_counts[task.assigned_to] += 1

        evaluation_totals: dict[str, list[float]] = defaultdict(list)
        for evaluation in evaluations:
            values = [
                evaluation.score_completion,
                evaluation.score_quality,
                evaluation.score_reliability,
                evaluation.score_handover,
                evaluation.score_context,
                evaluation.score_clarity,
                evaluation.score_improvement,
            ]
            avg = sum(values) / len(values) if values else 0.0
            evaluation_totals[evaluation.agent_id].append(avg)

        def serialize_agent(agent: Agent) -> dict[str, Any]:
            scores = evaluation_totals.get(agent.id, [])
            return {
                **model_to_dict(agent),
                "assigned_task_count": assigned_counts.get(agent.id, 0),
                "completed_task_count": completed_counts.get(agent.id, 0),
                "worklog_count": int(worklog_counts.get(agent.id, 0)),
                "average_score": round(sum(scores) / len(scores), 2) if scores else None,
                "is_project_manager": project.manager_agent_id == agent.id,
            }

        manager = next((agent for agent in agents if project.manager_agent_id == agent.id), None)
        workers = [agent for agent in agents if agent.role == AgentRole.WORKER.value]
        evaluators = [agent for agent in agents if agent.role == AgentRole.EVALUATOR.value]
        other_agents = [agent for agent in agents if agent.role not in {AgentRole.WORKER.value, AgentRole.EVALUATOR.value}]

        return {
            "project": model_to_dict(project),
            "manager": serialize_agent(manager) if manager else None,
            "workers": [serialize_agent(agent) for agent in workers],
            "evaluators": [serialize_agent(agent) for agent in evaluators],
            "other_agents": [serialize_agent(agent) for agent in other_agents if agent.id != project.manager_agent_id],
            "attachable_agents": [serialize_agent(agent) for agent in attachable_agents],
            "counters": {
                "total_agents": len(agents),
                "active_agents": len([agent for agent in agents if agent.status == AgentStatus.ACTIVE.value]),
                "workers": len(workers),
                "evaluators": len(evaluators),
                "tasks_in_progress": len([task for task in tasks if task.status == TaskStatus.IN_PROGRESS.value]),
                "blocked_tasks": len([task for task in tasks if task.status == TaskStatus.BLOCKED.value]),
            },
        }

    # -------------------------
    # Task
    # -------------------------
    def list_tasks(
        self,
        *,
        project_id: str | None = None,
        status_filter: str | None = None,
        assigned_to: str | None = None,
        limit: int = 300,
        offset: int = 0,
    ) -> dict:
        query = select(Task)
        if project_id:
            query = query.where(Task.project_id == project_id)
        if status_filter:
            query = query.where(Task.status == status_filter)
        if assigned_to:
            query = query.where(Task.assigned_to == assigned_to)
        items = self.db.scalars(query.order_by(desc(Task.updated_at)).offset(offset).limit(limit)).all()
        count = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        return {"items": [model_to_dict(item) for item in items], "count": int(count)}

    def get_task(self, task_id: str) -> dict | None:
        task = self.db.get(Task, task_id)
        return model_to_dict(task) if task else None

    def task_children_count(self, parent_task_id: str) -> int:
        count = self.db.scalar(select(func.count()).where(Task.parent_task_id == parent_task_id)) or 0
        return int(count)

    def create_task(self, payload: TaskCreate) -> dict:
        task = Task(
            project_id=payload.project_id,
            parent_task_id=payload.parent_task_id,
            title=payload.title,
            description=payload.description,
            created_by=payload.created_by,
            assigned_to=payload.assigned_to,
            priority=payload.priority.value,
            status=payload.status.value,
            dependencies=payload.dependencies,
            acceptance_criteria=payload.acceptance_criteria,
            context_refs=payload.context_refs,
            blocker_reason=None,
            parent_task_depth=payload.parent_task_depth,
            evaluation_queued=False,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return model_to_dict(task)

    def assign_task(self, task_id: str, assigned_to: str, *, actor_id: str) -> dict | None:
        task = self.db.get(Task, task_id)
        if not task:
            return None
        from_status = task.status
        task.assigned_to = assigned_to
        task.status = TaskStatus.ASSIGNED.value
        self._record_transition(
            task=task,
            from_status=from_status,
            to_status=TaskStatus.ASSIGNED.value,
            actor_id=actor_id,
            reason="assigned",
            metadata={"assigned_to": assigned_to},
        )
        self.db.commit()
        self.db.refresh(task)
        return model_to_dict(task)

    def claim_task(self, task_id: str, claiming_agent_id: str) -> dict | None:
        task = self.db.get(Task, task_id)
        if not task:
            return None
        ensure_assigned_worker_can_claim(task.assigned_to, claiming_agent_id)
        from_status = task.status
        task.status = TaskStatus.IN_PROGRESS.value
        task.blocker_reason = None
        self._record_transition(
            task=task,
            from_status=from_status,
            to_status=TaskStatus.IN_PROGRESS.value,
            actor_id=claiming_agent_id,
            reason="claim",
            metadata={},
        )
        self.db.commit()
        self.db.refresh(task)
        return model_to_dict(task)

    def transition_task(
        self,
        *,
        task_id: str,
        target_status: str,
        actor_id: str,
        reason: str | None = None,
        blocker_reason: str | None = None,
        metadata: dict[str, Any] | None = None,
        assigned_to: str | None = None,
    ) -> dict | None:
        task = self.db.get(Task, task_id)
        if not task:
            return None

        from_status = task.status
        to_status = target_status
        validate_transition_requirements(from_status=from_status, to_status=to_status, blocker_reason=blocker_reason)

        if to_status == TaskStatus.ASSIGNED.value and assigned_to:
            task.assigned_to = assigned_to
        if to_status == TaskStatus.IN_PROGRESS.value:
            ensure_assigned_worker_can_claim(task.assigned_to, actor_id)

        task.status = to_status
        task.blocker_reason = blocker_reason if to_status == TaskStatus.BLOCKED.value else None
        task.evaluation_queued = to_status in {TaskStatus.EVALUATION.value, TaskStatus.COMPLETED.value}

        transition = self._record_transition(
            task=task,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            reason=reason,
            metadata=metadata or {},
        )

        evaluation_queued = False
        if to_status in {TaskStatus.EVALUATION.value, TaskStatus.COMPLETED.value}:
            evaluation_queued = True
            self.enqueue_outbox_event(
                aggregate_type="task",
                aggregate_id=task.id,
                project_id=task.project_id,
                event_type="evaluation.requested",
                payload={
                    "task_id": task.id,
                    "project_id": task.project_id,
                    "triggered_by": actor_id,
                    "target_status": to_status,
                },
            )

        if to_status in {TaskStatus.AWAITING_HANDOVER.value, TaskStatus.COMPLETED.value}:
            self.enqueue_outbox_event(
                aggregate_type="task",
                aggregate_id=task.id,
                project_id=task.project_id,
                event_type="memory.suggestion.requested",
                payload={"task_id": task.id, "project_id": task.project_id, "status": to_status},
            )

        self.db.commit()
        self.db.refresh(task)

        return {
            "task": model_to_dict(task),
            "transition": model_to_dict(transition),
            "evaluation_queued": evaluation_queued,
        }

    def update_task_dependencies(self, task_id: str, dependencies: list[str]) -> dict | None:
        task = self.db.get(Task, task_id)
        if not task:
            return None
        task.dependencies = dependencies
        self.db.commit()
        self.db.refresh(task)
        return model_to_dict(task)

    def _record_transition(
        self,
        *,
        task: Task,
        from_status: str,
        to_status: str,
        actor_id: str,
        reason: str | None,
        metadata: dict[str, Any],
    ) -> TaskTransition:
        transition = TaskTransition(
            task_id=task.id,
            project_id=task.project_id,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            reason=reason,
            transition_metadata=metadata,
        )
        self.db.add(transition)
        return transition

    # -------------------------
    # Worklogs / handovers / memory / eval
    # -------------------------
    def create_worklog(self, payload: WorklogCreate) -> dict:
        item = Worklog(
            task_id=payload.task_id,
            agent_id=payload.agent_id,
            action_type=payload.action_type.value,
            summary=payload.summary,
            detailed_log=payload.detailed_log,
            artifacts=payload.artifacts,
            confidence=payload.confidence,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return model_to_dict(item)

    def list_worklogs(
        self,
        *,
        project_id: str | None = None,
        task_id: str | None = None,
        agent_id: str | None = None,
        action_type: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict:
        query = (
            select(Worklog, Task, Agent)
            .join(Task, Worklog.task_id == Task.id)
            .join(Agent, Worklog.agent_id == Agent.id)
        )
        if project_id:
            query = query.where(Task.project_id == project_id)
        if task_id:
            query = query.where(Worklog.task_id == task_id)
        if agent_id:
            query = query.where(Worklog.agent_id == agent_id)
        if action_type:
            query = query.where(Worklog.action_type == action_type)

        rows = self.db.execute(query.order_by(desc(Worklog.timestamp)).offset(offset).limit(limit)).all()
        count = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0

        items = []
        for worklog, task, agent in rows:
            items.append(
                {
                    **model_to_dict(worklog),
                    "project_id": task.project_id,
                    "task_title": task.title,
                    "task_status": task.status,
                    "agent_name": agent.name,
                    "agent_role": agent.role,
                }
            )
        return {"items": items, "count": int(count)}

    def create_handover(self, payload: HandoverCreate) -> dict:
        item = Handover(
            task_id=payload.task_id,
            project_id=payload.project_id,
            from_agent_id=payload.from_agent_id,
            to_agent_id=payload.to_agent_id,
            completed_work=payload.completed_work,
            pending_work=payload.pending_work,
            blockers=payload.blockers,
            risks=payload.risks,
            next_steps=payload.next_steps,
            confidence=payload.confidence,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return model_to_dict(item)

    def create_evaluation(self, payload: EvaluationCreate) -> dict:
        item = Evaluation(
            project_id=payload.project_id,
            task_id=payload.task_id,
            agent_id=payload.agent_id,
            evaluator_agent_id=payload.evaluator_agent_id,
            score_completion=payload.score_completion,
            score_quality=payload.score_quality,
            score_reliability=payload.score_reliability,
            score_handover=payload.score_handover,
            score_context=payload.score_context,
            score_clarity=payload.score_clarity,
            score_improvement=payload.score_improvement,
            missed_points=payload.missed_points,
            strengths=payload.strengths,
            weaknesses=payload.weaknesses,
            recommendations=payload.recommendations,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return model_to_dict(item)

    def add_evaluation_override(
        self,
        *,
        evaluation_id: str,
        owner_id: str,
        reason: str,
        original_scores: dict[str, int],
        override_scores: dict[str, int],
    ) -> dict | None:
        evaluation = self.db.get(Evaluation, evaluation_id)
        if not evaluation:
            return None

        for field, value in override_scores.items():
            setattr(evaluation, field, value)
        evaluation.override_reason = reason

        audit = EvaluationOverrideAudit(
            evaluation_id=evaluation_id,
            owner_id=owner_id,
            reason=reason,
            original_scores=original_scores,
            override_scores=override_scores,
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(evaluation)
        self.db.refresh(audit)
        return {
            "evaluation": model_to_dict(evaluation),
            "audit": model_to_dict(audit),
        }

    def list_evaluations(
        self,
        *,
        project_id: str | None = None,
        agent_id: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> dict:
        query = select(Evaluation)
        if project_id:
            query = query.where(Evaluation.project_id == project_id)
        if agent_id:
            query = query.where(Evaluation.agent_id == agent_id)
        items = self.db.scalars(query.order_by(desc(Evaluation.timestamp)).offset(offset).limit(limit)).all()
        count = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0

        evaluation_ids = [item.id for item in items]
        audits = (
            self.db.scalars(
                select(EvaluationOverrideAudit).where(EvaluationOverrideAudit.evaluation_id.in_(evaluation_ids))
            ).all()
            if evaluation_ids
            else []
        )
        by_eval: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for audit in audits:
            by_eval[audit.evaluation_id].append(model_to_dict(audit))

        enriched: list[dict[str, Any]] = []
        for item in items:
            row = model_to_dict(item)
            row["override_audit_entries"] = by_eval.get(item.id, [])
            enriched.append(row)
        return {"items": enriched, "count": int(count)}

    def fetch_memory(self, *, project_id: str, task_id: str | None = None, top_k: int = 10) -> list[dict]:
        query = select(MemoryEntry).where(MemoryEntry.project_id == project_id)
        if task_id:
            query = query.where(MemoryEntry.task_id == task_id)
        items = self.db.scalars(query.order_by(desc(MemoryEntry.created_at)).limit(top_k)).all()
        return [model_to_dict(item) for item in items]

    def search_memory(self, *, project_id: str, query_text: str, task_id: str | None = None, top_k: int = 10) -> list[dict]:
        query = select(MemoryEntry).where(MemoryEntry.project_id == project_id)
        if task_id:
            query = query.where(MemoryEntry.task_id == task_id)
        query = query.where(MemoryEntry.content.ilike(f"%{query_text}%"))
        items = self.db.scalars(query.order_by(desc(MemoryEntry.created_at)).limit(top_k)).all()
        return [model_to_dict(item) for item in items]

    def promote_memory(self, payload: MemoryPromotionRequest) -> dict:
        item = self.db.get(MemoryEntry, payload.memory_id)
        if not item:
            item = MemoryEntry(
                id=payload.memory_id,
                project_id=payload.project_id,
                task_id=payload.task_id,
                agent_id=payload.agent_id,
                memory_type=payload.memory_type.value,
                title=payload.title,
                content=payload.content,
                source_ref=payload.source_ref,
                importance=4,
                is_curated=True,
                promotion_status=MemoryPromotionStatus.PROMOTED.value,
            )
            self.db.add(item)
        else:
            item.project_id = payload.project_id
            item.task_id = payload.task_id
            item.agent_id = payload.agent_id
            item.memory_type = payload.memory_type.value
            item.title = payload.title
            item.content = payload.content
            item.source_ref = payload.source_ref
            item.is_curated = True
            item.promotion_status = MemoryPromotionStatus.PROMOTED.value
        self.db.commit()
        self.db.refresh(item)
        return model_to_dict(item)

    # -------------------------
    # Board / timeline / dashboard
    # -------------------------
    def get_board(self, project_id: str) -> dict:
        project = self.db.get(Project, project_id)
        if not project:
            return {"project_id": project_id, "lanes": [], "counters": {}}

        tasks = self.db.scalars(select(Task).where(Task.project_id == project_id)).all()
        lane_statuses = WORKFLOW_STAGES + [TaskStatus.BLOCKED.value, TaskStatus.REOPENED.value]
        lanes = {status: [] for status in lane_statuses}
        for task in tasks:
            status = task.status
            if status not in lanes:
                status = TaskStatus.INTAKE.value
            lanes[status].append(task)

        lane_items = []
        for status in lane_statuses:
            cards = [
                {
                    "id": task.id,
                    "title": task.title,
                    "priority": task.priority,
                    "status": task.status,
                    "assigned_to": task.assigned_to,
                    "blocker_reason": task.blocker_reason,
                    "dependency_count": len(task.dependencies or []),
                    "updated_at": task.updated_at,
                }
                for task in sorted(lanes[status], key=lambda item: item.updated_at, reverse=True)
            ]
            lane_items.append(
                {
                    "status": status,
                    "label": status.replace("_", " ").title(),
                    "wip_limit": DEFAULT_WIP_LIMITS.get(status, 999),
                    "count": len(cards),
                    "blocked_count": len([card for card in cards if card["blocker_reason"]]),
                    "cards": cards,
                }
            )

        return {
            "project_id": project_id,
            "project_name": project.name,
            "generated_at": utc_now().isoformat(),
            "lanes": lane_items,
            "counters": {
                "total_tasks": len(tasks),
                "blocked_tasks": len([task for task in tasks if task.status == TaskStatus.BLOCKED.value]),
                "in_progress_tasks": len([task for task in tasks if task.status == TaskStatus.IN_PROGRESS.value]),
            },
        }

    def get_task_timeline(self, task_id: str) -> dict | None:
        task = self.db.get(Task, task_id)
        if not task:
            return None
        worklogs = self.db.scalars(select(Worklog).where(Worklog.task_id == task_id).order_by(desc(Worklog.timestamp))).all()
        handovers = self.db.scalars(
            select(Handover).where(Handover.task_id == task_id).order_by(desc(Handover.timestamp))
        ).all()
        transitions = self.db.scalars(
            select(TaskTransition).where(TaskTransition.task_id == task_id).order_by(desc(TaskTransition.timestamp))
        ).all()
        evaluations = self.db.scalars(
            select(Evaluation).where(Evaluation.task_id == task_id).order_by(desc(Evaluation.timestamp))
        ).all()
        memory = self.db.scalars(select(MemoryEntry).where(MemoryEntry.task_id == task_id)).all()
        return {
            "task": model_to_dict(task),
            "worklogs": [model_to_dict(item) for item in worklogs],
            "handovers": [model_to_dict(item) for item in handovers],
            "transitions": [model_to_dict(item) for item in transitions],
            "evaluations": [model_to_dict(item) for item in evaluations],
            "memory": [model_to_dict(item) for item in memory],
        }

    def get_dashboard_summary(self) -> dict:
        projects = self.db.scalars(select(Project)).all()
        tasks = self.db.scalars(select(Task)).all()
        evaluations = self.db.scalars(select(Evaluation)).all()
        handovers = self.db.scalars(select(Handover)).all()

        blocked_tasks = [task for task in tasks if task.status == TaskStatus.BLOCKED.value]
        in_progress_tasks = [task for task in tasks if task.status == TaskStatus.IN_PROGRESS.value]

        low_score_entries = []
        for evaluation in evaluations:
            values = [
                evaluation.score_completion,
                evaluation.score_quality,
                evaluation.score_reliability,
                evaluation.score_handover,
                evaluation.score_context,
                evaluation.score_clarity,
                evaluation.score_improvement,
            ]
            avg = sum(values) / len(values) if values else 0
            if avg < 5:
                low_score_entries.append({"evaluation_id": evaluation.id, "agent_id": evaluation.agent_id, "avg": avg})

        project_cards = []
        for project in projects:
            project_tasks = [task for task in tasks if task.project_id == project.id]
            project_evals = [evaluation for evaluation in evaluations if evaluation.project_id == project.id]
            project_cards.append(
                {
                    "project_id": project.id,
                    "name": project.name,
                    "status": project.status,
                    "task_count": len(project_tasks),
                    "blocked_count": len([task for task in project_tasks if task.status == TaskStatus.BLOCKED.value]),
                    "evaluation_count": len(project_evals),
                }
            )

        return {
            "totals": {
                "active_projects": len([project for project in projects if project.status == ProjectStatus.ACTIVE.value]),
                "tasks_in_progress": len(in_progress_tasks),
                "blocked_tasks": len(blocked_tasks),
                "recent_handovers": len(handovers),
                "low_score_alerts": len(low_score_entries),
            },
            "alerts": {
                "blocked_tasks": [model_to_dict(task) for task in blocked_tasks[:10]],
                "low_scores": low_score_entries[:10],
            },
            "projects": project_cards[:20],
            "recent_handovers": [model_to_dict(item) for item in sorted(handovers, key=lambda x: x.timestamp, reverse=True)[:10]],
            "recent_evaluations": [
                model_to_dict(item) for item in sorted(evaluations, key=lambda x: x.timestamp, reverse=True)[:10]
            ],
        }

    # -------------------------
    # Idempotency / outbox
    # -------------------------
    def get_cached_response(self, idempotency_key: str) -> dict | None:
        record = self.db.scalar(
            select(IdempotencyRecord).where(IdempotencyRecord.idempotency_key == idempotency_key)
        )
        if not record:
            return None
        return {"response": record.response, "stored_at": record.stored_at.isoformat()}

    def store_cached_response(self, idempotency_key: str, response: dict) -> None:
        serialized_response = jsonable_encoder(response)
        record = self.db.scalar(
            select(IdempotencyRecord).where(IdempotencyRecord.idempotency_key == idempotency_key)
        )
        if record:
            record.response = serialized_response
            record.stored_at = utc_now()
        else:
            self.db.add(IdempotencyRecord(idempotency_key=idempotency_key, response=serialized_response))
        self.db.commit()

    def enqueue_outbox_event(
        self,
        *,
        aggregate_type: str,
        aggregate_id: str,
        project_id: str | None,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict:
        event = OutboxEvent(
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            project_id=project_id,
            event_type=event_type,
            payload=payload,
            status="pending",
            retry_count=0,
            available_at=utc_now(),
        )
        self.db.add(event)
        self.db.flush()
        return model_to_dict(event)

    async def publish_event(self, *, project_id: str | None, event_type: str, payload: dict[str, Any]) -> None:
        await broker.publish(
            project_id,
            {
                "type": event_type,
                "project_id": project_id,
                "payload": payload,
                "timestamp": utc_now().isoformat(),
            },
        )

    def pending_outbox_events(self, *, limit: int = 50) -> list[OutboxEvent]:
        now = utc_now()
        return self.db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.status == "pending", OutboxEvent.available_at <= now)
            .order_by(OutboxEvent.created_at)
            .limit(limit)
        ).all()

    def mark_outbox_processed(self, event: OutboxEvent) -> None:
        event.status = "processed"
        event.processed_at = utc_now()
        event.last_error = None
        self.db.commit()

    def mark_outbox_retry(self, event: OutboxEvent, error_message: str) -> None:
        event.retry_count += 1
        event.last_error = error_message
        if event.retry_count >= 5:
            event.status = "failed"
        else:
            event.available_at = utc_now() + timedelta(seconds=min(120, 2 ** event.retry_count))
        self.db.commit()

    def outbox_lag_seconds(self) -> float:
        earliest = self.db.scalar(
            select(OutboxEvent).where(OutboxEvent.status == "pending").order_by(OutboxEvent.created_at).limit(1)
        )
        if not earliest:
            return 0.0
        return max(0.0, (utc_now() - earliest.created_at).total_seconds())

    # -------------------------
    # Utilities
    # -------------------------
    def clear_all(self) -> None:
        # Child-to-parent deletion order
        self.db.execute(delete(TaskTransition))
        self.db.execute(delete(OutboxEvent))
        self.db.execute(delete(IdempotencyRecord))
        self.db.execute(delete(EvaluationOverrideAudit))
        self.db.execute(delete(Evaluation))
        self.db.execute(delete(MemoryEntry))
        self.db.execute(delete(Handover))
        self.db.execute(delete(Worklog))
        self.db.execute(delete(Task))
        self.db.execute(delete(Agent))
        self.db.execute(delete(ProjectProcessConfig))
        self.db.execute(delete(Project))
        self.db.commit()

    def seed_demo_data(self, *, force: bool = False) -> bool:
        existing = self.db.scalar(select(func.count()).select_from(Project)) or 0
        if existing and not force:
            return False

        if force:
            self.clear_all()

        if not force and existing:
            return False

        project = Project(
            id="project-synapse-core",
            name="Synapse OS Delivery",
            description="Agent-first orchestration platform.",
            objective="Ship production-grade workflow and Kanban.",
            owner="owner-1",
            status=ProjectStatus.ACTIVE.value,
            tags=["v1", "production", "agent-ops"],
            manager_agent_id="agent-manager-orion",
        )
        project2 = Project(
            id="project-memory-pipeline",
            name="Memory Reliability Track",
            description="Improve curated memory quality and retrieval relevance.",
            objective="Lower repeated failures via contextual memory.",
            owner="owner-1",
            status=ProjectStatus.ACTIVE.value,
            tags=["memory", "qdrant"],
            manager_agent_id="agent-manager-atlas",
        )
        self.db.add_all([project, project2])

        agents = [
            Agent(
                id="agent-manager-orion",
                name="Manager Orion",
                role="manager",
                type="project_side",
                project_id=project.id,
                capabilities=["planning", "orchestration"],
                status=AgentStatus.ACTIVE.value,
            ),
            Agent(
                id="agent-manager-atlas",
                name="Manager Atlas",
                role="manager",
                type="project_side",
                project_id=project2.id,
                capabilities=["memory-review"],
                status=AgentStatus.ACTIVE.value,
            ),
            Agent(
                id="agent-worker-lex",
                name="Worker Lex",
                role="worker",
                type="project_side",
                project_id=project.id,
                capabilities=["frontend", "tooling"],
                status=AgentStatus.ACTIVE.value,
            ),
            Agent(
                id="agent-worker-nova",
                name="Worker Nova",
                role="worker",
                type="project_side",
                project_id=project.id,
                capabilities=["backend", "api"],
                status=AgentStatus.ACTIVE.value,
            ),
            Agent(
                id="agent-worker-quill",
                name="Worker Quill",
                role="worker",
                type="project_side",
                project_id=project2.id,
                capabilities=["memory", "vector"],
                status=AgentStatus.ACTIVE.value,
            ),
            Agent(
                id="agent-evaluator-iris",
                name="Evaluator Iris",
                role="evaluator",
                type="platform_side",
                project_id=project.id,
                capabilities=["quality-scoring"],
                status=AgentStatus.ACTIVE.value,
            ),
        ]
        self.db.add_all(agents)

        task_seed = [
            ("task-intake", TaskStatus.INTAKE.value, None),
            ("task-ready", TaskStatus.READY.value, None),
            ("task-assigned", TaskStatus.ASSIGNED.value, "agent-worker-lex"),
            ("task-progress", TaskStatus.IN_PROGRESS.value, "agent-worker-nova"),
            ("task-handover", TaskStatus.AWAITING_HANDOVER.value, "agent-worker-lex"),
            ("task-review", TaskStatus.UNDER_REVIEW.value, "agent-worker-nova"),
            ("task-evaluation", TaskStatus.EVALUATION.value, "agent-worker-nova"),
            ("task-completed", TaskStatus.COMPLETED.value, "agent-worker-nova"),
            ("task-blocked", TaskStatus.BLOCKED.value, "agent-worker-lex"),
            ("task-reopened", TaskStatus.REOPENED.value, "agent-worker-lex"),
        ]
        for task_id, status, assignee in task_seed:
            self.db.add(
                Task(
                    id=task_id,
                    project_id=project.id,
                    title=f"Demo {status.replace('_', ' ').title()} Task",
                    description=f"Seeded task for lane {status}.",
                    created_by="agent-manager-orion",
                    assigned_to=assignee,
                    priority=TaskPriority.MEDIUM.value,
                    status=status,
                    dependencies=[],
                    acceptance_criteria="Visible in board and timeline.",
                    context_refs=[],
                    blocker_reason="Waiting for external dependency." if status == TaskStatus.BLOCKED.value else None,
                    parent_task_depth=0,
                    evaluation_queued=status in {TaskStatus.EVALUATION.value, TaskStatus.COMPLETED.value},
                )
            )

        self.db.add(
            Task(
                id="task-memory-curation",
                project_id=project2.id,
                title="Memory curation baseline",
                description="Seeded memory task for evaluation and alerts.",
                created_by="agent-manager-atlas",
                assigned_to="agent-worker-quill",
                priority=TaskPriority.HIGH.value,
                status=TaskStatus.EVALUATION.value,
                dependencies=[],
                acceptance_criteria="Curated entries visible with audit trail.",
                context_refs=[],
                blocker_reason=None,
                parent_task_depth=0,
                evaluation_queued=True,
            )
        )

        self.db.add(
            Evaluation(
                id="evaluation-memory-low",
                project_id=project2.id,
                task_id="task-memory-curation",
                agent_id="agent-worker-quill",
                evaluator_agent_id="agent-evaluator-iris",
                score_completion=4,
                score_quality=4,
                score_reliability=5,
                score_handover=4,
                score_context=4,
                score_clarity=5,
                score_improvement=4,
                missed_points=["Need broader benchmark coverage."],
                strengths=["Clear structure"],
                weaknesses=["Limited edge-case validation"],
                recommendations="Add adversarial retrieval tests.",
            )
        )

        self.db.add(
            Worklog(
                id="worklog-task-progress",
                task_id="task-progress",
                agent_id="agent-worker-nova",
                action_type=WorklogActionType.PROGRESS.value,
                summary="Implemented workflow transition service.",
                detailed_log="Added transition matrix and required gates.",
                artifacts=["apps/api/src/app/services/workflow.py"],
                confidence=0.84,
            )
        )
        self.db.add(
            Handover(
                id="handover-task",
                task_id="task-handover",
                project_id=project.id,
                from_agent_id="agent-worker-lex",
                to_agent_id="agent-evaluator-iris",
                completed_work="Prepared implementation package.",
                pending_work="Evaluator validation",
                blockers="None",
                risks="Potential schema mismatch",
                next_steps="Run integration checks",
                confidence=0.81,
            )
        )
        self.db.add(
            MemoryEntry(
                id="memory-board-rule",
                project_id=project.id,
                task_id="task-progress",
                agent_id="agent-worker-nova",
                memory_type="project",
                title="Board usability guideline",
                content="Prefer structured lanes with transition guards and fast actions.",
                source_ref="worklog-task-progress",
                importance=4,
                is_curated=True,
                promotion_status=MemoryPromotionStatus.PROMOTED.value,
            )
        )

        self.bootstrap_default_process(project.id)
        self.bootstrap_default_process(project2.id)
        self.db.commit()
        return True


def get_repository(db: Session = Depends(get_db)) -> Repository:
    return Repository(db)


def seed_demo_data(repo: Repository, *, force: bool = False) -> bool:
    return repo.seed_demo_data(force=force)
