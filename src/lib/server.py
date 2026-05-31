"""FastAPI server exposing planner, orchestrator, streaming, export, history, and metrics."""

from __future__ import annotations

import asyncio
import json
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from .agents import Orchestrator, make_planner
from .agents.developer import EditorAgent
from .agents.orchestrator import OrchestrationResult
from .code_validator import issues_to_feedback, validate_files
from .project_packager import extract_executor_files
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
    update_research_artifact_url,
)
from .metrics import MetricsSummary, get_metrics
from .pdf_generator import generate_research_pdf
from .project_packager import build_project_zip, extract_executor_files
from .research_history import ResearchHistory
from .supabase_client import is_supabase_configured, upload_pdf, upload_project_zip
from .vercel_deploy import VercelDeployError, deploy_to_vercel, project_name_from_query
from .websocket_manager import manager

_SUPPORTED_OFFICES = {"research", "developer"}

load_dotenv()

app = FastAPI(title="AgentOffice API", version="2.0.0")

_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
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


class RunResult(OrchestrationResult):
    research_id: int | None = None
    office_type: str = "research"
    artifact_url: str | None = None


def _clean(query: str) -> str:
    cleaned = query.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query must not be empty.")
    return cleaned


def _require_supported_office(office_type: str) -> None:
    if office_type not in _SUPPORTED_OFFICES:
        supported = ", ".join(sorted(_SUPPORTED_OFFICES))
        raise HTTPException(
            status_code=400,
            detail=f"Office type '{office_type}' is not supported. Available: {supported}.",
        )


def _resolve_plan(req: RunRequest, query: str) -> Plan:
    if req.agents:
        try:
            return plan_from_roster(query, req.agents, req.office_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return make_planner(req.office_type).create_plan(query)


async def _generate_and_upload_artifact(
    office_type: str,
    query: str,
    result: OrchestrationResult,
    identifier: int | str,
) -> str | None:
    """Build the office's artifact (PDF or project zip) and upload it to Supabase."""

    if not (result.success and is_supabase_configured()):
        return None
    try:
        if office_type == "developer":
            files = next(
                (
                    extract_executor_files(o.output)
                    for o in result.outputs.values()
                    if o.agent == "executor" and o.output
                ),
                [],
            )
            if not files:
                return None
            file_path = f"projects/{identifier}_{int(time.time())}.zip"
            url = await upload_project_zip(file_path, build_project_zip(files))
        else:
            pdf_data = generate_research_pdf(
                query=query,
                goal=result.goal,
                final_output=result.final_output,
                created_at=None,
            )
            file_path = f"research/{identifier}_{int(time.time())}.pdf"
            url = await upload_pdf(file_path, pdf_data)

        if url:
            print(f"Artifact uploaded to Supabase: {url}")
        else:
            print("Artifact upload skipped (storage bucket unavailable or empty)")
        return url
    except Exception as error:
        print(f"Warning: Failed to generate/upload artifact: {error}")
        return None


async def _persist_result(
    query: str,
    result: OrchestrationResult,
    execution_time_ms: int,
    office_type: str = "research",
) -> int | None:
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
            office_type=office_type,
        )

        if result.success and research_id:
            artifact_url = await _generate_and_upload_artifact(
                office_type, query, result, research_id
            )
            if artifact_url:
                update_research_artifact_url(research_id, artifact_url)
            if is_supabase_configured():
                await _history.save_research(
                    query=query,
                    goal=result.goal,
                    success=result.success,
                    final_output=result.final_output,
                    execution_time_ms=execution_time_ms,
                    pdf_url=artifact_url,
                )
    except Exception as error:
        print(f"Warning: Failed to save research: {error}")

    return research_id


async def _stream_orchestration_events(
    query: str,
    office_type: str,
    roster: list[str],
):
    events: asyncio.Queue[dict | None] = asyncio.Queue()

    async def on_progress(step: int, total: int, agent: str, status: str, message: str) -> None:
        await events.put(
            {
                "type": "progress",
                "step": step,
                "total_steps": total,
                "agent": agent,
                "status": status,
                "message": message,
            }
        )

    async def on_agent_complete(agent: str, output: str, success: bool) -> None:
        await events.put(
            {
                "type": "agent_output",
                "agent": agent,
                "output": output,
                "success": success,
            }
        )

    async def run_task() -> None:
        try:
            start_time = time.time()
            plan = plan_from_roster(query, roster, office_type) if roster else None
            orchestrator = StreamingOrchestrator(office_type=office_type)
            result, agent_metrics = await orchestrator.run_with_streaming(
                query,
                plan=plan,
                on_progress=on_progress,
                on_agent_complete=on_agent_complete,
            )
            execution_time_ms = int((time.time() - start_time) * 1000)
            research_id = await _persist_result(
                query, result, execution_time_ms, office_type=office_type
            )
            if research_id:
                for metric in agent_metrics:
                    save_agent_metric(research_id=research_id, **metric)
            await events.put(
                {
                    "type": "completion",
                    "success": result.success,
                    "final_output": result.final_output,
                    "research_id": research_id,
                }
            )
        except Exception as error:
            await events.put({"type": "error", "error": str(error)})
        finally:
            await events.put(None)

    task = asyncio.create_task(run_task())
    try:
        while True:
            item = await events.get()
            if item is None:
                break
            yield json.dumps(item) + "\n"
    finally:
        await task


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": "2.0.0",
        "gemini_key": "set" if os.getenv("GEMINI_API_KEY") else "missing",
        "openai_key": "set" if os.getenv("OPENAI_API_KEY") else "missing",
        "vercel_token": "set" if os.getenv("VERCEL_API_TOKEN") else "missing",
        "supabase": "configured" if is_supabase_configured() else "not_configured",
        "uptime_seconds": _metrics.get_uptime_seconds(),
    }


