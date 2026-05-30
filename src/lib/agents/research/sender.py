"""Sender agent: formats citations and assembles the final deliverable."""

from __future__ import annotations

from ..base import BaseAgent
from ..schemas import AgentResult


class SenderAgent(BaseAgent):
    """Formats APA 7 / MLA citations and produces the final deliverable."""

    name = "sender"
    system_instruction = (
        "You are a citation and delivery specialist. Given a research summary and "
        "its sources, produce a final deliverable containing: the summary, an APA 7 "
        "reference list, and an MLA works-cited list. Ensure every cited source is "
        "formatted correctly and consistently."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        summarizer = context.get("summarizer")
        searcher = context.get("searcher")
        summary = summarizer.output if summarizer else ""
        sources = searcher.output if searcher else ""
        prompt = (
            f"Research query:\n{query}\n\nSummary:\n{summary}\n\nSources:\n{sources}\n\n"
            "Produce the final deliverable with APA 7 and MLA citations."
        )
        deliverable = self._generate(prompt)
        return AgentResult(agent=self.name, success=True, output=deliverable)
