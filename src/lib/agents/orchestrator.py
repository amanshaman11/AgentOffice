"""Orchestrator: drives the plan-then-execute flow through the filter."""

from __future__ import annotations

import os
import re
from collections import defaultdict
from typing import Callable

from pydantic import BaseModel

from .base import BaseAgent
from .developer import build_developer_agents
from .filter import build_step_context, get_next_step, should_retry, validate_step
from .planner import Planner, default_developer_plan
from .research import build_research_agents
from .schemas import AgentResult, Plan, PlanStep

_SKIPPED_MARKER = "[skipped: optional step]"

_TERMINAL_PREFERENCE = {
    "research": ("sender", "summarizer"),
    "developer": ("executor", "deployer", "marketing", "qa"),
}


class _DefaultDeveloperPlanner:
    """Minimal planner providing the deterministic developer plan when no roster is set."""

    def __init__(self, *, model: str | None = None) -> None:
        self.model = model

    def create_plan(self, query: str) -> Plan:
        return default_developer_plan(query)


def make_planner(office_type: str = "research", *, model: str | None = None):
    """Return the plan provider for ``office_type``."""

    if office_type == "developer":
        return _DefaultDeveloperPlanner(model=model)
    return Planner(model=model)


def build_agents(
    office_type: str = "research",
    *,
    model: str | None = None,
    code_model: str | None = None,
) -> dict[str, BaseAgent]:
    """Return the agent registry for ``office_type``."""

    if office_type == "developer":
        return build_developer_agents(
            model=model,
            code_model=code_model or os.getenv("OPENAI_CODE_MODEL", "gpt-5.4-mini"),
        )
    return build_research_agents(model=model)


class OrchestrationResult(BaseModel):
    """Final outcome of an orchestration run."""

    goal: str
    plan: Plan
    success: bool
    outputs: dict[str, AgentResult]  # keys are step numbers as strings ("1", "2", …)
    final_output: str
    log: list[str]


def _reroute_target_step(plan: Plan, failed_step: PlanStep) -> int | None:
    """Find the step number to re-route to when ``failed_step`` fails.

    Reads fallback rules such as "if analyzer fails, retry searcher max 2 times"
    and returns the most recent prior step whose role matches the retry target.
    """

    for rule in plan.fallback_rules:
        lowered = rule.lower()
        if failed_step.agent.lower() not in lowered:
            continue
        match = re.search(r"retry\s+([a-z_]+)", lowered)
        if not match:
            continue
        target_role = match.group(1)
        prior = [
            s for s in plan.steps
            if s.agent == target_role and s.step < failed_step.step
        ]
        if prior:
            return max(prior, key=lambda s: s.step).step
    return None


class Orchestrator:
    """Plans the work, then executes it step-by-step with validation and re-routing."""

    def __init__(
        self,
        *,
        planner=None,
        agents: dict[str, BaseAgent] | None = None,
        model: str | None = None,
        office_type: str = "research",
        approve: Callable[[Plan], bool] | None = None,
    ) -> None:
        self.office_type = office_type
        self.planner = planner or make_planner(office_type, model=model)
        self.agents = agents or build_agents(office_type, model=model)
        self.approve = approve or (lambda _plan: True)

    def run(self, query: str, *, plan: Plan | None = None) -> OrchestrationResult:
        """Execute the pipeline for ``query`` and return the aggregated result.

        If ``plan`` is provided it is used as-is (roster-driven mode). Otherwise
        the planner generates one from the query.
        """

        if plan is None:
            plan = self.planner.create_plan(query)
        log: list[str] = [f"Planned {len(plan.steps)} steps for goal: {plan.goal}"]

        if not self.approve(plan):
            return OrchestrationResult(
                goal=plan.goal,
                plan=plan,
                success=False,
                outputs={},
                final_output="",
                log=log + ["Plan was not approved."],
            )

        outputs: dict[int, AgentResult] = {}
        attempts: dict[int, int] = defaultdict(int)
        max_iterations = sum(2 + s.step for s in plan.steps) + len(plan.steps) * 2

        for _ in range(max_iterations):
            step = get_next_step(plan, outputs)
            if step is None:
                break

            agent = self.agents.get(step.agent)
            if agent is None:
                log.append(f"No agent registered for '{step.agent}'.")
                if step.required:
                    return self._finalize(plan, outputs, log, success=False)
                outputs[step.step] = AgentResult(
                    agent=step.agent, success=True, output=_SKIPPED_MARKER
                )
                continue

            attempts[step.step] += 1
            context = build_step_context(step, plan, outputs)
            result = agent.run(query, context=context)
            validation = validate_step(result, plan, step)

            if validation.valid:
                outputs[step.step] = result
                log.append(f"Step {step.step} '{step.agent}' succeeded.")
                continue

            log.append(
                f"Step {step.step} '{step.agent}' failed (attempt "
                f"{attempts[step.step]}): {validation.reason}"
            )

            if should_retry(validation.reason, step.agent, plan, attempts[step.step]):
                outputs.pop(step.step, None)
                target_step_num = _reroute_target_step(plan, step)
                if target_step_num is not None and target_step_num != step.step:
                    target_plan_step = plan.step_by_number(target_step_num)
                    outputs.pop(target_step_num, None)
                    attempts[target_step_num] = 0
                    role_name = target_plan_step.agent if target_plan_step else "agent"
                    log.append(f"Re-routing to '{role_name}' per fallback rules.")
                continue

            if step.required:
                log.append(f"Required step '{step.agent}' exhausted retries. Aborting.")
                return self._finalize(plan, outputs, log, success=False)

            outputs[step.step] = AgentResult(
                agent=step.agent, success=True, output=_SKIPPED_MARKER
            )
            log.append(f"Optional step '{step.agent}' skipped.")
        else:
            log.append("Reached iteration limit; stopping.")

        success = all(
            (r := outputs.get(s.step)) is not None
            and r.success
            and r.output != _SKIPPED_MARKER
            for s in plan.steps
            if s.required
        )
        return self._finalize(plan, outputs, log, success=success)

    def _finalize(
        self,
        plan: Plan,
        outputs: dict[int, AgentResult],
        log: list[str],
        *,
        success: bool,
    ) -> OrchestrationResult:
        final_output = ""
        for role in _TERMINAL_PREFERENCE.get(self.office_type, ("sender", "summarizer")):
            for step in reversed(plan.steps):
                if step.agent == role:
                    r = outputs.get(step.step)
                    if r and r.success and r.output != _SKIPPED_MARKER:
                        final_output = r.output
                        break
            if final_output:
                break
        if not final_output:
            for step in reversed(plan.steps):
                r = outputs.get(step.step)
                if r and r.success and r.output != _SKIPPED_MARKER:
                    final_output = r.output
                    break

        return OrchestrationResult(
            goal=plan.goal,
            plan=plan,
            success=success,
            outputs={str(step_num): result for step_num, result in outputs.items()},
            final_output=final_output,
            log=log,
        )
