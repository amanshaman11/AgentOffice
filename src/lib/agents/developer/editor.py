"""Editor agent: applies a user instruction to an existing project's files."""

from __future__ import annotations

import json

from ...code_validator import issues_to_feedback, validate_files
from ..base import BaseAgent
from ..openai_client import generate_json
from ..schemas import AgentResult
from .profiles import get_active_profile
from .schemas import ExecutorOutput

_BASE_INSTRUCTION = (
    "You are a senior software engineer performing a targeted edit on an existing project. "
    "You receive the current project files as JSON and a specific instruction describing "
    "what to change. Return the COMPLETE updated file set — include every file, even ones "
    "you didn't modify. Preserve all existing functionality unless the instruction explicitly "
    "asks to remove it. Make minimal, precise changes: only edit what the instruction requires. "
    "If the instruction adds a new feature, integrate it cleanly with the existing code. "
    "Fix any bugs you notice while editing. Return valid, runnable code."
)


class EditorAgent(BaseAgent):
    """Takes existing project files + an edit instruction and returns updated files."""

    name = "editor"

    def __init__(self, *, model: str | None = None) -> None:
        super().__init__(model=model)
        profile = get_active_profile()
        self.system_instruction = _BASE_INSTRUCTION + profile.system_instruction_suffix

    def run_edit(
        self,
        instruction: str,
        current_files: list[dict],
        *,
        allow_retry: bool = True,
    ) -> AgentResult:
        """Apply ``instruction`` to ``current_files`` and return updated executor output.

        Runs static validation on the result. If blockers remain and ``allow_retry``
        is True, one corrective re-edit pass is attempted with the error messages.
        """
        result = self._do_edit(instruction, current_files)
        if not result.success:
            return result

        feedback = self._validate(result)
        if not feedback:
            return result

        if not allow_retry:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback=f"Edit introduced code issues:\n{feedback}",
            )

        corrective_instruction = (
            f"{instruction}\n\nThe previous attempt failed validation:\n{feedback}\n"
            "Fix ALL issues above. Ensure every import/src/href reference points to "
            "a file included in the output."
        )
        retry_result = self._do_edit(corrective_instruction, current_files, allow_retry=False)
        if not retry_result.success:
            return retry_result

        retry_feedback = self._validate(retry_result)
        if retry_feedback:
            return AgentResult(
                agent=self.name,
                success=False,
                feedback=f"Edit still has issues after correction:\n{retry_feedback}",
            )
        return retry_result

    def _do_edit(
        self,
        instruction: str,
        current_files: list[dict],
        *,
        allow_retry: bool = True,
    ) -> AgentResult:
        files_json = json.dumps(current_files, indent=2)
        prompt = (
            f"Edit instruction:\n{instruction}\n\n"
            f"Current project files (JSON):\n{files_json}\n\n"
            "Return the complete updated project files."
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
                feedback="Editor returned no usable files.",
            )
        return AgentResult(agent=self.name, success=True, output=output.model_dump_json())

    @staticmethod
    def _validate(result: AgentResult) -> str:
        try:
            files = ExecutorOutput.model_validate_json(result.output).files
        except Exception:
            return "Output is not valid JSON."
        issues = validate_files(files)
        blockers = [i for i in issues if i.severity in {"blocker", "major"}]
        return issues_to_feedback(blockers) if blockers else ""

    def _execute(self, query: str, context: dict) -> AgentResult:
        return AgentResult(
            agent=self.name,
            success=False,
            feedback="Use run_edit() directly — editor is not part of the pipeline.",
        )
