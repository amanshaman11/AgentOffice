"""Research history storage and caching with Supabase."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from .supabase_client import SupabaseError, get_supabase_client, is_supabase_configured


class ResearchRecord(BaseModel):
    """Stored research result."""
    
    id: str
    query: str
    query_hash: str
    goal: str
    success: bool
    final_output: str
    execution_time_ms: int
    created_at: str
    expires_at: str | None = None
    pdf_url: str | None = None


class ResearchHistory:
    """Manages research history storage and caching with Supabase."""
    
    def __init__(self, cache_ttl_hours: int = 24):
        self.cache_ttl_hours = cache_ttl_hours
        self.table_name = "research_history"
    
    @staticmethod
    def _hash_query(query: str) -> str:
        """Generate a hash for query deduplication."""
        normalized = query.lower().strip()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
    
    async def save_research(
        self,
        query: str,
        goal: str,
        success: bool,
        final_output: str,
        execution_time_ms: int,
        pdf_url: str | None = None,
    ) -> str:
        """
        Save research result to Supabase.
        
        Returns:
            Record ID
        """
        if not is_supabase_configured():
            return ""
        
        try:
            client = get_supabase_client()
            
            now = datetime.utcnow()
            expires_at = now + timedelta(hours=self.cache_ttl_hours)
            
            record = {
                "query": query,
                "query_hash": self._hash_query(query),
                "goal": goal,
                "success": success,
                "final_output": final_output,
                "execution_time_ms": execution_time_ms,
                "created_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "pdf_url": pdf_url,
            }
            
            response = client.table(self.table_name).insert(record).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0].get("id", "")
            
            return ""
        
        except Exception as error:
            print(f"Warning: Failed to save research to history: {error}")
            return ""
    
    async def find_cached_result(self, query: str) -> ResearchRecord | None:
        """
        Find cached research result for similar query.
        
        Returns:
            Cached result if found and not expired, otherwise None
        """
        if not is_supabase_configured():
            return None
        
        try:
            client = get_supabase_client()
            query_hash = self._hash_query(query)
            now = datetime.utcnow().isoformat()
            
            response = (
                client.table(self.table_name)
                .select("*")
                .eq("query_hash", query_hash)
                .eq("success", True)
                .gt("expires_at", now)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return ResearchRecord(**response.data[0])
            
            return None
        
        except Exception as error:
            print(f"Warning: Failed to query cache: {error}")
            return None
    
    async def get_recent_history(self, limit: int = 10) -> list[ResearchRecord]:
        """Get recent research history."""
        if not is_supabase_configured():
            return []
        
        try:
            client = get_supabase_client()
            
            response = (
                client.table(self.table_name)
                .select("*")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            
            if response.data:
                return [ResearchRecord(**record) for record in response.data]
            
            return []
        
        except Exception as error:
            print(f"Warning: Failed to get history: {error}")
            return []
    
    async def cleanup_expired(self) -> int:
        """Delete expired cache entries. Returns count of deleted records."""
        if not is_supabase_configured():
            return 0
        
        try:
            client = get_supabase_client()
            now = datetime.utcnow().isoformat()
            
            response = (
                client.table(self.table_name)
                .delete()
                .lt("expires_at", now)
                .execute()
            )
            
            return len(response.data) if response.data else 0
        
        except Exception as error:
            print(f"Warning: Failed to cleanup expired records: {error}")
            return 0
