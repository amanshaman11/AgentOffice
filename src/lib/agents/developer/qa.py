"""QA agent: reviews generated code against the plan's acceptance criteria."""

from __future__ import annotations

from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult
from .schemas import QAReport


class QAAgent(BaseAgent):
    """Reviews executor output; fails with actionable feedback when issues exist."""

    name = "qa"
    system_instruction = (
        "You are a pragmatic QA engineer reviewing AI-generated prototype code. "
        "Pass the review when the core idea is implemented, files are coherent, and "
        "the project could be iterated on — even if polish is missing. Only fail for "
        "blocker or major issues (missing entry point, empty files, completely wrong "
        "stack, or criteria clearly unmet). Minor style gaps, missing tests, or small "
        "imperfections should be noted as minor issues but must NOT fail the review."
    )

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        executor = context.get("executor")
        planner = context.get("planner")
        if not executor or not executor.output:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="No code was provided by the executor.",
            )
        prompt = (
            f"Product idea:\n{query}\n\nDevelopment plan (JSON):\n"
            f"{planner.output if planner else ''}\n\nGenerated files (JSON):\n"
            f"{executor.output}\n\nReturn your QA report."
        )
        report = generate_json(
            prompt,
            QAReport,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        blocking = [
            i for i in report.issues if i.severity.lower() in {"blocker", "major"}
        ]
        if report.passed or not blocking:
            return AgentResult(agent=self.name, success=True, output=report.model_dump_json())
        feedback = "\n".join(
            f"[{i.severity}] {i.file}: {i.description} -> {i.fix}".strip()
            for i in blocking
        ) or report.summary or "Code did not pass QA."
        return AgentResult(agent=self.name, success=False, feedback=feedback)
