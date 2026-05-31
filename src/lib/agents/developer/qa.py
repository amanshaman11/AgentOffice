"""QA agent: reviews generated code against the plan's acceptance criteria."""

from __future__ import annotations

from ...code_validator import issues_to_feedback, validate_files
from ..base import BaseAgent
from ..gemini_client import generate_json
from ..schemas import AgentResult
from .schemas import ExecutorOutput, QAReport


class QAAgent(BaseAgent):
    """Reviews executor output; fails with actionable feedback when issues exist."""

    name = "qa"
    system_instruction = (
        "You are a strict QA engineer reviewing AI-generated code before it ships. "
        "Your primary job is to catch bugs that would prevent the project from running. "
        "FAIL (blocker or major) for ANY of these: syntax errors that prevent parsing, "
        "import/require statements referencing non-existent local files or modules, "
        "missing entry point (e.g. no main file, no index.html), "
        "empty or near-empty files that are supposed to contain logic, "
        "completely wrong tech stack vs the plan, "
        "broken wiring (e.g. calling a function not defined anywhere in the project), "
        "or acceptance criteria clearly unmet. "
        "Mark as minor (do NOT fail): missing tests, style issues, incomplete docs, "
        "optional polish, missing error handling in non-critical paths. "
        "For every blocker/major issue, provide a precise fix description so the executor "
        "can correct it. Be specific: name the file, line range, and exact change needed."
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

        static_feedback = self._run_static_validation(executor.output)
        if static_feedback:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback=static_feedback,
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

    @staticmethod
    def _run_static_validation(executor_output: str) -> str:
        try:
            files = ExecutorOutput.model_validate_json(executor_output).files
        except Exception:
            return "Executor output is not valid JSON or cannot be parsed."
        issues = validate_files(files)
        blockers = [i for i in issues if i.severity in {"blocker", "major"}]
        if blockers:
            return "Static validation failed:\n" + issues_to_feedback(blockers)
        return ""
