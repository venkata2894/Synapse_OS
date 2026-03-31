from __future__ import annotations

from dataclasses import dataclass

from agents import Agent, RunContextWrapper, Runner, function_tool
from agents import gen_trace_id, trace

from tester.models import FinalAssessment
from tester.runtime import CheckStatus, HarnessError, Severity, UATRuntime


@dataclass
class UATRunContext:
    runtime: UATRuntime


@function_tool
def audit_environment(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Audit API, web, auth mode, and manifest readiness before mutating QA data."""

    return ctx.context.runtime.audit_environment()


@function_tool
def bootstrap_qa_workspace(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Create a QA-tagged project, manager, workers, evaluator, and starter tasks."""

    return ctx.context.runtime.bootstrap_qa_workspace()


@function_tool
def run_full_uat_flow(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Run the happy-path project workflow through handover, evaluation, and completion."""

    return ctx.context.runtime.run_full_uat_flow()


@function_tool
def run_blocked_recovery_flow(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Run a blocked-task recovery scenario including illegal-claim checks and reopen flow."""

    return ctx.context.runtime.run_blocked_recovery_flow()


@function_tool
def get_agent_tool_manifest(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Read the agent-tool manifest using the configured agent API key."""

    return ctx.context.runtime.get_agent_tool_manifest()


@function_tool
def exercise_agent_surface(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Exercise idempotent tool calls, batch calls, and guardrail messaging through /agent-tools."""

    return ctx.context.runtime.exercise_agent_surface()


@function_tool
def run_mcp_smoke(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Smoke test the stdio MCP bridge and execute a read-only tool call over MCP."""

    return ctx.context.runtime.run_mcp_smoke()


@function_tool
def browser_open_page(ctx: RunContextWrapper[UATRunContext], route: str) -> dict:
    """Open a relative page route in the local browser harness."""

    return ctx.context.runtime.browser_open_page(route)


@function_tool
def browser_click(ctx: RunContextWrapper[UATRunContext], selector: str) -> dict:
    """Click the first element matching the provided selector in the browser harness."""

    return ctx.context.runtime.browser_click(selector)


@function_tool
def browser_fill(ctx: RunContextWrapper[UATRunContext], selector: str, value: str) -> dict:
    """Fill the first matching form control in the browser harness."""

    return ctx.context.runtime.browser_fill(selector, value)


@function_tool
def browser_wait_for_text(ctx: RunContextWrapper[UATRunContext], text: str) -> dict:
    """Wait until the provided text is visible in the current browser page."""

    return ctx.context.runtime.browser_wait_for_text(text)


@function_tool
def browser_capture_screenshot(ctx: RunContextWrapper[UATRunContext], label: str) -> str:
    """Capture a full-page screenshot into the current UAT artifact directory."""

    return ctx.context.runtime.browser_capture(label)


@function_tool
def browser_collect_errors(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Return the current browser URL plus recent console, page, and network errors."""

    return ctx.context.runtime.browser_collect_errors()


@function_tool
def browser_walk_core_pages(ctx: RunContextWrapper[UATRunContext]) -> dict:
    """Visit dashboard, projects, tasks, agents, evaluations, and tools pages with screenshots."""

    return ctx.context.runtime.browser_walk_core_pages()


def build_specialists(model: str) -> tuple[Agent[UATRunContext], Agent[UATRunContext], Agent[UATRunContext], Agent[UATRunContext], Agent[UATRunContext]]:
    environment_auditor = Agent[UATRunContext](
        name="Environment Auditor",
        model=model,
        instructions=(
            "You validate runtime readiness before any QA mutations. "
            "Use the environment tools to confirm API health, web reachability, local bypass auth readiness, and agent manifest availability. "
            "Return a concise factual summary of what is ready, what is degraded, and which defects are setup-related."
        ),
        tools=[audit_environment],
    )

    project_lead_simulator = Agent[UATRunContext](
        name="Project Lead Simulator",
        model=model,
        instructions=(
            "You simulate a realistic agent team using the SentientOps workflow. "
            "Always create or reuse the run-scoped QA workspace, then execute the scenario-specific project flow. "
            "Use the happy-path tool for full_uat and ux_friction, the blocked recovery tool for blocked_recovery, and both when broader evidence will help. "
            "Keep the summary focused on what an AI agent operator would experience."
        ),
        tools=[bootstrap_qa_workspace, run_full_uat_flow, run_blocked_recovery_flow],
    )

    browser_uat_agent = Agent[UATRunContext](
        name="Browser UAT Agent",
        model=model,
        instructions=(
            "You test the application as a browser-based end user in local tester auth mode. "
            "Prefer the high-level browser walkthrough first, then use low-level page tools only when you need to confirm or isolate a UI issue. "
            "Capture screenshots whenever a page fails or when the flow is especially informative."
        ),
        tools=[
            browser_walk_core_pages,
            browser_open_page,
            browser_wait_for_text,
            browser_click,
            browser_fill,
            browser_collect_errors,
            browser_capture_screenshot,
        ],
    )

    agent_integration_agent = Agent[UATRunContext](
        name="Agent Integration Agent",
        model=model,
        instructions=(
            "You test the agent-native surfaces: manifest discovery, idempotent tool calls, batch execution, and MCP compatibility. "
            "Use the QA workspace already created for the run and separate setup defects from application defects."
        ),
        tools=[get_agent_tool_manifest, exercise_agent_surface, run_mcp_smoke],
    )

    report_synthesizer = Agent[UATRunContext](
        name="Report Synthesizer",
        model=model,
        instructions=(
            "You synthesize specialist outputs into a compact JSON-ready assessment. "
            "Focus on agent seamlessness, friction, what works, what breaks, and the highest-value next actions."
        ),
    )

    return environment_auditor, project_lead_simulator, browser_uat_agent, agent_integration_agent, report_synthesizer


def run_director(runtime: UATRuntime) -> FinalAssessment:
    model = runtime.settings.openai_tester_model
    environment_auditor, project_lead_simulator, browser_uat_agent, agent_integration_agent, report_synthesizer = build_specialists(model)

    director = Agent[UATRunContext](
        name="UAT Director",
        model=model,
        instructions=(
            "You own the full SentientOps UAT run. "
            "Call specialist tools in order: environment, project simulation, browser UAT, agent integration, then report synthesis. "
            "The scenario determines emphasis: full_uat should run the happy path, blocked_recovery should focus on blocked flow, "
            "agent_surface should focus on /agent-tools and MCP, and ux_friction should emphasize browser ergonomics while still bootstrapping realistic QA data. "
            "Your final answer must fit the FinalAssessment schema exactly. "
            "Score agent seamlessness higher when the application exposes obvious agent-oriented affordances, stable workflows, and clear guardrails. "
            "Score friction higher when hidden requirements, missing automation, or inconsistent UI and tooling create avoidable work."
        ),
        tools=[
            environment_auditor.as_tool("environment_audit", "Run environment readiness validation."),
            project_lead_simulator.as_tool("project_workflow_simulation", "Bootstrap QA data and simulate workflow execution."),
            browser_uat_agent.as_tool("browser_uat", "Exercise the UI via browser automation."),
            agent_integration_agent.as_tool("agent_surface_validation", "Exercise agent-tools and MCP surfaces."),
            report_synthesizer.as_tool("report_synthesis", "Draft a concise synthesis before final scoring."),
        ],
        output_type=FinalAssessment,
    )

    prompt = (
        f"Run the SentientOps tester harness for scenario '{runtime.scenario}'. "
        f"qa_run_id={runtime.run_id}. "
        "Use the available specialists, keep setup defects separate from product defects, and deliver a grounded assessment."
    )

    context = UATRunContext(runtime=runtime)
    trace_id = gen_trace_id()
    runtime.trace_ids.append(trace_id)

    with trace(
        workflow_name="sentientops-uat-harness",
        trace_id=trace_id,
        group_id=runtime.run_id,
        metadata={"scenario": runtime.scenario, "run_id": runtime.run_id},
    ):
        result = Runner.run_sync(director, prompt, context=context, max_turns=14)

    final_output = result.final_output
    if not isinstance(final_output, FinalAssessment):
        raise HarnessError("UAT Director did not return the expected structured final assessment.")
    return final_output


def run_uat(runtime: UATRuntime) -> FinalAssessment:
    try:
        assessment = run_director(runtime)
        runtime.record_check(
            category="openai",
            name="OpenAI multi-agent orchestration",
            status=CheckStatus.PASSED,
            severity=Severity.INFO,
            detail="Director and specialist agents completed the UAT orchestration successfully.",
        )
        return assessment
    except Exception as exc:
        runtime.record_check(
            category="openai",
            name="OpenAI multi-agent orchestration",
            status=CheckStatus.FAILED,
            severity=Severity.HIGH,
            detail=str(exc),
        )
        raise
