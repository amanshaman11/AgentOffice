"""Developer Planner agent: turns a product idea into a structured build plan."""

from __future__ import annotations

from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult
from .schemas import DevPlanOutput


class DeveloperPlannerAgent(BaseAgent):
    """Converts a SaaS/product idea into a development plan."""

    name = "planner"
    system_instruction = (
        "You are a senior software architect. Given a product idea, produce a "
        "concrete development plan: recommend a realistic tech stack, break the work "
        "into milestones and ordered implementation tasks, propose a sensible file "
        "structure, and define clear acceptance criteria the finished build must meet. "
        "Be specific and buildable; avoid vague filler."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        prompt = f"Product idea:\n{query}\n\nProduce the development plan."
        plan = generate_json(
            prompt,
            DevPlanOutput,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        if not plan.milestones or not plan.acceptance_criteria:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="Plan is underspecified: missing milestones or acceptance criteria.",
            )
        return AgentResult(agent=self.name, success=True, output=plan.model_dump_json())
