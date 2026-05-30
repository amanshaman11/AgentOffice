"""Planner agent: turns a user request into a validated execution plan."""

from __future__ import annotations

from .gemini_client import GeminiError, generate_json
from .schemas import Plan, PlanStep

DEFAULT_AGENT_SEQUENCE = ("searcher", "analyzer", "summarizer", "sender")


def default_plan(goal: str) -> Plan:
    """Return the deterministic Research Office plan used as a fallback."""

    return Plan(
        goal=goal,
        steps=[
            PlanStep(step=1, agent="searcher", depends_on=[], required=True),
            PlanStep(step=2, agent="analyzer", depends_on=[1], required=True),
            PlanStep(step=3, agent="summarizer", depends_on=[2], required=True),
            PlanStep(step=4, agent="sender", depends_on=[3], required=False),
        ],
        fallback_rules=["if analyzer fails, retry searcher max 2 times"],
    )


class Planner:
    """Generates an execution :class:`Plan` from a research query or SaaS idea."""

    system_instruction = (
        "You are the planning lead of a multi-agent research office. Given a user "
        "request, produce an execution plan as steps assigned to these agents only: "
        f"{', '.join(DEFAULT_AGENT_SEQUENCE)}. The searcher gathers sources, the "
        "analyzer validates source quality, the summarizer writes the summary, and "
        "the sender formats citations and delivers results. Set realistic depends_on "
        "links, mark the sender optional, and include concrete fallback_rules such as "
        "retrying the searcher when the analyzer reports weak sources."
    )

    def __init__(self, *, model: str | None = None) -> None:
        self.model = model

    def create_plan(self, query: str) -> Plan:
        """Return a plan for ``query``, falling back to the default on failure."""

        prompt = f"User request:\n{query}\n\nProduce the execution plan."
        try:
            plan = generate_json(
                prompt,
                Plan,
                system_instruction=self.system_instruction,
                **({"model": self.model} if self.model else {}),
            )
        except GeminiError:
            return default_plan(query)
        return self._sanitize(plan, query)

    @staticmethod
    def _sanitize(plan: Plan, query: str) -> Plan:
        """Drop steps with unknown agents and ensure the plan stays executable."""

        valid_steps = [s for s in plan.steps if s.agent in DEFAULT_AGENT_SEQUENCE]
        if not valid_steps:
            return default_plan(query)
        known = {s.step for s in valid_steps}
        for step in valid_steps:
            step.depends_on = [d for d in step.depends_on if d in known and d != step.step]
        plan.steps = sorted(valid_steps, key=lambda s: s.step)
        if not plan.goal.strip():
            plan.goal = query
        return plan
