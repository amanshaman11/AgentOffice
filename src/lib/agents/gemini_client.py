"""Thin wrapper around the google-genai SDK with structured-output helpers."""

from __future__ import annotations

import os
import time
from functools import lru_cache
from typing import Type, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
_MAX_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 1.5
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}

T = TypeVar("T", bound=BaseModel)


class GeminiError(RuntimeError):
    """Raised when content generation fails after exhausting retries."""


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """Return a process-wide :class:`genai.Client` built from ``GEMINI_API_KEY``."""

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY environment variable is not set.")
    return genai.Client(api_key=api_key)


def _is_retryable(error: Exception) -> bool:
    return isinstance(error, errors.APIError) and error.code in _RETRYABLE_STATUS


def _generate(config: types.GenerateContentConfig, prompt: str, model: str) -> str:
    client = get_client()
    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=model, contents=prompt, config=config
            )
            text = (response.text or "").strip()
            if not text:
                raise GeminiError("Gemini returned an empty response.")
            return text
        except Exception as error:  # noqa: BLE001 - normalised into GeminiError below
            last_error = error
            if attempt < _MAX_RETRIES - 1 and _is_retryable(error):
                time.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))
                continue
            break
    raise GeminiError(f"Gemini generation failed: {last_error}") from last_error


def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    model: str = DEFAULT_MODEL,
) -> str:
    """Generate free-form text for ``prompt``."""

    config = types.GenerateContentConfig(system_instruction=system_instruction)
    return _generate(config, prompt, model)


def generate_json(
    prompt: str,
    schema: Type[T],
    *,
    system_instruction: str | None = None,
    model: str = DEFAULT_MODEL,
) -> T:
    """Generate JSON constrained to ``schema`` and parse it into the Pydantic model."""

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=schema,
    )
    raw = _generate(config, prompt, model)
    try:
        return schema.model_validate_json(raw)
    except ValueError as error:
        raise GeminiError(f"Gemini returned invalid JSON for {schema.__name__}: {error}") from error
