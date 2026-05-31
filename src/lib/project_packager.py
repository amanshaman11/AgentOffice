"""Package generated project files into an in-memory zip archive."""

from __future__ import annotations

import io
import json
import zipfile

from .agents.developer.schemas import CodeFile, ExecutorOutput


def build_project_zip(files: list[CodeFile]) -> bytes:
    """Zip the given code files into a single archive and return its bytes."""

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.writestr(file.path, file.content)
    return buffer.getvalue()


def extract_executor_files(executor_output: str) -> list[CodeFile]:
    """Parse an Executor ``AgentResult.output`` JSON string into ``CodeFile`` objects."""

    if not executor_output:
        return []
    try:
        return ExecutorOutput.model_validate_json(executor_output).files
    except (ValueError, json.JSONDecodeError):
        return []
