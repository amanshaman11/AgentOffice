# AgentOffice Documentation

Complete technical reference for the AgentOffice backend, frontend integration, library, and deployment.

## Architecture

```
Frontend Roster → plan_from_roster() → Plan JSON → Orchestrator → Filter → Agents
                                                         ↓
                                 Validation + Re-routing + Retry Logic
                                                         ↓
                                             OrchestrationResult
```

Each agent slot in the office roster becomes one execution step in order. Results are keyed by step number so duplicate roles (e.g. two Searchers) each keep their own output.

### Office Types

**Research Office:** Searcher → Analyzer → Summarizer → Sender (optional)

**Developer Office:** Planner → Executor → QA

Deploy finished developer projects from the preview panel via Vercel (`POST /api/projects/{id}/deploy`).

## Setup

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Required in `.env`:

```env
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
OPENAI_CODE_MODEL=gpt-5.4-mini
FRONTEND_ORIGINS=http://localhost:3000
```

Optional:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
VERCEL_API_TOKEN=your_vercel_token
```

Create a Vercel token at https://vercel.com/account/tokens for one-click deploy.

Run the server:

```bash
uvicorn src.lib.server:app --reload --port 8000
```

### Frontend

```bash
cd frontend && npm install
```

Optional `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=your_anon_key
```

Start both:

```bash
npm run dev
```

## API Endpoints

### Core

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status, API keys, Supabase, uptime |
| POST | `/api/plan` | Generate execution plan |
| POST | `/api/run` | Run pipeline (supports `use_cache`) |
| POST | `/api/run/stream` | NDJSON streaming run |
| POST | `/api/suggest-workflow` | Gemini workflow suggestion |

### WebSocket

| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/{session_id}` | Real-time progress, agent output, completion |

Message types: `progress`, `agent_output`, `completion`, `error`.

### History

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/history` | Local SQLite history |
| GET | `/api/history/cloud` | Supabase cloud history |
| GET | `/api/research/{id}` | Single research record |
| GET | `/api/search?q=query` | Search similar research |

### Export

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export/pdf/{id}` | Download research PDF |
| GET | `/api/export/zip/{id}` | Download developer project zip |

### Developer Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/{id}` | Project files and metadata |
| POST | `/api/projects/{id}/edit` | Edit project via Editor agent |
| POST | `/api/projects/{id}/deploy` | Deploy to Vercel, returns live URL |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/metrics` | Overall performance summary |
| GET | `/api/metrics/agents` | Per-agent analytics |

## Research Agents

| Agent | Role |
|-------|------|
| Searcher | Collects credible sources; responds to analyzer feedback on retry |
| Analyzer | Reviews source quality; failure triggers re-route to Searcher |
| Summarizer | Produces concise research summary |
| Sender | Formats APA 7 / MLA citations and final deliverable (optional) |

## Developer Agents

| Agent | Role | Model |
|-------|------|-------|
| Planner | Converts ideas into development plans | Gemini |
| Executor | Generates project code | OpenAI |
| QA | Reviews code, requests fixes, static validation | Gemini |

QA failure re-routes to Executor (max 5 retries). Static code validation runs before LLM review.

## Plan-Then-Execute Flow

1. Plan from roster (`plan_from_roster`) or Planner (Gemini).
2. `get_next_step` selects the next runnable step.
3. Agent runs with query + prior context.
4. `validate_step` checks output; failures consult fallback rules.
5. On success, final output comes from the last meaningful step (sender/summarizer for research, executor for developer).

## WebSocket Streaming

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/session-123");
ws.onopen = () =>
  ws.send(JSON.stringify({
    query: "AI ethics",
    office_type: "research",
    agents: ["searcher", "analyzer", "summarizer"],
  }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // progress | agent_output | completion | error
};
```

## Research History and Caching

- **SQLite** (`data/agentoffice.db`) — always available, full records with plans and logs.
- **Supabase** — optional cloud backup and 24-hour query cache when `use_cache: true`.

Auto-caching on `/api/run` checks Supabase for recent matching queries before running agents.

## Export System

**Research:** PDF generated with ReportLab, uploaded to Supabase Storage when configured. Download via `/api/export/pdf/{id}`; `X-PDF-URL` header contains the storage URL.

**Developer:** Project files packaged as zip via `/api/export/zip/{id}`.

## Vercel Deploy

1. Set `VERCEL_API_TOKEN` in backend `.env`.
2. Open a developer project preview.
3. Click **Deploy** — backend uploads files to Vercel and returns the live URL.
4. Frontend opens the deployment in a new tab.

Project names are derived from the original query (e.g. `agentoffice-build-a-todo-list-app`).

## Library Feature

The Library sidebar lists past research and developer projects.

**Flow:**

1. User runs research → backend saves to SQLite.
2. If Supabase is configured, PDF (research) or zip (developer) uploads to storage.
3. Library fetches documents from local history and/or Supabase.
4. User can download PDFs, preview developer projects, or re-open the code workspace.

**Supabase setup:**

```sql
CREATE TABLE IF NOT EXISTS research_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  goal TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  final_output TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT
);

CREATE INDEX idx_query_hash ON research_history(query_hash);
CREATE INDEX idx_created_at ON research_history(created_at DESC);
```

Create a public storage bucket named `research-pdfs`.

## Performance Metrics

```bash
curl http://localhost:8000/api/metrics
```

Returns total executions, success rate, average execution time, and per-agent breakdown.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `OPENAI_API_KEY` | Yes (dev office) | OpenAI key for code generation |
| `OPENAI_CODE_MODEL` | No | Default `gpt-5.4-mini` |
| `GEMINI_MODEL` | No | Default `gemini-2.5-flash` |
| `FRONTEND_ORIGINS` | No | CORS origins |
| `SUPABASE_URL` | No | Cloud storage and cache |
| `SUPABASE_KEY` | No | Supabase anon key |
| `VERCEL_API_TOKEN` | No | One-click deploy |

## Project Structure

```
src/lib/agents/
├── orchestrator.py       # Plan-then-execute loop
├── planner.py            # Plans and workflow suggestions
├── filter.py             # Validation and retry routing
├── research/             # Research office agents
└── developer/            # Developer office agents

src/lib/
├── server.py             # FastAPI application
├── vercel_deploy.py      # Vercel deployment utility
├── code_validator.py     # Static code validation
└── database.py           # SQLite persistence

frontend/
├── components/shell/     # UI panels, chat, library, code workspace
└── lib/                  # API client, stores, preview helpers
```

## Troubleshooting

**Library empty:** Check Supabase credentials in frontend `.env.local` and that `research_history` has rows.

**PDF URL missing:** Only new successful runs upload PDFs; older records may lack URLs.

**Deploy shows raw text:** Ensure backend sends files with `"encoding": "utf-8"` (not base64 without encoding).

**Deploy tab blocked:** The deploy button opens a tab synchronously on click, then navigates it after the API responds.

**Developer QA loops:** Check activity log for static validation errors; Executor retries with precise feedback.
