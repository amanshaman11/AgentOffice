# AgentOffice Backend

Multi-agent research orchestrator with a roster-driven, plan-then-execute architecture.

## Architecture

```
Frontend Roster → plan_from_roster() → Plan JSON → Orchestrator → Filter → Agents
                                                         ↓
                                 Validation + Re-routing + Retry Logic
                                                         ↓
                                             OrchestrationResult
```

Each agent slot the user adds to the office roster becomes one execution step, ordered
exactly as the user arranged them. The result includes per-step outputs keyed by step
number so duplicate agents (e.g. two Searchers) each have their own result slot.

## Setup

### 1. Install Dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your Gemini API key:

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_actual_key_here
```

Get a Gemini API key from: https://ai.google.dev/

### 3. Run the Server

```bash
source .venv/bin/activate
uvicorn src.lib.server:app --reload --port 8000
```

Server runs at `http://localhost:8000`

## API Endpoints

### `GET /api/health`
Health check and Gemini key status.

**Response:**
```json
{
  "status": "ok",
  "gemini_key": "set"
}
```

### `POST /api/plan`
Generate an execution plan without running agents.

When `agents` is provided the plan is built directly from the roster (no Gemini call)
for instant, deterministic preview. When omitted the Planner generates one via Gemini.

**Request:**
```json
{
  "query": "Impact of AI on modern education",
  "office_type": "research",
  "agents": ["searcher", "analyzer", "summarizer"]
}
```

**Response:**
```json
{
  "goal": "Impact of AI on modern education",
  "steps": [
    {"step": 1, "agent": "searcher", "depends_on": [], "required": true},
    {"step": 2, "agent": "analyzer", "depends_on": [1], "required": true},
    {"step": 3, "agent": "summarizer", "depends_on": [2], "required": true}
  ],
  "fallback_rules": ["if analyzer fails, retry searcher max 2 times"]
}
```

### `POST /api/run`
Run the multi-agent pipeline. When `agents` is provided the roster drives execution;
each slot maps to exactly one step in the order given.

**Request:**
```json
{
  "query": "Impact of AI on modern education",
  "office_type": "research",
  "agents": ["searcher", "analyzer", "summarizer", "sender"]
}
```

**Response:**
```json
{
  "goal": "Impact of AI on modern education",
  "plan": { "..." },
  "success": true,
  "outputs": {
    "1": {"agent": "searcher", "success": true, "output": "...", "feedback": ""},
    "2": {"agent": "analyzer", "success": true, "output": "...", "feedback": ""},
    "3": {"agent": "summarizer", "success": true, "output": "...", "feedback": ""},
    "4": {"agent": "sender", "success": true, "output": "...", "feedback": ""}
  },
  "final_output": "... formatted deliverable with APA 7 and MLA citations ...",
  "log": [
    "Planned 4 steps for goal: Impact of AI on modern education",
    "Step 1 'searcher' succeeded.",
    "Step 2 'analyzer' succeeded.",
    "Step 3 'summarizer' succeeded.",
    "Step 4 'sender' succeeded."
  ]
}
```

Note: `outputs` keys are step numbers as strings (`"1"`, `"2"`, …), not role names.
This lets the same role appear multiple times (e.g. two Searchers) without collisions.

### `POST /api/suggest-workflow`
Ask Gemini to recommend an ordered agent workflow for a query. Never executes any agents.

**Request:**
```json
{
  "query": "Impact of AI on modern education",
  "office_type": "research"
}
```

**Response:**
```json
{
  "suggested_agents": ["searcher", "analyzer", "summarizer"],
  "rationale": "A searcher gathers current sources; the analyzer filters out low-quality ones; the summarizer produces the final write-up."
}
```

## Research Agents

### Searcher
Collects 5-8 credible sources (papers, books, articles). Responds to analyzer feedback on retry.

### Analyzer
Reviews source quality. Returns `success: false` + actionable feedback when sources are weak, triggering re-routing back to searcher (up to 2 retries per fallback rules).

### Summarizer
Produces a 250-400 word concise research summary from validated sources.

### Sender
Formats APA 7 and MLA citations and assembles the final deliverable.

## Roster-Driven Workflow

