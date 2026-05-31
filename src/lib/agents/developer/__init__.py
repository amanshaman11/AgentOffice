"""Developer Office agents and their registry."""

from __future__ import annotations

from ..base import BaseAgent
from .deployer import DeployerAgent
from .executor import ExecutorAgent
from .marketing import MarketingAgent
from .planner_agent import DeveloperPlannerAgent
from .qa import QAAgent


def build_developer_agents(*, model: str | None = None) -> dict[str, BaseAgent]:
    """Return the Developer Office agents keyed by their ``name``."""

    agents: list[BaseAgent] = [
        DeveloperPlannerAgent(model=model),
        ExecutorAgent(model=model),
        QAAgent(model=model),
        DeployerAgent(model=model),
        MarketingAgent(model=model),
    ]
    return {agent.name: agent for agent in agents}


__all__ = [
    "DeveloperPlannerAgent",
    "ExecutorAgent",
    "QAAgent",
    "DeployerAgent",
    "MarketingAgent",
    "build_developer_agents",
]
