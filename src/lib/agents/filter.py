"""Plan-aware filter: validation, retry decisions, and step routing.

These are pure functions consumed by the orchestrator. They never call Gemini and
never mutate the plan, which keeps routing decisions deterministic and testable.
"""

from __future__ import annotations

import re

from .schemas import AgentResult, Plan, PlanStep, ValidationResult

_DEFAULT_MAX_RETRIES = 2


def validate_step(
    step_output: AgentResult, plan: Plan, current_step: PlanStep
) -> ValidationResult:
    """Validate an agent result against the plan step it was meant to satisfy."""

    if step_output.agent != current_step.agent:
        return ValidationResult(
            valid=False,
            reason=(
                f"Step {current_step.step} expected '{current_step.agent}' "
                f"but got '{step_output.agent}'."
            ),
        )
    if not step_output.success:
        return ValidationResult(
            valid=False,
            reason=step_output.feedback or f"Agent '{step_output.agent}' reported failure.",
        )
    if not step_output.output.strip():
        return ValidationResult(
            valid=False, reason=f"Agent '{step_output.agent}' produced no output."
        )
    missing = [
        dep
        for dep in current_step.depends_on
        if plan.step_by_number(dep) is None
    ]
    if missing:
        return ValidationResult(
            valid=False,
            reason=f"Step {current_step.step} depends on unknown steps {missing}.",
        )
    return ValidationResult(valid=True, reason="Output matches the plan.")


def _max_retries_for(step_name: str, plan: Plan) -> int:
    """Read a per-agent retry cap from the plan's fallback rules."""

    for rule in plan.fallback_rules:
        if step_name.lower() in rule.lower():
            match = re.search(r"max\s+(\d+)", rule.lower())
            if match:
                return int(match.group(1))
            return _DEFAULT_MAX_RETRIES
    return _DEFAULT_MAX_RETRIES


def should_retry(feedback: str, step_name: str, plan: Plan, attempts: int) -> bool:
    """Decide whether a failed step warrants another attempt.

    ``attempts`` is the number of times the step has already run. Retrying is allowed
    while ``attempts`` stays under the cap derived from the matching fallback rule.
    """

    if not feedback.strip():
        return False
    return attempts < _max_retries_for(step_name, plan)


def get_next_step(
    current_step: int, plan: Plan, previous_outputs: dict[str, AgentResult]
) -> PlanStep | None:
    """Return the next runnable step or ``None`` when the plan is complete.

    A step is runnable when it has not produced a successful output yet and all of
    its dependencies have succeeded. Candidates are ordered by priority (required
    steps first) then by step number.
    """

    def succeeded(name: str) -> bool:
        result = previous_outputs.get(name)
        return bool(result and result.success)

    runnable = [
        step
        for step in plan.steps
        if step.step > 0
        and not succeeded(step.agent)
        and all(
            succeeded(dep_step.agent)
            for dep in step.depends_on
            if (dep_step := plan.step_by_number(dep)) is not None
        )
    ]
    if not runnable:
        return None
    runnable.sort(key=lambda s: (not s.required, s.step))
    return runnable[0]
