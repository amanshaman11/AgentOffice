"""WebSocket manager for streaming research progress."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[session_id] = websocket
    
    def disconnect(self, session_id: str) -> None:
        self.active_connections.pop(session_id, None)
    
    async def send_message(self, session_id: str, message: dict[str, Any]) -> None:
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(session_id)
    
    async def send_progress(
        self,
        session_id: str,
        step: int,
        total_steps: int,
        agent: str,
        status: str,
        message: str,
    ) -> None:
        await self.send_message(
            session_id,
            {
                "type": "progress",
                "step": step,
                "total_steps": total_steps,
                "agent": agent,
                "status": status,
                "message": message,
            },
        )
    
    async def send_agent_output(
        self,
        session_id: str,
        agent: str,
        output: str,
        success: bool,
    ) -> None:
        await self.send_message(
            session_id,
            {
                "type": "agent_output",
                "agent": agent,
                "output": output,
                "success": success,
            },
        )
    
    async def send_completion(
        self,
        session_id: str,
        success: bool,
        final_output: str,
        research_id: int | None = None,
    ) -> None:
        await self.send_message(
            session_id,
            {
                "type": "completion",
                "success": success,
                "final_output": final_output,
                "research_id": research_id,
            },
        )
    
    async def send_error(self, session_id: str, error: str) -> None:
        await self.send_message(
            session_id,
            {
                "type": "error",
                "error": error,
            },
        )


manager = ConnectionManager()
