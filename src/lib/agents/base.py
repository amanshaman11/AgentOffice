"""Abstract base class shared by every AgentOffice agent."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .gemini_client import GeminiError, generate_text
from .schemas import AgentResult


class BaseAgent(ABC):
    """Common contract and Gemini access for concrete agents.

    Subclasses implement :meth:`_execute`; :meth:`run` wraps it so any failure is
    returned as an unsuccessful :class:`AgentResult` instead of raising.
    """

    name: str
    system_instruction: str = ""

    def __init__(self, *, model: str | None = None) -> None:
        self.model = model

    @abstractmethod
    def _execute(self, query: str, context: dict[str, AgentResult]) -> AgentResult:
        """Produce the agent's result. Implemented by subclasses."""

    def run(self, query: str, context: dict[str, AgentResult] | None = None) -> AgentResult:
        """Execute the agent, converting unexpected errors into a failed result."""

        try:
            return self._execute(query, context or {})
        except GeminiError as error:
            return AgentResult(agent=self.name, success=False, feedback=str(error))
        except Exception as error:  # noqa: BLE001 - defensive boundary for the pipeline
            return AgentResult(
                agent=self.name,
                success=False,
                feedback=f"Unexpected error in {self.name}: {error}",
            )

    def _generate(self, prompt: str) -> str:
        """Generate text with this agent's system instruction and model."""

        kwargs = {"system_instruction": self.system_instruction or None}
        if self.model:
            kwargs["model"] = self.model
        return generate_text(prompt, **kwargs)
