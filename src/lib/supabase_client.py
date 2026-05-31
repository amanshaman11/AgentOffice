"""Supabase client and storage utilities for AgentOffice."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import BinaryIO

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


class SupabaseError(RuntimeError):
    """Raised when Supabase operations fail."""


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return a process-wide Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        raise SupabaseError(
            "SUPABASE_URL and SUPABASE_KEY environment variables must be set."
        )
    
    return create_client(url, key)


def _is_bucket_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(
        token in message
        for token in ("bucket not found", "not found", "does not exist", "404")
    )


async def upload_pdf(
    file_path: str, pdf_data: bytes, bucket: str = "research-pdfs"
) -> str | None:
    """
    Upload PDF to Supabase Storage and return public URL.

    Returns None when the bucket is missing, empty, or upload otherwise fails.
    """
    if not is_supabase_configured():
        return None

    try:
        client = get_supabase_client()

        response = client.storage.from_(bucket).upload(
            file_path,
            pdf_data,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )

        if hasattr(response, "error") and response.error:
            print(f"Warning: PDF upload failed for bucket '{bucket}': {response.error}")
            return None

        return client.storage.from_(bucket).get_public_url(file_path)

    except Exception as error:
        if _is_bucket_error(error):
            print(f"Warning: Storage bucket '{bucket}' unavailable, skipping PDF upload")
        else:
            print(f"Warning: Failed to upload PDF: {error}")
        return None


async def delete_pdf(file_path: str, bucket: str = "research-pdfs") -> None:
    """Delete a PDF from Supabase Storage."""
    try:
        client = get_supabase_client()
        client.storage.from_(bucket).remove([file_path])
    except Exception as error:
        raise SupabaseError(f"Failed to delete PDF: {error}") from error


def is_supabase_configured() -> bool:
    """Check if Supabase credentials are configured."""
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"))
