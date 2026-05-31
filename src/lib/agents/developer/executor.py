"""Executor agent: generates project files from the development plan."""

from __future__ import annotations

from ..base import BaseAgent
from ..openai_client import generate_json
from ..schemas import AgentResult
from .profiles import get_active_profile
from .schemas import ExecutorOutput

_BASE_INSTRUCTION = (
    "You are a senior full-stack engineer. Given a development plan, generate the "
    "actual project files needed to satisfy it. Return complete, runnable file "
    "contents with correct relative paths, list runtime dependencies, and provide "
    "concise setup instructions. Keep the project focused and coherent; do not "
    "leave placeholder TODOs in critical paths. If you receive QA feedback, fix "
    "every reported issue."
)


class ExecutorAgent(BaseAgent):
    """Generates the project's source files based on the planner's plan."""

    name = "executor"

    def __init__(self, *, model: str | None = None) -> None:
        super().__init__(model=model)
        profile = get_active_profile()
        self.system_instruction = _BASE_INSTRUCTION + profile.system_instruction_suffix

    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        planner = context.get("planner")
        plan = planner.output if planner else ""
        prompt = (
            f"Product idea:\n{query}\n\nDevelopment plan (JSON):\n{plan}\n\n"
            "Generate the project files."
        )
        qa = context.get("qa")
        if qa and not qa.success and qa.feedback:
            prompt += (
                "\n\nThe previous implementation failed QA/validation for these reasons:\n"
                f"{qa.feedback}\n\n"
                "Fix EVERY issue listed above. Pay special attention to:\n"
                "- Syntax errors: fix the exact file and line reported.\n"
                "- Missing files: add any file that is imported/referenced but not included.\n"
                "- Broken imports: ensure every local import/require/src/href points to a file you include.\n"
                "- Placeholders: replace all TODO/placeholder with real working code.\n"
                "Return a corrected, complete set of files with no issues."
            )
        output = generate_json(
            prompt,
            ExecutorOutput,
            system_instruction=self.system_instruction,
            **({"model": self.model} if self.model else {}),
        )
        if not any(f.content.strip() for f in output.files):
            return AgentResult(
                agent=self.name,
                success=False,
                feedback="No usable files were generated.",
            )
        return AgentResult(agent=self.name, success=True, output=output.model_dump_json())