@app.post("/api/plan", response_model=Plan)
def create_plan(req: RunRequest) -> Plan:
    _require_supported_office(req.office_type)
    return _resolve_plan(req, _clean(req.query))


@app.post("/api/run", response_model=RunResult)
async def run(req: RunRequest) -> RunResult:
    _require_supported_office(req.office_type)
    query = _clean(req.query)

    if req.use_cache and req.office_type == "research" and is_supabase_configured():
        cached = await _history.find_cached_result(query)
        if cached:
            return RunResult(
                goal=cached.goal,
                plan=Plan(goal=cached.goal, steps=[], fallback_rules=[]),
                success=cached.success,
                outputs={},
                final_output=cached.final_output,
                log=["Retrieved from cache."],
                office_type=req.office_type,
            )

    start_time = time.time()
    plan = _resolve_plan(req, query) if req.agents else None
    orchestrator = Orchestrator(office_type=req.office_type)
    result = orchestrator.run(query, plan=plan) if plan else orchestrator.run(query)
    execution_time_ms = int((time.time() - start_time) * 1000)

    research_id = await _persist_result(
        query, result, execution_time_ms, office_type=req.office_type
    )
    artifact_url = None
    if research_id:
        row = get_research_by_id(research_id)
        if row:
            artifact_url = row.get("artifact_url")

    return RunResult(
        goal=result.goal,
        plan=result.plan,
        success=result.success,
        outputs=result.outputs,
        final_output=result.final_output,
        log=result.log,
        research_id=research_id,
        office_type=req.office_type,
        artifact_url=artifact_url,
    )


@app.post("/api/run/stream")
async def stream_run(req: RunRequest) -> StreamingResponse:
    _require_supported_office(req.office_type)
    query = _clean(req.query)

    async def generate():
        async for chunk in _stream_orchestration_events(query, req.office_type, req.agents):
            yield chunk

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/api/suggest-workflow", response_model=WorkflowSuggestion)
def suggest_workflow_endpoint(req: SuggestRequest) -> WorkflowSuggestion:
    _require_supported_office(req.office_type)
    query = _clean(req.query)
    try:
        return suggest_workflow(query, req.office_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    await manager.connect(session_id, websocket)
    try:
        data = await websocket.receive_json()
        query = data.get("query", "").strip()
        office_type = data.get("office_type", "research")
        if office_type not in _SUPPORTED_OFFICES:
            office_type = "research"

        if not query:
            await manager.send_error(session_id, "Query must not be empty")
            return

        start_time = time.time()
        roster = data.get("agents") or []
        plan = (
            plan_from_roster(query, roster, office_type) if roster else None
        )
        orchestrator = StreamingOrchestrator(office_type=office_type)

        async def on_progress(step: int, total: int, agent: str, status: str, message: str):
            await manager.send_progress(session_id, step, total, agent, status, message)

        async def on_agent_complete(agent: str, output: str, success: bool):
            await manager.send_agent_output(session_id, agent, output, success)

        result, agent_metrics = await orchestrator.run_with_streaming(
            query,
            plan=plan,
            on_progress=on_progress,
            on_agent_complete=on_agent_complete,
        )

        execution_time_ms = int((time.time() - start_time) * 1000)

        research_id = None
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
                office_type=office_type,
            )

            for metric in agent_metrics:
                save_agent_metric(research_id=research_id, **metric)

            if result.success and research_id:
                artifact_url = await _generate_and_upload_artifact(
                    office_type, query, result, research_id
                )
                if artifact_url:
                    update_research_artifact_url(research_id, artifact_url)
                if is_supabase_configured():
                    await _history.save_research(
                        query=query,
                        goal=result.goal,
                        success=result.success,
                        final_output=result.final_output,
                        execution_time_ms=execution_time_ms,
                        pdf_url=artifact_url,
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


@app.get("/api/export/zip/{research_id}")
async def export_zip(research_id: int) -> Response:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Project not found")

    files = []
    for output in research.get("outputs", {}).values():
        if isinstance(output, dict) and output.get("agent") == "executor":
            files = extract_executor_files(output.get("output") or "")
            if files:
                break

    if not files:
        raise HTTPException(status_code=404, detail="No generated files found for this run")

    zip_data = build_project_zip(files)
    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=project_{research_id}.zip",
        },
    )


