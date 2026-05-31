"""OpenAI client for code-generation agents (Executor, Editor)."""

from __future__ import annotations

import os
import time
from functools import lru_cache
from typing import Type, TypeVar

from openai import APIError, APITimeoutError, OpenAI, RateLimitError
from pydantic import BaseModel

DEFAULT_CODE_MODEL = os.getenv("OPENAI_CODE_MODEL", "gpt-5.4-mini")
_MAX_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 1.5
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}

T = TypeVar("T", bound=BaseModel)


class OpenAIError(RuntimeError):
    """Raised when OpenAI generation fails after exhausting retries."""


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)


def _is_retryable(error: Exception) -> bool:
    if isinstance(error, (RateLimitError, APITimeoutError)):
        return True
    if isinstance(error, APIError):
        code = getattr(error, "status_code", None)
        return code in _RETRYABLE_STATUS
    return False


def generate_json(
    prompt: str,
    schema: Type[T],
    *,
    system_instruction: str | None = None,
    model: str | None = None,
) -> T:
    client = get_client()
    resolved_model = model or DEFAULT_CODE_MODEL
    messages: list[dict[str, str]] = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.beta.chat.completions.parse(
                model=resolved_model,
                messages=messages,
                response_format=schema,
            )
            parsed = response.choices[0].message.parsed
            if parsed is None:
                raise OpenAIError("OpenAI returned no parsed response.")
            return parsed
        except Exception as error:  # noqa: BLE001 - normalised into OpenAIError below
            last_error = error
            if attempt < _MAX_RETRIES - 1 and _is_retryable(error):
                time.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))
                continue
            break
    raise OpenAIError(f"OpenAI generation failed: {last_error}") from last_error
