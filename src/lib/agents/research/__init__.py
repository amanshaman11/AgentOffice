"""Research Office agents and their registry."""

from __future__ import annotations

from ..base import BaseAgent
from .analyzer import AnalyzerAgent
from .searcher import SearcherAgent
from .sender import SenderAgent
from .summarizer import SummarizerAgent


def build_research_agents(*, model: str | None = None) -> dict[str, BaseAgent]:
    """Return the Research Office agents keyed by their ``name``."""

    agents: list[BaseAgent] = [
        SearcherAgent(model=model),
        AnalyzerAgent(model=model),
        SummarizerAgent(model=model),
        SenderAgent(model=model),
    ]
    return {agent.name: agent for agent in agents}


__all__ = [
    "SearcherAgent",
    "AnalyzerAgent",
    "SummarizerAgent",
    "SenderAgent",
    "build_research_agents",
]
