"""Structured output models for the Developer Office agents."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Milestone(BaseModel):
    title: str = Field(..., description="Short milestone name.")
    description: str = Field(default="", description="What this milestone delivers.")


class DevPlanOutput(BaseModel):
    """Planner agent output: a structured development plan."""

    goal: str = Field(..., description="One-sentence description of the product goal.")
    tech_stack: list[str] = Field(default_factory=list, description="Recommended technologies.")
    milestones: list[Milestone] = Field(default_factory=list)
    file_structure: list[str] = Field(
        default_factory=list, description="Proposed project file/directory paths."
    )
    tasks: list[str] = Field(default_factory=list, description="Ordered implementation tasks.")
    acceptance_criteria: list[str] = Field(
        default_factory=list, description="Conditions the finished build must satisfy."
    )


class CodeFile(BaseModel):
    """A single generated source file."""

    path: str = Field(..., description="Relative file path, e.g. 'src/index.js'.")
    content: str = Field(..., description="Full file contents.")
    language: str = Field(default="", description="Language or file type, e.g. 'python'.")


class ExecutorOutput(BaseModel):
    """Executor agent output: generated project files and setup notes."""

    files: list[CodeFile] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    setup_instructions: str = Field(default="", description="How to install and run the project.")


class QAIssue(BaseModel):
    """A single problem found during QA review."""

    severity: str = Field(..., description="One of: blocker, major, minor.")
    file: str = Field(default="", description="Affected file path, if applicable.")
    line: int | None = Field(default=None, description="Affected line number, if known.")
    description: str = Field(..., description="What is wrong.")
    fix: str = Field(default="", description="How to resolve it.")


class QAReport(BaseModel):
    """QA agent output: pass/fail verdict with actionable issues."""

    passed: bool = Field(..., description="True when the code meets acceptance criteria.")
    issues: list[QAIssue] = Field(default_factory=list)
    summary: str = Field(default="", description="Short overall assessment.")

