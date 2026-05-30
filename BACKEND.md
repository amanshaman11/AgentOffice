# AgentOffice Backend

Multi-agent research orchestrator with plan-then-execute architecture.

## Architecture

```
User Query → Planner (Gemini) → Plan JSON → Orchestrator → Filter → Agents
                                                ↓
                        Validation + Re-routing + Retry Logic
                                                ↓
                                    OrchestrationResult
```

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

**Request:**
```json
{
  "query": "Impact of AI on modern education"
}
```

**Response:**
```json
{
  "goal": "Impact of AI on modern education",
  "steps": [
    {"step": 1, "agent": "searcher", "depends_on": [], "required": true},
    {"step": 2, "agent": "analyzer", "depends_on": [1], "required": true},
    {"step": 3, "agent": "summarizer", "depends_on": [2], "required": true},
    {"step": 4, "agent": "sender", "depends_on": [3], "required": false}
  ],
  "fallback_rules": ["if analyzer fails, retry searcher max 2 times"]
}
```

### `POST /api/run`
Run the full multi-agent pipeline.

**Request:**
```json
{
  "query": "Impact of AI on modern education"
}
```

**Response:**
```json
{
  "goal": "Impact of AI on modern education",
  "plan": { ... },
  "success": true,
  "outputs": {
    "searcher": {"agent": "searcher", "success": true, "output": "...", "feedback": ""},
    "analyzer": {"agent": "analyzer", "success": true, "output": "...", "feedback": ""},
    "summarizer": {"agent": "summarizer", "success": true, "output": "...", "feedback": ""},
    "sender": {"agent": "sender", "success": true, "output": "...", "feedback": ""}
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

## Research Agents

### Searcher
Collects 5-8 credible sources (papers, books, articles). Responds to analyzer feedback on retry.

### Analyzer
Reviews source quality. Returns `success: false` + actionable feedback when sources are weak, triggering re-routing back to searcher (up to 2 retries per fallback rules).

### Summarizer
Produces a 250-400 word concise research summary from validated sources.

### Sender
Formats APA 7 and MLA citations and assembles the final deliverable.

## Plan-Then-Execute Flow

1. **Planning**: Planner agent calls Gemini with structured output to generate a `Plan` (or falls back to the default Research Office plan).

2. **Approval**: (v1 auto-approves; hook exists for user confirmation).

3. **Execution Loop**:
   - `get_next_step`: Select next runnable step whose dependencies succeeded.
   - Run the agent with query + context (previous outputs).
   - `validate_step`: Check agent identity, success, output presence, dependencies.
   - On failure: consult `should_retry` + `fallback_rules` to re-route (e.g., analyzer fail → retry searcher).
   - Bounded by max attempts derived from fallback rules.

4. **Completion**: All required steps done → return `OrchestrationResult` with final deliverable.

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

## Next Steps

- Frontend integration (your friend's part)
- Add SaaS Developer Office agents (Planner, Executor, QA, Deployer, Marketing)
- User approval hook for plan confirmation
- Streaming responses for long-running orchestration
