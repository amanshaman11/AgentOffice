"""FastAPI server exposing planner, orchestrator, streaming, export, history, and metrics."""

from __future__ import annotations

import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .agents import Orchestrator, Planner
from .agents.orchestrator import OrchestrationResult
from .agents.planner import WorkflowSuggestion, plan_from_roster, suggest_workflow
from .agents.schemas import Plan
from .agents.streaming_orchestrator import StreamingOrchestrator
from .database import (
    get_agent_metrics_summary,
    get_research_by_id,
    get_research_history,
    save_agent_metric,
    save_research,
    search_similar_research,
)
from .metrics import MetricsSummary, get_metrics
from .pdf_generator import generate_research_pdf
from .research_history import ResearchHistory
from .supabase_client import is_supabase_configured, upload_pdf
from .websocket_manager import manager

load_dotenv()

app = FastAPI(title="AgentOffice API", version="2.0.0")

_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

_history = ResearchHistory()
_metrics = get_metrics()


class RunRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Research query or SaaS idea.")
    office_type: str = Field(default="research", description="Active office type.")
    agents: list[str] = Field(
        default_factory=list,
        description="Ordered roster of agent role IDs from the frontend office.",
    )
    use_cache: bool = Field(default=True, description="Use cached results if available")


class SuggestRequest(BaseModel):
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


def _resolve_plan(req: RunRequest, query: str) -> Plan:
    if req.agents:
        try:
            return plan_from_roster(query, req.agents)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Planner().create_plan(query)


async def _persist_result(query: str, result: OrchestrationResult, execution_time_ms: int) -> int | None:
    agent_results = {
        agent: output.success
        for agent, output in result.outputs.items()
    }

    _metrics.record_execution(
        query=query,
        goal=result.goal,
        success=result.success,
        execution_time_ms=execution_time_ms,
        agent_results=agent_results,
    )

    research_id = None
    pdf_url = None
    
    try:
        research_id = save_research(
            query=query,
            goal=result.goal,
            success=result.success,
            final_output=result.final_output,
            plan=result.plan.model_dump(),
            outputs={k: v.model_dump() for k, v in result.outputs.items()},
            log=result.log,
            execution_time_ms=execution_time_ms,
        )

        if result.success and is_supabase_configured() and research_id:
            try:
                pdf_data = generate_research_pdf(
                    query=query,
                    goal=result.goal,
                    final_output=result.final_output,
                    created_at=None,
                )
                
                import time
                file_path = f"research/{research_id}_{int(time.time())}.pdf"
                pdf_url = await upload_pdf(file_path, pdf_data)
                if pdf_url:
                    print(f"PDF uploaded to Supabase: {pdf_url}")
                else:
                    print("PDF upload skipped (storage bucket unavailable or empty)")
            except Exception as pdf_error:
                print(f"Warning: Failed to generate/upload PDF: {pdf_error}")
            
            await _history.save_research(
                query=query,
                goal=result.goal,
                success=result.success,
                final_output=result.final_output,
                execution_time_ms=execution_time_ms,
                pdf_url=pdf_url,
            )
    except Exception as error:
        print(f"Warning: Failed to save research: {error}")

    return research_id


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": "2.0.0",
        "gemini_key": "set" if os.getenv("GEMINI_API_KEY") else "missing",
        "supabase": "configured" if is_supabase_configured() else "not_configured",
        "uptime_seconds": _metrics.get_uptime_seconds(),
    }


@app.post("/api/plan", response_model=Plan)
def create_plan(req: RunRequest) -> Plan:
    _require_research(req.office_type)
    return _resolve_plan(req, _clean(req.query))


@app.post("/api/run", response_model=OrchestrationResult)
async def run(req: RunRequest) -> OrchestrationResult:
    _require_research(req.office_type)
    query = _clean(req.query)

    if req.use_cache and is_supabase_configured():
        cached = await _history.find_cached_result(query)
        if cached:
            return OrchestrationResult(
                goal=cached.goal,
                plan=Plan(goal=cached.goal, steps=[], fallback_rules=[]),
                success=cached.success,
                outputs={},
                final_output=cached.final_output,
                log=["Retrieved from cache."],
            )

    start_time = time.time()
    plan = _resolve_plan(req, query) if req.agents else None
    result = Orchestrator().run(query, plan=plan) if plan else Orchestrator().run(query)
    execution_time_ms = int((time.time() - start_time) * 1000)

    await _persist_result(query, result, execution_time_ms)
    return result


