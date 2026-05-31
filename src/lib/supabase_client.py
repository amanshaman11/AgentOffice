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


async def upload_pdf(file_path: str, pdf_data: bytes, bucket: str = "research-pdfs") -> str:
    """
    Upload PDF to Supabase Storage and return public URL.
    
    Args:
        file_path: Destination path in storage (e.g., 'research/report_123.pdf')
        pdf_data: PDF file content as bytes
        bucket: Storage bucket name
    
    Returns:
        Public URL to access the uploaded file
    
    Raises:
        SupabaseError: If upload fails
    """
    try:
        client = get_supabase_client()
        
        response = client.storage.from_(bucket).upload(
            file_path,
            pdf_data,
            file_options={"content-type": "application/pdf"}
        )
        
        if hasattr(response, 'error') and response.error:
            raise SupabaseError(f"Upload failed: {response.error}")
        
        public_url = client.storage.from_(bucket).get_public_url(file_path)
        return public_url
    
    except Exception as error:
        raise SupabaseError(f"Failed to upload PDF: {error}") from error


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