@app.get("/api/projects/{research_id}")
def get_project(research_id: int) -> dict:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Project not found")

    files = []
    setup_instructions = ""
    for output in research.get("outputs", {}).values():
        if not isinstance(output, dict) or output.get("agent") != "executor":
            continue
        raw = output.get("output") or ""
        extracted = extract_executor_files(raw)
        if extracted:
            files = [
                {"path": f.path, "content": f.content, "language": f.language}
                for f in extracted
            ]
        try:
            from .agents.developer.schemas import ExecutorOutput

            parsed = ExecutorOutput.model_validate_json(raw)
            setup_instructions = parsed.setup_instructions
        except Exception:
            pass
        break

    return {
        "success": True,
        "research_id": research_id,
        "query": research["query"],
        "goal": research["goal"],
        "office_type": research.get("office_type", "research"),
        "artifact_url": research.get("artifact_url"),
        "files": files,
        "setup_instructions": setup_instructions,
    }


class EditRequest(BaseModel):
    instruction: str = Field(..., min_length=1)


@app.post("/api/projects/{research_id}/edit")
async def edit_project(research_id: int, body: EditRequest) -> dict:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Project not found")
    if research.get("office_type") != "developer":
        raise HTTPException(status_code=400, detail="Only developer projects support editing.")

    current_files: list[dict] = []
    for output in research.get("outputs", {}).values():
        if not isinstance(output, dict) or output.get("agent") != "executor":
            continue
        raw = output.get("output") or ""
        extracted = extract_executor_files(raw)
        if extracted:
            current_files = [
                {"path": f.path, "content": f.content, "language": f.language}
                for f in extracted
            ]
        break

    if not current_files:
        raise HTTPException(status_code=422, detail="No source files found for this project.")

    editor = EditorAgent()
    result = editor.run_edit(instruction=body.instruction, current_files=current_files)
    if not result.success:
        raise HTTPException(status_code=422, detail=result.feedback or "Editor failed.")

    from .agents.developer.schemas import ExecutorOutput

    updated_output = ExecutorOutput.model_validate_json(result.output)

    final_issues = validate_files(updated_output.files)
    hard_blockers = [i for i in final_issues if i.severity == "blocker"]
    if hard_blockers:
        raise HTTPException(
            status_code=422,
            detail=f"Edited project has unresolved issues:\n{issues_to_feedback(hard_blockers)}",
        )
    updated_files = [
        {"path": f.path, "content": f.content, "language": f.language}
        for f in updated_output.files
    ]

    import json as _json

    fake_outputs = {"executor": {"agent": "executor", "output": result.output}}
    new_id = save_research(
        query=research["query"],
        goal=f"{research['goal']} [edited: {body.instruction[:80]}]",
        success=True,
        final_output=result.output,
        plan={},
        outputs=fake_outputs,
        log=[],
        execution_time_ms=0,
        office_type="developer",
    )

    zip_data = build_project_zip(updated_output)
    artifact_url = None
    if is_supabase_configured():
        zip_path = f"projects/{new_id}_{int(time.time())}.zip"
        artifact_url = await upload_project_zip(zip_path, zip_data)
        if artifact_url:
            update_research_artifact_url(new_id, artifact_url)

    return {
        "success": True,
        "research_id": new_id,
        "files": updated_files,
        "setup_instructions": updated_output.setup_instructions,
        "artifact_url": artifact_url,
    }


@app.post("/api/projects/{research_id}/deploy")
async def deploy_project(research_id: int) -> dict:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Project not found")
    if research.get("office_type") != "developer":
        raise HTTPException(status_code=400, detail="Only developer projects can be deployed.")

    vercel_token = os.getenv("VERCEL_API_TOKEN", "").strip()
    if not vercel_token:
        raise HTTPException(
            status_code=503,
            detail="VERCEL_API_TOKEN is not configured on the backend.",
        )

    files = []
    for output in research.get("outputs", {}).values():
        if isinstance(output, dict) and output.get("agent") == "executor":
            files = extract_executor_files(output.get("output") or "")
            if files:
                break

    if not files:
        raise HTTPException(status_code=422, detail="No generated files found for this project.")

    project_name = project_name_from_query(research.get("query") or research.get("goal") or "project")
    try:
        result = await deploy_to_vercel(files, project_name, vercel_token)
    except VercelDeployError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "success": True,
        "deployment_url": result["deployment_url"],
        "deployment_id": result["deployment_id"],
        "project_name": result["project_name"],
    }


@app.get("/api/export/pdf/{research_id}")
async def export_pdf(research_id: int) -> Response:
    research = get_research_by_id(research_id)
    if not research:
        raise HTTPException(status_code=404, detail="Research not found")

    if research.get("office_type") == "developer":
        raise HTTPException(
            status_code=400,
            detail="Developer projects use /api/export/zip/{id}, not PDF export.",
        )

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
