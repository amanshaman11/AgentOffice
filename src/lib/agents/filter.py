"""Plan-aware filter: validation, retry decisions, and step routing.

These are pure functions consumed by the orchestrator. They never call Gemini and
never mutate the plan, which keeps routing decisions deterministic and testable.

Outputs are keyed by step number (int) internally; ``build_step_context`` converts
them to role-keyed dicts so individual agents don't need to know step numbers.
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

    ``attempts`` is the number of times the step has already run. Retrying is
    allowed while ``attempts`` stays under the cap from the matching fallback rule.
    """

    if not feedback.strip():
        return False
    return attempts < _max_retries_for(step_name, plan)


def build_step_context(
    current_step: PlanStep,
    plan: Plan,
    outputs: dict[int, AgentResult],
) -> dict[str, AgentResult]:
    """Build a role-keyed context dict from step-keyed outputs.

    Maps each role to the most recent completed output from any prior step with
    that role, so individual agent implementations can read results by role name
    without knowing step numbers.
    """

    context: dict[str, AgentResult] = {}
    for step in plan.steps:
        if step.step >= current_step.step:
            continue
        result = outputs.get(step.step)
        if result:
            context[step.agent] = result
    return context


def get_next_step(plan: Plan, outputs: dict[int, AgentResult]) -> PlanStep | None:
    """Return the next runnable step or ``None`` when the plan is complete.

    A step is runnable when it has no output yet and all of its dependencies
    have a successful output. Candidates are ordered: required first, then by
    step number.
    """

    def has_output(step_num: int) -> bool:
        return step_num in outputs

    def succeeded(step_num: int) -> bool:
        result = outputs.get(step_num)
        return bool(result and result.success)

    runnable = [
        step
        for step in plan.steps
        if not has_output(step.step)
        and all(succeeded(dep) for dep in step.depends_on)
    ]
    if not runnable:
        return None
    runnable.sort(key=lambda s: (not s.required, s.step))
    return runnable[0]
