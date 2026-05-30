"""Analyzer agent: judges source quality and emits feedback when weak."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult


class _QualityVerdict(BaseModel):
    sufficient: bool = Field(..., description="True if sources are strong enough to summarize.")
    assessment: str = Field(..., description="Short justification of the verdict.")
    feedback: str = Field(default="", description="Actionable gaps to fix if insufficient.")


class AnalyzerAgent(BaseAgent):
    """Reviews collected sources; returns failure plus feedback if quality is weak."""

    name = "analyzer"
    system_instruction = (
        "You are a rigorous research reviewer. Assess whether a set of sources is "
        "credible, recent, relevant, and diverse enough to support a summary. Be "
        "strict: if sources are missing, low-quality, or off-topic, mark them "
        "insufficient and explain exactly what to improve."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        searcher = context.get("searcher")
        if not searcher or not searcher.output:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="No sources were provided by the searcher.",
            )
        prompt = (
            f"Research query:\n{query}\n\nSources to evaluate:\n{searcher.output}\n\n"
            "Return your quality verdict."
        )
        verdict = generate_json(
            prompt,
            _QualityVerdict,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        return AgentResult(
            agent=self.name,
            success=verdict.sufficient,
            output=verdict.assessment,
            feedback="" if verdict.sufficient else verdict.feedback or verdict.assessment,
        )
