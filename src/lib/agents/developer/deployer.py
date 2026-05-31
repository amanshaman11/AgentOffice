"""Deployer agent: produces a deployment checklist for the built project."""

from __future__ import annotations

from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult
from .schemas import DeployChecklist


class DeployerAgent(BaseAgent):
    """Creates a deployment plan from the project's stack and files."""

    name = "deployer"
    system_instruction = (
        "You are a DevOps engineer. Given a project's tech stack and generated files, "
        "produce a practical deployment checklist: recommend a suitable hosting "
        "platform, list required environment variables, give ordered deployment steps, "
        "outline a minimal CI/CD pipeline, and define post-deploy verification checks. "
        "Be concrete and platform-appropriate."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        planner = context.get("planner")
        executor = context.get("executor")
        prompt = (
            f"Product idea:\n{query}\n\nDevelopment plan (JSON):\n"
            f"{planner.output if planner else ''}\n\nGenerated project (JSON):\n"
            f"{executor.output if executor else ''}\n\nReturn the deployment checklist."
        )
        checklist = generate_json(
            prompt,
            DeployChecklist,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        if not checklist.steps:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="Deployment checklist has no steps.",
            )
        return AgentResult(agent=self.name, success=True, output=checklist.model_dump_json())
