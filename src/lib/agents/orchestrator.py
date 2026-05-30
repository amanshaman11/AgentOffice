"""Orchestrator: drives the plan-then-execute flow through the filter."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Callable

from pydantic import BaseModel

from .base import BaseAgent
from .filter import get_next_step, should_retry, validate_step
from .planner import Planner
from .research import build_research_agents
from .schemas import AgentResult, Plan

_SKIPPED_MARKER = "[skipped: optional step]"


class OrchestrationResult(BaseModel):
    """Final outcome of an orchestration run."""

    goal: str
    plan: Plan
    success: bool
    outputs: dict[str, AgentResult]
    final_output: str
    log: list[str]


def _reroute_target(plan: Plan, failed_agent: str) -> str | None:
    """Find the agent a fallback rule says to retry when ``failed_agent`` fails."""

    known = {s.agent for s in plan.steps}
    for rule in plan.fallback_rules:
        lowered = rule.lower()
        if failed_agent.lower() not in lowered:
            continue
        match = re.search(r"retry\s+([a-z_]+)", lowered)
        if match and match.group(1) in known:
            return match.group(1)
    return None


class Orchestrator:
    """Plans the work, then executes it step-by-step with validation and re-routing."""

    def __init__(
        self,
        *,
        planner: Planner | None = None,
        agents: dict[str, BaseAgent] | None = None,
        model: str | None = None,
        approve: Callable[[Plan], bool] | None = None,
    ) -> None:
        self.planner = planner or Planner(model=model)
        self.agents = agents or build_research_agents(model=model)
        self.approve = approve or (lambda _plan: True)

    def run(self, query: str) -> OrchestrationResult:
        """Execute the full pipeline for ``query`` and return the aggregated result."""

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

        outputs: dict[str, AgentResult] = {}
        attempts: dict[str, int] = defaultdict(int)
        max_iterations = sum(2 + s.step for s in plan.steps) + len(plan.steps) * 2

        for _ in range(max_iterations):
            step = get_next_step(0, plan, outputs)
            if step is None:
                break

            agent = self.agents.get(step.agent)
            if agent is None:
                log.append(f"No agent registered for '{step.agent}'.")
                if step.required:
                    return self._finalize(plan, outputs, log, success=False)
                outputs[step.agent] = AgentResult(
                    agent=step.agent, success=True, output=_SKIPPED_MARKER
                )
                continue

            attempts[step.agent] += 1
            result = agent.run(query, context=outputs)
            validation = validate_step(result, plan, step)

            if validation.valid:
                outputs[step.agent] = result
                log.append(f"Step {step.step} '{step.agent}' succeeded.")
                continue

            log.append(
                f"Step {step.step} '{step.agent}' failed (attempt "
                f"{attempts[step.agent]}): {validation.reason}"
            )

            if should_retry(validation.reason, step.agent, plan, attempts[step.agent]):
                outputs.pop(step.agent, None)
                target = _reroute_target(plan, step.agent)
                if target and target != step.agent:
                    outputs.pop(target, None)
                    attempts[target] = 0
                    log.append(f"Re-routing to '{target}' per fallback rules.")
                continue

            if step.required:
                log.append(f"Required step '{step.agent}' exhausted retries. Aborting.")
                return self._finalize(plan, outputs, log, success=False)

            outputs[step.agent] = AgentResult(
                agent=step.agent, success=True, output=_SKIPPED_MARKER
            )
            log.append(f"Optional step '{step.agent}' skipped.")
        else:
            log.append("Reached iteration limit; stopping.")

        success = all(
            (r := outputs.get(s.agent)) is not None
            and r.success
            and r.output != _SKIPPED_MARKER
            for s in plan.steps
            if s.required
        )
        return self._finalize(plan, outputs, log, success=success)

    @staticmethod
    def _finalize(
        plan: Plan, outputs: dict[str, AgentResult], log: list[str], *, success: bool
    ) -> OrchestrationResult:
        final_output = ""
        for agent in ("sender", "summarizer"):
            result = outputs.get(agent)
            if result and result.success and result.output != _SKIPPED_MARKER:
                final_output = result.output
                break
        return OrchestrationResult(
            goal=plan.goal,
            plan=plan,
            success=success,
            outputs=outputs,
            final_output=final_output,
            log=log,
        )
