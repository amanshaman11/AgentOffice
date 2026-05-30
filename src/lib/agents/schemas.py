"""Pydantic data models shared across the AgentOffice plan-then-execute pipeline."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PlanStep(BaseModel):
    """A single ordered unit of work the orchestrator dispatches to one agent."""

    step: int = Field(..., ge=1, description="1-based position within the plan.")
    agent: str = Field(..., description="Name of the agent that executes this step.")
    depends_on: list[int] = Field(
        default_factory=list,
        description="Step numbers that must succeed before this step can run.",
    )
    required: bool = Field(
        default=True,
        description="Whether the plan is considered complete only after this step.",
    )


class Plan(BaseModel):
    """Structured execution plan produced by the Planner agent."""

    goal: str = Field(..., description="One-sentence description of the desired outcome.")
    steps: list[PlanStep] = Field(..., min_length=1)
    fallback_rules: list[str] = Field(
        default_factory=list,
        description="Natural-language recovery rules consulted when a step fails.",
    )

    def step_for(self, agent: str) -> PlanStep | None:
        """Return the first step assigned to ``agent`` or ``None``."""

        return next((s for s in self.steps if s.agent == agent), None)

    def step_by_number(self, number: int) -> PlanStep | None:
        """Return the step whose ``step`` equals ``number`` or ``None``."""

        return next((s for s in self.steps if s.step == number), None)


class AgentResult(BaseModel):
    """Outcome of running a single agent."""

    agent: str
    success: bool
    output: str = ""
    feedback: str = ""


class ValidationResult(BaseModel):
    """Result of validating an :class:`AgentResult` against the plan."""

    valid: bool
    reason: str = ""
