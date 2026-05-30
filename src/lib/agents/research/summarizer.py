"""Summarizer agent: produces a concise research summary from validated sources."""

from __future__ import annotations

from ..base import BaseAgent
from ..schemas import AgentResult


class SummarizerAgent(BaseAgent):
    """Synthesizes the analyzed sources into a concise research summary."""

    name = "summarizer"
    system_instruction = (
        "You are an expert research writer. Produce a concise, well-structured "
        "summary (250-400 words) of the findings supported by the provided sources. "
        "Use neutral academic tone, group related points, and avoid fabricating "
        "details not implied by the sources."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        searcher = context.get("searcher")
        sources = searcher.output if searcher else ""
        prompt = (
            f"Research query:\n{query}\n\nValidated sources:\n{sources}\n\n"
            "Write the research summary."
        )
        summary = self._generate(prompt)
        return AgentResult(agent=self.name, success=True, output=summary)