When the frontend sends `agents: ["searcher", "analyzer", "summarizer"]`, the backend
calls `plan_from_roster()` to build a linear plan without any Gemini call:

- Step N depends on step N-1 (linear chain).
- The last step is optional when its role is `sender`.
- A `fallback_rules` entry is added automatically when both `analyzer` and `searcher`
  are present, enabling the analyzer-fail → retry-searcher loop.

## Step-Keyed Outputs

Internally the orchestrator tracks results in `dict[int, AgentResult]` keyed by step
number. This allows the same role to appear in multiple roster slots (e.g. two Searchers)
without clobbering results.

`build_step_context()` in `filter.py` converts the step-keyed dict to a role-keyed
`dict[str, AgentResult]` for each agent's `context` argument. Each role maps to the
most recent completed output for that role among all prior steps.

The final `OrchestrationResult.outputs` exposes the step-keyed results as string keys
(`"1"`, `"2"`, …) in the JSON response.

## Plan-Then-Execute Flow

1. **Plan source**: `plan_from_roster()` when the roster is provided; Planner (Gemini)
   otherwise.

2. **Approval**: v1 auto-approves; hook exists for user confirmation.

3. **Execution Loop**:
   - `get_next_step`: Select next runnable step whose dependencies have succeeded.
   - `build_step_context`: Build role-keyed context from prior step outputs.
   - Run the agent with query + context.
   - `validate_step`: Check agent identity, success, output presence, dependencies.
   - On failure: consult `should_retry` + `fallback_rules` to re-route (e.g.,
     analyzer fail → retry the most recent prior searcher step).
   - Bounded by max attempts derived from fallback rules.

4. **Completion**: All required steps done → return `OrchestrationResult` with final
   deliverable taken from the last non-skipped sender or summarizer step.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Your Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `FRONTEND_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |

## Project Structure

```
src/lib/agents/
├── __init__.py           # Public API exports
├── base.py               # BaseAgent ABC
├── schemas.py            # Pydantic models (Plan, AgentResult, etc.)
├── gemini_client.py      # Gemini SDK wrapper with retry
├── planner.py            # Planner agent (query → Plan)
├── filter.py             # Validation, retry logic, step routing
├── orchestrator.py       # Plan-then-execute loop
└── research/
    ├── __init__.py
    ├── searcher.py
    ├── analyzer.py
    ├── summarizer.py
    └── sender.py

src/lib/
├── __init__.py
└── server.py             # FastAPI application
```

## Testing Locally (No Gemini)

```python
from src.lib.agents import Orchestrator, default_plan
from src.lib.agents.base import BaseAgent
from src.lib.agents.schemas import AgentResult

class MockAgent(BaseAgent):
    def __init__(self, name):
        super().__init__()
        self.name = name
    def _execute(self, query, context):
        return AgentResult(agent=self.name, success=True, output=f"mock {self.name}", feedback="")

class MockPlanner:
    def create_plan(self, query):
        return default_plan(query)

agents = {name: MockAgent(name) for name in ["searcher", "analyzer", "summarizer", "sender"]}
orch = Orchestrator(planner=MockPlanner(), agents=agents)
result = orch.run("Test query")
print(result.success, result.final_output)
```

## Available Research Agents

| Agent | Role |
|-------|------|
| `searcher` | Collects 5-8 credible sources. Responds to analyzer feedback on retry. |
| `analyzer` | Reviews source quality; returns `success: false` + actionable feedback when sources are weak, triggering a re-route back to searcher. |
| `summarizer` | Produces a 250-400 word concise research summary from validated sources. |
| `sender` | Formats APA 7 and MLA citations and assembles the final deliverable. |

## Validation Rules

| Scenario | Behaviour |
|----------|-----------|
| Empty `agents` list | Backend returns `400` — frontend blocks this before sending |
| Unknown agent role | Backend returns `400` with a clear error message |
| `office_type != "research"` | Backend returns `400` — Developer Office not yet supported |
| Analyzer fails | Fallback rule retries the most recent prior searcher step (max 2 times) |
| Optional step skipped | Marked with `[skipped: optional step]` in outputs; does not block success |

## Next Steps

- Add SaaS Developer Office agents (Planner, Executor, QA, Deployer, Marketing)
- User approval hook for plan confirmation
- Streaming responses for long-running orchestration
