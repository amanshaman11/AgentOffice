"""Streaming orchestrator with WebSocket support and metrics tracking."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from .orchestrator import Orchestrator, OrchestrationResult, _SKIPPED_MARKER, _reroute_target_step
from .filter import build_step_context, get_next_step, should_retry, validate_step
from .schemas import Plan


class StreamingOrchestrator(Orchestrator):
    async def run_with_streaming(
        self,
        query: str,
        *,
        plan: Plan | None = None,
        on_progress: Callable | None = None,
        on_agent_complete: Callable | None = None,
    ) -> tuple[OrchestrationResult, list[dict]]:
        if plan is None:
            plan = self.planner.create_plan(query)
        
        log: list[str] = [f"Planned {len(plan.steps)} steps for goal: {plan.goal}"]
        metrics: list[dict] = []
        
        if on_progress:
            await on_progress(0, len(plan.steps), "planner", "started", "Planning complete")
        
        if not self.approve(plan):
            return (
                OrchestrationResult(
                    goal=plan.goal,
                    plan=plan,
                    success=False,
                    outputs={},
                    final_output="",
                    log=log + ["Plan was not approved."],
                ),
                metrics,
            )
        
        outputs: dict[int, any] = {}
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
                    result = self._finalize(plan, outputs, log, success=False)
                    return result, metrics
                outputs[step.step] = type("AgentResult", (), {
                    "agent": step.agent,
                    "success": True,
                    "output": _SKIPPED_MARKER,
                    "feedback": ""
                })()
                continue
            
            attempts[step.step] += 1
            
            if on_progress:
                await on_progress(
                    step.step,
                    len(plan.steps),
                    step.agent,
                    "running",
                    f"Running {step.agent} (attempt {attempts[step.step]})",
                )
            
            start_time = time.time()
            context = build_step_context(step, plan, outputs)
            result = agent.run(query, context=context)
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            metrics.append({
                "agent_name": step.agent,
                "success": result.success,
                "execution_time_ms": execution_time_ms,
                "attempt_number": attempts[step.step],
                "error_message": result.feedback if not result.success else None,
            })
            
            validation = validate_step(result, plan, step)
            
            if validation.valid:
                outputs[step.step] = result
                log.append(f"Step {step.step} '{step.agent}' succeeded.")
                
                if on_agent_complete:
                    await on_agent_complete(step.agent, result.output, True)
                
                if on_progress:
                    await on_progress(
                        step.step,
                        len(plan.steps),
                        step.agent,
                        "completed",
                        f"Completed {step.agent}",
                    )
                continue
            
            log.append(
                f"Step {step.step} '{step.agent}' failed (attempt "
                f"{attempts[step.step]}): {validation.reason}"
            )
            
            if on_agent_complete:
                await on_agent_complete(step.agent, validation.reason, False)
            
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
                result = self._finalize(plan, outputs, log, success=False)
                return result, metrics
            
            outputs[step.step] = type("AgentResult", (), {
                "agent": step.agent,
                "success": True,
                "output": _SKIPPED_MARKER,
                "feedback": ""
            })()
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
        result = self._finalize(plan, outputs, log, success=success)
        return result, metrics
