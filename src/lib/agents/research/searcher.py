"""Searcher agent: collects candidate sources for a research query."""

from __future__ import annotations

from ..base import BaseAgent
from ..schemas import AgentResult


class SearcherAgent(BaseAgent):
    """Finds and lists relevant sources for the user's research query."""

    name = "searcher"
    system_instruction = (
        "You are a research librarian. Given a research query, list 5-8 credible, "
        "relevant sources (academic papers, books, reputable articles). For each "
        "source provide: title, author(s), year, publisher or venue, and a one-line "
        "relevance note. If you receive analyzer feedback, address its gaps with "
        "stronger sources."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        feedback = context.get("analyzer")
        prompt = f"Research query:\n{query}\n\nProvide the source list."
        if feedback and not feedback.success and feedback.feedback:
            prompt += (
                "\n\nPrevious sources were rejected for this reason:\n"
                f"{feedback.feedback}\nReturn an improved set of sources."
            )
        sources = self._generate(prompt)
        return AgentResult(agent=self.name, success=True, output=sources)