@app.post("/api/suggest-workflow", response_model=WorkflowSuggestion)
def suggest_workflow_endpoint(req: SuggestRequest) -> WorkflowSuggestion:
    _require_research(req.office_type)
    query = _clean(req.query)
    try:
        return suggest_workflow(query)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    await manager.connect(session_id, websocket)
    try:
        data = await websocket.receive_json()
        query = data.get("query", "").strip()

        if not query:
            await manager.send_error(session_id, "Query must not be empty")
            return

        start_time = time.time()
        orchestrator = StreamingOrchestrator()

        async def on_progress(step: int, total: int, agent: str, status: str, message: str):
            await manager.send_progress(session_id, step, total, agent, status, message)

        async def on_agent_complete(agent: str, output: str, success: bool):
            await manager.send_agent_output(session_id, agent, output, success)

        result, agent_metrics = await orchestrator.run_with_streaming(
            query,
            on_progress=on_progress,
            on_agent_complete=on_agent_complete,
        )

        execution_time_ms = int((time.time() - start_time) * 1000)

        research_id = None
        pdf_url = None
        try:
            research_id = save_research(
                query=query,
                goal=result.goal,
                success=result.success,
                final_output=result.final_output,
                plan=result.plan.model_dump(),
                outputs={k: v.model_dump() for k, v in result.outputs.items()},
                log=result.log,
                execution_time_ms=execution_time_ms,
            )

            for metric in agent_metrics:
                save_agent_metric(research_id=research_id, **metric)

            if result.success and is_supabase_configured() and research_id:
                try:
                    pdf_data = generate_research_pdf(
                        query=query,
                        goal=result.goal,
                        final_output=result.final_output,
                        created_at=None,
                    )
                    
                    file_path = f"research/{research_id}_{int(time.time())}.pdf"
                    pdf_url = await upload_pdf(file_path, pdf_data)
                    if pdf_url:
                        print(f"PDF uploaded to Supabase: {pdf_url}")
                    else:
                        print("PDF upload skipped (storage bucket unavailable or empty)")
                except Exception as pdf_error:
                    print(f"Warning: Failed to generate/upload PDF: {pdf_error}")
                
                await _history.save_research(
                    query=query,
                    goal=result.goal,
                    success=result.success,
                    final_output=result.final_output,
                    execution_time_ms=execution_time_ms,
                    pdf_url=pdf_url,
                )
        except Exception as error:
            print(f"Warning: Failed to save research: {error}")

        await manager.send_completion(session_id, result.success, result.final_output, research_id)

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as error:
        await manager.send_error(session_id, str(error))
    finally:
        manager.disconnect(session_id)


@app.get("/api/history")
def get_history_local(limit: int = 50) -> dict:
    try:
        history = get_research_history(limit)
        return {"success": True, "history": history, "source": "local"}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/api/history/cloud")
async def get_history_cloud(limit: int = 10) -> dict:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured")

    history = await _history.get_recent_history(limit=min(limit, 50))
    return {"success": True, "history": [h.model_dump() for h in history], "source": "cloud"}


@app.get("/api/research/{research_id}")
def get_research(research_id: int) -> dict:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Research not found")
    return research


@app.get("/api/search")
def search_research(q: str) -> dict:
    if not q or len(q.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query must be at least 3 characters")

    results = search_similar_research(q.strip())
    return {"success": True, "results": results}


@app.get("/api/metrics")
def get_metrics_endpoint(hours: int | None = None) -> MetricsSummary:
    return _metrics.get_summary(last_n_hours=hours)


@app.get("/api/metrics/agents")
def get_agent_metrics() -> dict:
    try:
        metrics = get_agent_metrics_summary()
        return {"success": True, "metrics": metrics}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/api/export/pdf/{research_id}")
async def export_pdf(research_id: int) -> Response:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Research not found")

    try:
        pdf_data = generate_research_pdf(
            query=research["query"],
            goal=research["goal"],
            final_output=research["final_output"],
            created_at=research.get("created_at"),
        )

        pdf_url = None
        if is_supabase_configured():
            file_path = f"research/{research_id}_{int(time.time())}.pdf"
            pdf_url = await upload_pdf(file_path, pdf_data)

        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=research_{research_id}.pdf",
                "X-PDF-URL": pdf_url if pdf_url else "",
            },
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {error}")
