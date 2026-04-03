from __future__ import annotations

import asyncio
import os
import re
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from agents.mcp.server import MCPServerStdio
from pydantic import ValidationError

from tester.config import TesterSettings
from tester.models import CheckResult, CheckStatus, FinalAssessment, JourneyStep, Severity, UATReport

try:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import Page, Playwright, sync_playwright
except ImportError:  # pragma: no cover - dependency guard for partial setups
    Page = Any  # type: ignore[assignment]
    Playwright = Any  # type: ignore[assignment]
    PlaywrightError = RuntimeError  # type: ignore[assignment]
    sync_playwright = None


SCENARIOS = ("full_uat", "blocked_recovery", "agent_surface", "ux_friction")
SETUP_CATEGORIES = {"environment", "browser_setup", "openai", "mcp"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def compact_timestamp() -> str:
    return utc_now().strftime("%Y%m%d-%H%M%S")


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return cleaned.strip("-") or "item"


class HarnessError(RuntimeError):
    pass


@dataclass
class BrowserHarness:
    base_url: str
    artifacts_dir: Path
    headless: bool
    timeout_ms: int
    viewport_width: int
    viewport_height: int
    playwright: Playwright | None = None
    browser: Any | None = None
    page: Page | None = None
    console_errors: list[str] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    network_errors: list[str] = field(default_factory=list)

    def ensure_page(self) -> Page:
        if sync_playwright is None:
            raise HarnessError("Playwright is not installed in the current Python environment.")
        if self.page is not None:
            return self.page

        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        page = self.browser.new_page(viewport={"width": self.viewport_width, "height": self.viewport_height})
        page.set_default_timeout(self.timeout_ms)
        page.on("console", self._handle_console)
        page.on("pageerror", self._handle_page_error)
        page.on("response", self._handle_response)
        self.page = page
        return page

    def _handle_console(self, message: Any) -> None:
        if message.type == "error":
            self.console_errors.append(message.text)

    def _handle_page_error(self, error: Any) -> None:
        self.page_errors.append(str(error))

    def _handle_response(self, response: Any) -> None:
        if response.status >= 400:
            self.network_errors.append(f"{response.status} {response.url}")

    def open_page(self, route: str) -> dict[str, str]:
        page = self.ensure_page()
        target = f"{self.base_url.rstrip('/')}/{route.lstrip('/')}" if route not in {"", "/"} else self.base_url.rstrip("/")
        page.goto(target)
        page.wait_for_load_state("networkidle")
        return {"url": page.url, "title": page.title()}

    def click(self, selector: str) -> dict[str, str]:
        page = self.ensure_page()
        page.locator(selector).first.click()
        page.wait_for_load_state("networkidle")
        return {"selector": selector, "url": page.url}

    def fill(self, selector: str, value: str) -> dict[str, str]:
        page = self.ensure_page()
        page.locator(selector).first.fill(value)
        return {"selector": selector, "value": value}

    def wait_for_text(self, text: str) -> dict[str, str]:
        page = self.ensure_page()
        page.get_by_text(text, exact=False).first.wait_for()
        return {"text": text, "url": page.url}

    def screenshot(self, label: str) -> str:
        page = self.ensure_page()
        path = self.artifacts_dir / f"{slugify(label)}.png"
        page.screenshot(path=str(path), full_page=True)
        return path.as_posix()

    def inspect_page(self) -> dict[str, Any]:
        page = self.ensure_page()
        return {
            "url": page.url,
            "title": page.title(),
            "console_errors": self.console_errors[-10:],
            "page_errors": self.page_errors[-10:],
            "network_errors": self.network_errors[-10:],
        }

    def close(self) -> None:
        if self.page is not None:
            try:
                self.page.close()
            except Exception:
                pass
            finally:
                self.page = None
        if self.browser is not None:
            try:
                self.browser.close()
            except Exception:
                pass
            finally:
                self.browser = None
        if self.playwright is not None:
            try:
                self.playwright.stop()
            except Exception:
                pass
            finally:
                self.playwright = None


class UATRuntime:
    def __init__(self, settings: TesterSettings, scenario: str):
        if scenario not in SCENARIOS:
            raise HarnessError(f"Unsupported scenario '{scenario}'. Expected one of: {', '.join(SCENARIOS)}")

        self.settings = settings
        self.scenario = scenario
        self.repo_root = Path(__file__).resolve().parents[4]
        self.run_id = f"{compact_timestamp()}-{uuid.uuid4().hex[:6]}"
        self.started_at = utc_now()
        self.trace_ids: list[str] = []
        self.report_dir = (self.repo_root / settings.sentientops_report_dir).resolve()
        self.artifacts_dir = self.report_dir / "artifacts" / self.run_id
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

        self.http = httpx.Client(timeout=30.0, follow_redirects=True)
        self.browser = BrowserHarness(
            base_url=settings.sentientops_uat_base_url,
            artifacts_dir=self.artifacts_dir,
            headless=settings.sentientops_browser_headless,
            timeout_ms=settings.sentientops_browser_timeout_ms,
            viewport_width=settings.sentientops_browser_viewport_width,
            viewport_height=settings.sentientops_browser_viewport_height,
        )

        self.request_counter = 0
        self.checks: list[CheckResult] = []
        self.journeys: list[JourneyStep] = []
        self.specialist_notes: dict[str, str] = {}
        self.created_resources: dict[str, Any] = {
            "project": None,
            "agents": [],
            "tasks": [],
            "evaluations": [],
            "memory": [],
        }
        self.qa_project: dict[str, Any] | None = None
        self.qa_agents: dict[str, dict[str, Any]] = {}
        self.qa_tasks: dict[str, dict[str, Any]] = {}

    @classmethod
    def from_env(cls, scenario: str) -> "UATRuntime":
        try:
            settings = TesterSettings()
        except ValidationError as exc:
            raise HarnessError(f"Tester configuration is incomplete: {exc}") from exc
        return cls(settings, scenario)

    def close(self) -> None:
        self.http.close()
        self.browser.close()

    def add_specialist_note(self, specialist: str, note: str) -> str:
        self.specialist_notes[specialist] = note
        return note

    def record_check(
        self,
        *,
        category: str,
        name: str,
        status: CheckStatus,
        severity: Severity,
        detail: str,
        evidence_refs: list[str] | None = None,
    ) -> CheckResult:
        check = CheckResult(
            category=category,
            name=name,
            status=status,
            severity=severity,
            detail=detail,
            evidence_refs=evidence_refs or [],
        )
        self.checks.append(check)
        return check

    def record_journey(
        self,
        *,
        phase: str,
        status: CheckStatus,
        detail: str,
        evidence_refs: list[str] | None = None,
    ) -> JourneyStep:
        journey = JourneyStep(
            phase=phase,
            status=status,
            detail=detail,
            evidence_refs=evidence_refs or [],
        )
        self.journeys.append(journey)
        return journey

    def qa_slug(self, label: str) -> str:
        prefix = slugify(self.settings.sentientops_qa_project_prefix)
        return f"{prefix}-{slugify(self.scenario)}-{self.run_id}-{slugify(label)}"

    def qa_tags(self) -> list[str]:
        return [
            self.settings.sentientops_qa_project_prefix,
            "uat",
            f"scenario:{self.scenario}",
            f"run:{self.run_id}",
        ]

    def _headers(self, *, auth_mode: str, actor_id: str | None = None, actor_role: str = "owner") -> dict[str, str]:
        self.request_counter += 1
        headers = {"X-Request-Id": f"{self.run_id}-{self.request_counter:03d}"}
        if auth_mode == "agent":
            headers["Authorization"] = f"Bearer {self.settings.sentientops_agent_api_key}"
            return headers
        headers["X-Actor-Id"] = actor_id or self.settings.sentientops_owner_actor_id
        headers["X-Actor-Role"] = actor_role
        return headers

    def api_request(
        self,
        method: str,
        path: str,
        *,
        auth_mode: str = "user",
        actor_id: str | None = None,
        actor_role: str = "owner",
        payload: Any | None = None,
    ) -> dict[str, Any]:
        url = f"{self.settings.sentientops_api_base_url.rstrip('/')}/{path.lstrip('/')}"
        response = self.http.request(
            method,
            url,
            headers=self._headers(auth_mode=auth_mode, actor_id=actor_id, actor_role=actor_role),
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def api_request_allow_error(
        self,
        method: str,
        path: str,
        *,
        auth_mode: str = "user",
        actor_id: str | None = None,
        actor_role: str = "owner",
        payload: Any | None = None,
    ) -> tuple[int, dict[str, Any] | str]:
        url = f"{self.settings.sentientops_api_base_url.rstrip('/')}/{path.lstrip('/')}"
        response = self.http.request(
            method,
            url,
            headers=self._headers(auth_mode=auth_mode, actor_id=actor_id, actor_role=actor_role),
            json=payload,
        )
        try:
            body: dict[str, Any] | str = response.json()
        except ValueError:
            body = response.text
        return response.status_code, body

    def web_request(self, route: str = "/") -> httpx.Response:
        target = f"{self.settings.sentientops_uat_base_url.rstrip('/')}/{route.lstrip('/')}" if route not in {"", "/"} else self.settings.sentientops_uat_base_url.rstrip("/")
        return self.http.get(target)

    def ensure_qa_target(self) -> dict[str, Any]:
        if not self.qa_project:
            raise HarnessError("QA project has not been created for this run.")
        name = str(self.qa_project.get("name", ""))
        tags = self.qa_project.get("tags", [])
        if self.settings.sentientops_qa_project_prefix not in name.lower() and not any(
            str(tag).startswith(self.settings.sentientops_qa_project_prefix) for tag in tags
        ):
            raise HarnessError(f"Refusing to mutate non-QA project '{name}'.")
        if not any(str(tag) == f"run:{self.run_id}" for tag in tags):
            raise HarnessError("Refusing to mutate project without matching qa_run_id tag.")
        return self.qa_project

    def audit_environment(self) -> dict[str, Any]:
        results: dict[str, Any] = {"scenario": self.scenario}

        try:
            health = self.api_request("GET", "/health")
            readiness = self.api_request("GET", "/ready")
            manifest = self.api_request("GET", "/agent-tools/manifest", auth_mode="agent")
            root = self.web_request("/")
            results.update(
                {
                    "health": health,
                    "readiness": readiness,
                    "tool_manifest_count": manifest.get("tool_count"),
                    "web_status_code": root.status_code,
                }
            )
            self.record_check(
                category="environment",
                name="API health and readiness",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail=f"API health={health.get('status')} readiness={readiness.get('status')} outbox_lag={readiness.get('outbox_lag_seconds')}",
            )
            self.record_check(
                category="environment",
                name="Agent tool manifest",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail=f"Manifest returned {manifest.get('tool_count', 0)} tools for agent auth.",
            )
            root_status = CheckStatus.PASSED if root.status_code == 200 else CheckStatus.WARNING
            self.record_check(
                category="environment",
                name="Frontend root availability",
                status=root_status,
                severity=Severity.INFO if root.status_code == 200 else Severity.MEDIUM,
                detail=f"GET / returned status {root.status_code}.",
            )
            if self.settings.sentientops_tester_auth_mode != "local_bypass":
                self.record_check(
                    category="environment",
                    name="Tester auth mode",
                    status=CheckStatus.WARNING,
                    severity=Severity.MEDIUM,
                    detail=f"Tester auth mode is '{self.settings.sentientops_tester_auth_mode}', expected local_bypass for browser UAT.",
                )
            else:
                self.record_check(
                    category="environment",
                    name="Tester auth mode",
                    status=CheckStatus.PASSED,
                    severity=Severity.INFO,
                    detail="Local bypass auth is configured for browser UAT.",
                )
        except httpx.HTTPError as exc:
            self.record_check(
                category="environment",
                name="Environment readiness",
                status=CheckStatus.FAILED,
                severity=Severity.CRITICAL,
                detail=str(exc),
            )
            raise HarnessError(f"Environment readiness failed: {exc}") from exc

        self.record_journey(
            phase="environment",
            status=CheckStatus.PASSED,
            detail="API, web surface, and agent manifest were reachable.",
        )
        return results

    def bootstrap_qa_workspace(self) -> dict[str, Any]:
        if self.qa_project is not None:
            return {
                "project": self.qa_project,
                "agents": self.qa_agents,
                "tasks": self.qa_tasks,
                "reused": True,
            }

        project = self.api_request(
            "POST",
            "/projects",
            payload={
                "name": f"{self.settings.sentientops_qa_project_prefix.upper()} {self.scenario.replace('_', ' ').title()} {self.run_id}",
                "description": "QA-generated SentientOps project used by the OpenAI tester harness for realistic agent UAT.",
                "objective": "Exercise the project workflow, tool console, Kanban, and evaluation experience from an agent-first perspective.",
                "owner": self.settings.sentientops_owner_actor_id,
                "status": "active",
                "tags": self.qa_tags(),
            },
        )
        self.qa_project = project
        self.created_resources["project"] = project

        manager = self.api_request(
            "POST",
            "/agents",
            payload={
                "name": f"QA Project Lead {self.run_id[-6:]}",
                "role": "manager",
                "type": "project_side",
                "project_id": project["id"],
                "capabilities": ["planning", "triage", "handover_review"],
                "status": "active",
            },
        )
        worker_primary = self.api_request(
            "POST",
            "/agents",
            payload={
                "name": f"QA Worker Alpha {self.run_id[-6:]}",
                "role": "worker",
                "type": "project_side",
                "project_id": project["id"],
                "capabilities": ["frontend", "api_integration", "documentation"],
                "status": "active",
            },
        )
        worker_secondary = self.api_request(
            "POST",
            "/agents",
            payload={
                "name": f"QA Worker Beta {self.run_id[-6:]}",
                "role": "worker",
                "type": "project_side",
                "project_id": project["id"],
                "capabilities": ["qa", "ops", "workflow_validation"],
                "status": "active",
            },
        )
        evaluator = self.api_request(
            "POST",
            "/agents",
            payload={
                "name": f"QA Evaluator {self.run_id[-6:]}",
                "role": "evaluator",
                "type": "platform_side",
                "project_id": project["id"],
                "capabilities": ["quality_scoring", "audit", "feedback"],
                "status": "active",
            },
        )
        self.qa_agents = {
            "manager": manager,
            "worker_primary": worker_primary,
            "worker_secondary": worker_secondary,
            "evaluator": evaluator,
        }
        self.created_resources["agents"] = list(self.qa_agents.values())

        assigned_project = self.api_request(
            "POST",
            f"/projects/{project['id']}/manager",
            payload={"manager_agent_id": manager["id"]},
        )
        self.qa_project = assigned_project
        self.created_resources["project"] = assigned_project
        process = self.api_request("POST", f"/projects/{project['id']}/process/bootstrap")
        self.created_resources["process"] = process

        task_specs = {
            "primary": {
                "title": "Validate Kanban-driven coordination flow",
                "description": "Simulate a realistic delivery task across assignment, execution, handover, review, and evaluation.",
                "priority": "high",
                "status": "ready",
                "acceptance_criteria": "Board card moves cleanly, inspector timeline is populated, and evaluation artifacts are visible.",
            },
            "blocked": {
                "title": "Exercise blocked recovery workflow",
                "description": "Verify blocked state guardrails, unblock handling, and reopened recovery behavior.",
                "priority": "critical",
                "status": "ready",
                "acceptance_criteria": "Blocked transition requires a reason and recovery flow leaves a coherent timeline.",
            },
            "ops": {
                "title": "Review tool console and operational read models",
                "description": "Ensure project, agent, dashboard, and tool surfaces expose enough context for autonomous operators.",
                "priority": "medium",
                "status": "backlog",
                "acceptance_criteria": "Read models load and tool console shows usable affordances for agent invocation.",
            },
        }
        for key, spec in task_specs.items():
            task = self.api_request(
                "POST",
                "/tasks",
                actor_id=manager["id"],
                actor_role="manager",
                payload={
                    "project_id": project["id"],
                    "title": spec["title"],
                    "description": spec["description"],
                    "created_by": manager["id"],
                    "assigned_to": None,
                    "priority": spec["priority"],
                    "status": spec["status"],
                    "dependencies": [],
                    "acceptance_criteria": spec["acceptance_criteria"],
                    "context_refs": [f"qa_run:{self.run_id}", f"scenario:{self.scenario}"],
                    "parent_task_id": None,
                    "parent_task_depth": 0,
                },
            )
            self.qa_tasks[key] = task

        self.created_resources["tasks"] = list(self.qa_tasks.values())
        self.record_check(
            category="workflow",
            name="QA workspace bootstrap",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"Created project {self.qa_project['id']} with {len(self.qa_agents)} agents and {len(self.qa_tasks)} tasks.",
        )
        self.record_journey(
            phase="bootstrap",
            status=CheckStatus.PASSED,
            detail=f"QA workspace {self.qa_project['name']} created and process bootstrapped.",
        )
        return {
            "project": self.qa_project,
            "agents": self.qa_agents,
            "tasks": self.qa_tasks,
            "process": process,
            "reused": False,
        }

    def _assign_task(self, task: dict[str, Any], assignee_id: str, manager_id: str) -> dict[str, Any]:
        updated = self.api_request(
            "POST",
            f"/tasks/{task['id']}/assign",
            actor_id=manager_id,
            actor_role="manager",
            payload={"assigned_to": assignee_id},
        )
        task.update(updated)
        return task

    def _claim_task(self, task: dict[str, Any], worker_id: str) -> dict[str, Any]:
        updated = self.api_request(
            "POST",
            f"/tasks/{task['id']}/claim",
            actor_id=worker_id,
            actor_role="worker",
            payload={"claiming_agent_id": worker_id},
        )
        task.update(updated)
        return task

    def _transition_task(
        self,
        task: dict[str, Any],
        *,
        actor_id: str,
        actor_role: str,
        target_status: str,
        reason: str | None = None,
        blocker_reason: str | None = None,
        metadata: dict[str, Any] | None = None,
        assigned_to: str | None = None,
    ) -> dict[str, Any]:
        result = self.api_request(
            "POST",
            f"/tasks/{task['id']}/transition",
            actor_id=actor_id,
            actor_role=actor_role,
            payload={
                "target_status": target_status,
                "reason": reason,
                "blocker_reason": blocker_reason,
                "metadata": metadata or {},
                "assigned_to": assigned_to,
            },
        )
        task.update(result["task"])
        return result

    def _create_worklog(
        self,
        *,
        task_id: str,
        agent_id: str,
        action_type: str,
        summary: str,
        detailed_log: str,
        artifacts: list[str] | None = None,
        confidence: float = 0.86,
    ) -> dict[str, Any]:
        return self.api_request(
            "POST",
            "/worklogs",
            actor_id=agent_id,
            actor_role="worker",
            payload={
                "task_id": task_id,
                "agent_id": agent_id,
                "action_type": action_type,
                "summary": summary,
                "detailed_log": detailed_log,
                "artifacts": artifacts or [],
                "confidence": confidence,
            },
        )

    def run_full_uat_flow(self) -> dict[str, Any]:
        self.bootstrap_qa_workspace()
        self.ensure_qa_target()
        manager = self.qa_agents["manager"]
        worker = self.qa_agents["worker_primary"]
        evaluator = self.qa_agents["evaluator"]
        task = self.qa_tasks["primary"]

        self._assign_task(task, worker["id"], manager["id"])
        self._claim_task(task, worker["id"])
        self._create_worklog(
            task_id=task["id"],
            agent_id=worker["id"],
            action_type="start",
            summary="Worker began the delivery task.",
            detailed_log="Reviewed acceptance criteria, verified project board state, and started execution against the assigned scope.",
        )
        self._create_worklog(
            task_id=task["id"],
            agent_id=worker["id"],
            action_type="progress",
            summary="Execution progressed with task context intact.",
            detailed_log="Updated status telemetry, validated inspector visibility, and prepared a structured handover for review.",
        )
        self._transition_task(
            task,
            actor_id=worker["id"],
            actor_role="worker",
            target_status="awaiting_handover",
            reason="Execution complete, ready for structured handover.",
            metadata={"qa_run_id": self.run_id, "scenario": self.scenario},
        )
        handover = self.api_request(
            "POST",
            "/handovers",
            actor_id=worker["id"],
            actor_role="worker",
            payload={
                "task_id": task["id"],
                "project_id": self.qa_project["id"],
                "from_agent_id": worker["id"],
                "to_agent_id": manager["id"],
                "completed_work": "Delivered the execution slice and verified board and timeline updates.",
                "pending_work": "Manager review and evaluator scoring remain.",
                "blockers": "None.",
                "risks": "Minor risk of unclear review ownership if manager role labels are ambiguous.",
                "next_steps": "Review the handover, move task to under_review, then submit evaluation.",
                "confidence": 0.88,
            },
        )
        self._transition_task(
            task,
            actor_id=manager["id"],
            actor_role="manager",
            target_status="under_review",
            reason="Manager accepted handover and started review.",
            metadata={"handover_id": handover["id"]},
        )
        evaluation_transition = self._transition_task(
            task,
            actor_id=manager["id"],
            actor_role="manager",
            target_status="evaluation",
            reason="Task review passed; evaluator workflow engaged.",
            metadata={"review_outcome": "pass"},
        )
        evaluation_request = self.api_request(
            "POST",
            "/evaluations/request",
            actor_id=manager["id"],
            actor_role="manager",
            payload={
                "project_id": self.qa_project["id"],
                "task_id": task["id"],
                "agent_id": worker["id"],
                "requested_by": manager["id"],
            },
        )
        evaluation = self.api_request(
            "POST",
            "/evaluations/submit",
            actor_id=evaluator["id"],
            actor_role="evaluator",
            payload={
                "project_id": self.qa_project["id"],
                "task_id": task["id"],
                "agent_id": worker["id"],
                "evaluator_agent_id": evaluator["id"],
                "score_completion": 8,
                "score_quality": 8,
                "score_reliability": 9,
                "score_handover": 8,
                "score_context": 8,
                "score_clarity": 8,
                "score_improvement": 7,
                "missed_points": ["Could expose clearer role ownership inside the review lane."],
                "strengths": ["Workflow remained consistent end-to-end.", "Timeline artifacts were produced."],
                "weaknesses": ["Evaluator queue is not automatically materialized by the worker yet."],
                "recommendations": "Complete the outbox-to-evaluation processor and improve review ownership affordances.",
            },
        )
        completed_transition = self._transition_task(
            task,
            actor_id=evaluator["id"],
            actor_role="evaluator",
            target_status="completed",
            reason="Evaluation recorded and task closed.",
            metadata={"evaluation_id": evaluation["id"]},
        )
        memory_entry = self.api_request(
            "POST",
            "/memory/promote",
            actor_id=manager["id"],
            actor_role="manager",
            payload={
                "memory_id": self.qa_slug("primary-task-handover-memory"),
                "project_id": self.qa_project["id"],
                "task_id": task["id"],
                "agent_id": worker["id"],
                "memory_type": "task",
                "title": "Primary task review outcome",
                "content": "Structured handover and evaluation path completed during the QA full_uat scenario.",
                "source_ref": f"qa_run:{self.run_id}",
                "approved_by": manager["id"],
            },
        )

        timeline = self.api_request("GET", f"/tasks/{task['id']}/timeline")
        board = self.api_request("GET", f"/boards/{self.qa_project['id']}")
        dashboard = self.api_request("GET", "/dashboard/summary")
        evaluations = self.api_request("GET", f"/evaluations?project_id={self.qa_project['id']}")
        memory = self.api_request(
            "POST",
            "/memory/search",
            actor_id=manager["id"],
            actor_role="manager",
            payload={
                "project_id": self.qa_project["id"],
                "task_id": task["id"],
                "query": "handover evaluation QA",
                "top_k": 5,
            },
        )

        self.created_resources["evaluations"] = [evaluation]
        self.created_resources["memory"] = [memory_entry]
        self.record_check(
            category="workflow",
            name="Happy-path workflow progression",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"Primary task progressed to completed with {len(timeline['transitions'])} transitions and {len(timeline['handovers'])} handover records.",
        )
        if not evaluation_transition.get("evaluation_queued"):
            self.record_check(
                category="workflow",
                name="Evaluation queue trigger",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                detail="Task reached evaluation without the queue flag being asserted.",
            )
        else:
            self.record_check(
                category="workflow",
                name="Evaluation queue trigger",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail=f"Evaluation request queued via outbox event {evaluation_request.get('outbox_event_id')}",
            )
        self.record_journey(
            phase="full_uat",
            status=CheckStatus.PASSED,
            detail=f"Primary task moved to completed and evaluation {evaluation['id']} was recorded.",
        )
        return {
            "task": task,
            "handover": handover,
            "evaluation_request": evaluation_request,
            "evaluation": evaluation,
            "completed_transition": completed_transition,
            "timeline": timeline,
            "board": board,
            "dashboard": dashboard,
            "evaluations": evaluations,
            "memory": memory,
        }

    def run_blocked_recovery_flow(self) -> dict[str, Any]:
        self.bootstrap_qa_workspace()
        self.ensure_qa_target()
        manager = self.qa_agents["manager"]
        primary_worker = self.qa_agents["worker_primary"]
        secondary_worker = self.qa_agents["worker_secondary"]
        task = self.qa_tasks["blocked"]

        self._assign_task(task, secondary_worker["id"], manager["id"])
        illegal_claim_status, illegal_claim_body = self.api_request_allow_error(
            "POST",
            f"/tasks/{task['id']}/claim",
            actor_id=primary_worker["id"],
            actor_role="worker",
            payload={"claiming_agent_id": primary_worker["id"]},
        )
        if illegal_claim_status == 409:
            self.record_check(
                category="workflow",
                name="Assigned-only claim guardrail",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail="Claim by a non-assigned worker was rejected as expected.",
            )
        else:
            self.record_check(
                category="workflow",
                name="Assigned-only claim guardrail",
                status=CheckStatus.FAILED,
                severity=Severity.HIGH,
                detail=f"Expected 409 for illegal claim, got {illegal_claim_status}: {illegal_claim_body}",
            )

        self._claim_task(task, secondary_worker["id"])
        blocked_result = self._transition_task(
            task,
            actor_id=secondary_worker["id"],
            actor_role="worker",
            target_status="blocked",
            blocker_reason="Dependency on evaluator policy copy is unresolved.",
            metadata={"qa_run_id": self.run_id, "reason_type": "dependency"},
        )
        self._create_worklog(
            task_id=task["id"],
            agent_id=secondary_worker["id"],
            action_type="issue",
            summary="Task blocked by missing dependency.",
            detailed_log="Blocked state was entered with a reason, and the dependency or risk needs visibility in the inspector.",
        )
        reopened = self._transition_task(
            task,
            actor_id=manager["id"],
            actor_role="manager",
            target_status="reopened",
            reason="Dependency clarified; task is ready for rework.",
            metadata={"resolution": "requirements clarified"},
        )
        self._transition_task(
            task,
            actor_id=manager["id"],
            actor_role="manager",
            target_status="assigned",
            reason="Task re-assigned after unblock.",
            assigned_to=secondary_worker["id"],
            metadata={"reassignment": "same_owner"},
        )
        resumed = self._transition_task(
            task,
            actor_id=secondary_worker["id"],
            actor_role="worker",
            target_status="in_progress",
            reason="Worker resumed after unblock.",
            metadata={"resume": True},
        )
        timeline = self.api_request("GET", f"/tasks/{task['id']}/timeline")
        board = self.api_request("GET", f"/boards/{self.qa_project['id']}")

        self.record_check(
            category="workflow",
            name="Blocked transition capture",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"Blocked transition recorded with blocker_reason='{blocked_result['task']['blocker_reason']}'.",
        )
        self.record_check(
            category="workflow",
            name="Blocked recovery path",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"Task recovered through reopened -> assigned -> in_progress with {len(timeline['transitions'])} timeline entries.",
        )
        self.record_journey(
            phase="blocked_recovery",
            status=CheckStatus.PASSED,
            detail="Blocked task was recovered and the timeline remained coherent.",
        )
        return {
            "illegal_claim_status": illegal_claim_status,
            "illegal_claim_body": illegal_claim_body,
            "blocked": blocked_result,
            "reopened": reopened,
            "resumed": resumed,
            "timeline": timeline,
            "board": board,
        }

    def browser_open_page(self, route: str) -> dict[str, Any]:
        return self.browser.open_page(route)

    def browser_click(self, selector: str) -> dict[str, Any]:
        return self.browser.click(selector)

    def browser_fill(self, selector: str, value: str) -> dict[str, Any]:
        return self.browser.fill(selector, value)

    def browser_wait_for_text(self, text: str) -> dict[str, Any]:
        return self.browser.wait_for_text(text)

    def browser_capture(self, label: str) -> str:
        path = self.browser.screenshot(label)
        return str(Path(path).resolve())

    def browser_collect_errors(self) -> dict[str, Any]:
        return self.browser.inspect_page()

    def browser_walk_core_pages(self) -> dict[str, Any]:
        self.bootstrap_qa_workspace()
        checks = [
            {"route": "/", "text": "Multi-Agent Operations Dashboard", "label": "dashboard"},
            {"route": "/projects", "text": "Project Overview", "label": "projects"},
            {"route": "/operations", "text": "Manager and Agent Control Surface", "label": "operations"},
            {"route": "/tasks", "text": "Kanban Workflow Console", "label": "tasks"},
            {"route": "/agents", "text": "Performance and Contribution", "label": "agents"},
            {"route": "/evaluations", "text": "Scorecards and Audit Visibility", "label": "evaluations"},
            {"route": "/tools", "text": "Guided Presets + Raw JSON", "label": "tools"},
        ]
        artifacts: list[str] = []
        visited: list[dict[str, Any]] = []

        for page_check in checks:
            try:
                opened = self.browser.open_page(page_check["route"])
                self.browser.wait_for_text(page_check["text"])
                if self.qa_project:
                    try:
                        self.browser.wait_for_text(self.qa_project["name"])
                    except PlaywrightError:
                        pass
                screenshot = self.browser.screenshot(f"{page_check['label']}-{self.run_id}")
                artifacts.append(screenshot)
                visited.append({"route": page_check["route"], "url": opened["url"], "heading": page_check["text"]})
            except PlaywrightError as exc:
                self.record_check(
                    category="browser_setup",
                    name=f"Browser walkthrough: {page_check['route']}",
                    status=CheckStatus.FAILED,
                    severity=Severity.HIGH,
                    detail=str(exc),
                )
                raise HarnessError(f"Browser walkthrough failed on {page_check['route']}: {exc}") from exc

        current_page = self.browser.inspect_page()
        console_noise = current_page["console_errors"] + current_page["page_errors"] + current_page["network_errors"]
        if console_noise:
            self.record_check(
                category="browser",
                name="Browser console and network noise",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                detail="Browser walkthrough completed but surfaced client-side warnings or errors.",
                evidence_refs=artifacts,
            )
        else:
            self.record_check(
                category="browser",
                name="Browser walkthrough",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail=f"Visited {len(visited)} pages and captured screenshots without console or network errors.",
                evidence_refs=artifacts,
            )

        self.record_journey(
            phase="browser",
            status=CheckStatus.PASSED,
            detail="Core authenticated pages rendered in local tester mode.",
            evidence_refs=artifacts,
        )
        return {
            "visited": visited,
            "artifacts": [Path(path).resolve().as_posix() for path in artifacts],
            "errors": current_page,
        }

    def get_agent_tool_manifest(self) -> dict[str, Any]:
        manifest = self.api_request("GET", "/agent-tools/manifest", auth_mode="agent")
        self.record_check(
            category="agent_tools",
            name="Tool manifest discovery",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"Agent manifest exposed {manifest.get('tool_count', 0)} tools.",
        )
        return manifest

    def call_agent_tool(
        self,
        tool_name: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self.settings.sentientops_api_base_url.rstrip('/')}/agent-tools/{tool_name}"
        headers = self._headers(auth_mode="agent")
        headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        response = self.http.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()

    def run_agent_tool_batch(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        return self.api_request("POST", "/agent-tools/batch/call", auth_mode="agent", payload=items)

    def exercise_agent_surface(self) -> dict[str, Any]:
        self.bootstrap_qa_workspace()
        self.ensure_qa_target()
        manifest = self.get_agent_tool_manifest()
        project_id = self.qa_project["id"]
        primary_task_id = self.qa_tasks["primary"]["id"]

        context_one = self.call_agent_tool(
            "fetch_task_context",
            {"task_id": primary_task_id},
            idempotency_key=f"{self.run_id}-fetch-task-context",
        )
        context_two = self.call_agent_tool(
            "fetch_task_context",
            {"task_id": primary_task_id},
            idempotency_key=f"{self.run_id}-fetch-task-context",
        )
        batch = self.run_agent_tool_batch(
            [
                {"tool_name": "fetch_project_memory", "payload": {"project_id": project_id, "top_k": 5}},
                {"tool_name": "fetch_task_context", "payload": {"task_id": primary_task_id}},
            ]
        )

        status, invalid_claim = self.api_request_allow_error(
            "POST",
            f"/agent-tools/claim_task",
            auth_mode="agent",
            payload={"task_id": self.qa_tasks["blocked"]["id"], "claiming_agent_id": "not-assigned"},
        )
        if context_two.get("idempotency_reused"):
            self.record_check(
                category="agent_tools",
                name="Idempotent tool replay",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail="Repeated task context call reused the cached response as expected.",
            )
        else:
            self.record_check(
                category="agent_tools",
                name="Idempotent tool replay",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                detail="Repeated task context call did not report cache reuse.",
            )
        if status == 409:
            self.record_check(
                category="agent_tools",
                name="Agent tool guardrail messaging",
                status=CheckStatus.PASSED,
                severity=Severity.INFO,
                detail=f"Invalid claim returned 409 with policy detail: {invalid_claim}",
            )
        else:
            self.record_check(
                category="agent_tools",
                name="Agent tool guardrail messaging",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                detail=f"Expected 409 from invalid agent claim but received {status}: {invalid_claim}",
            )

        self.record_journey(
            phase="agent_surface",
            status=CheckStatus.PASSED,
            detail=f"Manifest, idempotent tool replay, batch call, and error-path checks completed against project {project_id}.",
        )
        return {
            "manifest": manifest,
            "first_call": context_one,
            "second_call": context_two,
            "batch": batch,
            "invalid_claim_status": status,
            "invalid_claim": invalid_claim,
        }

    async def _run_mcp_smoke_async(self) -> dict[str, Any]:
        pythonpath = os.environ.get("PYTHONPATH", "")
        extra_pythonpath = str((self.repo_root / self.settings.sentientops_mcp_pythonpath).resolve())
        merged_pythonpath = extra_pythonpath if not pythonpath else f"{extra_pythonpath}{os.pathsep}{pythonpath}"
        params = {
            "command": str(Path(sys.executable).resolve()),
            "args": ["-m", "app.mcp.server"],
            "cwd": str((self.repo_root / self.settings.sentientops_mcp_workdir).resolve()),
            "env": {**os.environ, "PYTHONPATH": merged_pythonpath},
        }
        async with MCPServerStdio(params=params, name="sentientops-mcp") as server:
            tools = await server.list_tools()
            manifest = await server.call_tool("tool_manifest", None)
            call_result = None
            if self.qa_project:
                call_result = await server.call_tool(
                    "call_tool",
                    {
                        "tool_name": "fetch_project_memory",
                        "payload": {"project_id": self.qa_project["id"], "top_k": 3},
                        "agent_id": "qa-mcp-agent",
                        "role": "agent",
                    },
                )
        return {
            "tool_names": [tool.name for tool in tools],
            "manifest": str(manifest),
            "call_result": str(call_result) if call_result is not None else None,
        }

    def run_mcp_smoke(self) -> dict[str, Any]:
        self.bootstrap_qa_workspace()
        try:
            result = asyncio.run(self._run_mcp_smoke_async())
        except Exception as exc:
            self.record_check(
                category="mcp",
                name="MCP smoke",
                status=CheckStatus.FAILED,
                severity=Severity.HIGH,
                detail=str(exc),
            )
            raise HarnessError(f"MCP smoke failed: {exc}") from exc

        self.record_check(
            category="mcp",
            name="MCP smoke",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail=f"MCP server exposed tools: {', '.join(result['tool_names'])}",
        )
        self.record_journey(
            phase="mcp",
            status=CheckStatus.PASSED,
            detail="MCP stdio server listed tools and executed a read-only tool call.",
        )
        return result

    def build_report(
        self,
        assessment: FinalAssessment | None,
        *,
        orchestration_error: str | None = None,
    ) -> UATReport:
        finished_at = utc_now()
        failures = [check for check in self.checks if check.status == CheckStatus.FAILED]
        setup_failures = [check for check in failures if check.category in SETUP_CATEGORIES]
        application_failures = [check for check in failures if check.category not in SETUP_CATEGORIES]

        working_well = assessment.working_well if assessment else []
        broken = assessment.broken if assessment else []
        improvements = assessment.improvements if assessment else []
        next_actions = assessment.recommended_next_actions if assessment else []
        summary = assessment.summary if assessment else "UAT run produced only partial evidence."
        friction_score = assessment.friction_score if assessment else 5
        seamlessness_score = assessment.agent_seamlessness_score if assessment else 5

        if orchestration_error:
            summary = f"{summary} OpenAI orchestration error: {orchestration_error}"
            broken = [*broken, f"OpenAI orchestration failed: {orchestration_error}"]

        evidence_files = sorted(str(path.resolve().as_posix()) for path in self.artifacts_dir.glob("*") if path.is_file())
        report = UATReport(
            run_id=self.run_id,
            scenario=self.scenario,
            started_at=self.started_at.isoformat(),
            finished_at=finished_at.isoformat(),
            trace_ids=self.trace_ids,
            summary=summary,
            friction_score=friction_score,
            agent_seamlessness_score=seamlessness_score,
            journeys=self.journeys,
            checks=self.checks,
            failures=failures,
            setup_failures=setup_failures,
            application_failures=application_failures,
            working_well=list(dict.fromkeys(working_well)),
            broken=list(dict.fromkeys(broken)),
            improvements=list(dict.fromkeys(improvements)),
            recommended_next_actions=list(dict.fromkeys(next_actions)),
            created_resources=self.created_resources,
            specialist_notes=self.specialist_notes,
            evidence_files=evidence_files,
        )
        return report

    def write_report(self, report: UATReport) -> tuple[Path, Path]:
        stamp = compact_timestamp()
        json_path = self.report_dir / f"{stamp}-{self.run_id}.json"
        md_path = self.report_dir / f"{stamp}-{self.run_id}.md"

        json_path.write_text(report.model_dump_json(indent=2), encoding="utf-8")

        lines = [
            "# SentientOps UAT Report",
            "",
            f"- Run ID: `{report.run_id}`",
            f"- Scenario: `{report.scenario}`",
            f"- Started: `{report.started_at}`",
            f"- Finished: `{report.finished_at}`",
            f"- Trace IDs: {', '.join(f'`{trace_id}`' for trace_id in report.trace_ids) if report.trace_ids else 'none'}",
            "",
            "## Executive Summary",
            report.summary,
            "",
            "## Scores",
            f"- Agent seamlessness: `{report.agent_seamlessness_score}/10`",
            f"- Friction: `{report.friction_score}/10`",
            "",
            "## Working Well",
        ]
        lines.extend(f"- {item}" for item in report.working_well or ["No explicit strengths captured."])
        lines.extend(["", "## Broken"])
        lines.extend(f"- {item}" for item in report.broken or ["No critical application defects captured."])
        lines.extend(["", "## Improvements"])
        lines.extend(f"- {item}" for item in report.improvements or ["No explicit improvement list captured."])
        lines.extend(["", "## Recommended Next Actions"])
        lines.extend(f"- {item}" for item in report.recommended_next_actions or ["No explicit next actions captured."])
        lines.extend(["", "## Setup Failures"])
        if report.setup_failures:
            lines.extend(f"- [{item.severity}] {item.name}: {item.detail}" for item in report.setup_failures)
        else:
            lines.append("- None.")
        lines.extend(["", "## Application Failures"])
        if report.application_failures:
            lines.extend(f"- [{item.severity}] {item.name}: {item.detail}" for item in report.application_failures)
        else:
            lines.append("- None.")
        lines.extend(["", "## Checks"])
        lines.extend(f"- [{item.status}] {item.category} / {item.name}: {item.detail}" for item in report.checks)
        lines.extend(["", "## Journey"])
        lines.extend(f"- [{item.status}] {item.phase}: {item.detail}" for item in report.journeys)
        lines.extend(["", "## Specialist Notes"])
        if report.specialist_notes:
            for name, note in report.specialist_notes.items():
                lines.extend([f"### {name}", note, ""])
        else:
            lines.append("- No specialist notes captured.")
        lines.extend(["", "## Evidence Files"])
        lines.extend(f"- `{path}`" for path in report.evidence_files or ["No screenshots or artifacts were generated."])

        md_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
        return json_path, md_path
