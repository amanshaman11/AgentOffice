"""FastAPI bridge exposing the AgentOffice planner and orchestrator to the frontend."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agents import Orchestrator, Planner
from .agents.orchestrator import OrchestrationResult
from .agents.planner import WorkflowSuggestion, plan_from_roster, suggest_workflow
from .agents.schemas import Plan

load_dotenv()

app = FastAPI(title="AgentOffice API", version="0.2.0")

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
    office_type: str = Field(default="research", description="Active office type.")
    agents: list[str] = Field(
        default_factory=list,
        description="Ordered roster of agent role IDs from the frontend office.",
    )


class SuggestRequest(BaseModel):
    """Input for workflow suggestions — does not execute any agents."""

    query: str = Field(..., min_length=1, description="Research query.")
    office_type: str = Field(default="research")


def _clean(query: str) -> str:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query must not be empty.")
    return cleaned


def _require_research(office_type: str) -> None:
    if office_type != "research":
        raise HTTPException(
            status_code=400,
            detail=f"Office type '{office_type}' is not supported yet. Only 'research' is available.",
        )


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe and Gemini key presence check."""

    return {
        "status": "ok",
        "gemini_key": "set" if os.getenv("GEMINI_API_KEY") else "missing",
    }


@app.post("/api/plan", response_model=Plan)
def create_plan(req: RunRequest) -> Plan:
    """Return the execution plan without running any agents.

    If ``agents`` is provided the plan is built directly from the roster (no
    Gemini call). Otherwise the Planner generates one from the query.
    """

    _require_research(req.office_type)
    query = _clean(req.query)

    if req.agents:
        try:
            return plan_from_roster(query, req.agents)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Planner().create_plan(query)


@app.post("/api/run", response_model=OrchestrationResult)
def run(req: RunRequest) -> OrchestrationResult:
    """Plan and execute the multi-agent pipeline for a query.

    If ``agents`` is provided the roster defines the workflow — each slot becomes
    one execution step. Otherwise the Planner generates the plan automatically.
    """

    _require_research(req.office_type)
    query = _clean(req.query)

    if req.agents:
        try:
            roster_plan = plan_from_roster(query, req.agents)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return Orchestrator().run(query, plan=roster_plan)

    return Orchestrator().run(query)


@app.post("/api/suggest-workflow", response_model=WorkflowSuggestion)
def suggest_workflow_endpoint(req: SuggestRequest) -> WorkflowSuggestion:
    """Ask Gemini to recommend a workflow for the query. Does not run any agents."""

    _require_research(req.office_type)
    query = _clean(req.query)
    try:
        return suggest_workflow(query)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
