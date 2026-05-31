"""Marketing agent: generates launch content for the built product."""

from __future__ import annotations

from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult
from .schemas import MarketingAssets


class MarketingAgent(BaseAgent):
    """Creates launch copy, social posts, and feature bullets from the project."""

    name = "marketing"
    system_instruction = (
        "You are a SaaS marketing lead. Given a product idea, development plan, and "
        "generated project, write compelling launch content: a sharp tagline, feature "
        "bullets, landing-page copy, platform-specific social posts, and a short launch "
        "email draft. Match the product's tone and audience."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        planner = context.get("planner")
        executor = context.get("executor")
        deployer = context.get("deployer")
        prompt = (
            f"Product idea:\n{query}\n\nDevelopment plan (JSON):\n"
            f"{planner.output if planner else ''}\n\nGenerated project (JSON):\n"
            f"{executor.output if executor else ''}\n\nDeployment notes (JSON):\n"
            f"{deployer.output if deployer else ''}\n\nReturn marketing assets."
        )
        assets = generate_json(
            prompt,
            MarketingAssets,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        if not assets.tagline.strip():
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="Marketing output is missing a tagline.",
            )
        return AgentResult(agent=self.name, success=True, output=assets.model_dump_json())
