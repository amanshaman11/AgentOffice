"""FastAPI bridge exposing the AgentOffice planner and orchestrator to the frontend."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agents import Orchestrator, Planner
from .agents.orchestrator import OrchestrationResult
from .agents.schemas import Plan

load_dotenv()

app = FastAPI(title="AgentOffice API", version="0.1.0")

_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    """User input that drives a planning or execution request."""

    query: str = Field(..., min_length=1, description="Research query or SaaS idea.")


def _clean(query: str) -> str:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query must not be empty.")
    return cleaned


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe and Gemini key presence check."""

    return {
        "status": "ok",
        "gemini_key": "set" if os.getenv("GEMINI_API_KEY") else "missing",
    }


@app.post("/api/plan", response_model=Plan)
def create_plan(req: RunRequest) -> Plan:
    """Return the execution plan for a query without running the agents."""

    return Planner().create_plan(_clean(req.query))


@app.post("/api/run", response_model=OrchestrationResult)
def run(req: RunRequest) -> OrchestrationResult:
    """Plan and execute the full multi-agent pipeline for a query."""

    return Orchestrator().run(_clean(req.query))
