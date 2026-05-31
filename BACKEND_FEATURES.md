# AgentOffice Backend Features v2.0

## Overview

Your backend now includes **4 major features**:

1. **WebSocket Streaming** - Real-time progress updates
2. **Research History & Caching** - SQLite + Supabase storage
3. **Export System** - PDF generation + Email delivery
4. **Performance Metrics** - Agent analytics dashboard

---

## 1. WebSocket Streaming

### Real-Time Progress Updates

Connect to WebSocket endpoint to receive live updates as agents work.

**Endpoint:** `ws://localhost:8000/ws/{session_id}`

**Example Client (JavaScript):**

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/unique-session-id');

ws.onopen = () => {
  ws.send(JSON.stringify({ query: "cybersecurity best practices" }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'progress':
      console.log(`Step ${message.step}/${message.total_steps}: ${message.message}`);
      break;
    case 'agent_output':
      console.log(`${message.agent} completed:`, message.output);
      break;
    case 'completion':
      console.log('Research complete!', message.final_output);
      console.log('Research ID:', message.research_id);
      break;
    case 'error':
      console.error('Error:', message.error);
      break;
  }
};
```

**Message Types:**

- `progress` - Agent status updates
- `agent_output` - Agent completion output
- `completion` - Final research result
- `error` - Error messages

---

## 2. Research History & Caching

### Dual Storage System

- **SQLite** - Local database (always available)
- **Supabase** - Cloud storage (optional, for caching)

### Endpoints

#### Get Local History
```bash
GET /api/history?limit=50
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "query": "cybersecurity best practices",
      "goal": "...",
      "success": true,
      "final_output": "...",
      "created_at": "2026-05-30T20:00:00",
      "execution_time_ms": 35000
    }
  ],
  "source": "local"
}
```

#### Get Cloud History (Supabase)
```bash
GET /api/history/cloud?limit=10
```

#### Get Specific Research
```bash
GET /api/research/{research_id}
```

#### Search Similar Research
```bash
GET /api/search?q=cybersecurity
```

### Auto-Caching

When `use_cache: true` in `/api/run`:
- Checks Supabase for cached results (24-hour TTL)
- Returns cached result instantly if found
- Executes fresh research if not found

---

## 3. Export System

### PDF Generation + Email Delivery + Supabase Storage

#### Download PDF
```bash
GET /api/export/pdf/{research_id}
```

**Returns:** PDF file download

**Features:**
- Professional formatting with ReportLab
- APA 7 and MLA citations included
- Automatically uploaded to Supabase Storage

#### Email Report
```bash
POST /api/export/email
Content-Type: application/json

{
  "research_id": 1,
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Research report sent to user@example.com",
  "pdf_url": "https://your-project.supabase.co/storage/v1/object/public/research-pdfs/..."
}
```

**Email Setup:**

Update `.env` with your SMTP credentials:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=AgentOffice Research
```

**Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Create App Password for "Mail"
4. Use that password in `SMTP_PASSWORD`

---

## 4. Performance Metrics

### Real-Time Analytics Dashboard

#### Get Overall Metrics
```bash
GET /api/metrics?hours=24
```

**Response:**
```json
{
  "total_executions": 15,
  "successful_executions": 14,
  "failed_executions": 1,
  "success_rate": 93.33,
  "average_execution_time_ms": 32500.50,
  "total_execution_time_ms": 487507,
  "agent_metrics": {
    "searcher": {
      "total_executions": 15,
      "successes": 14,
      "failures": 1,
      "success_rate": 93.33,
      "average_time_ms": 8125.12
    },
    "analyzer": {
      "total_executions": 14,
      "successes": 14,
      "failures": 0,
      "success_rate": 100.0,
      "average_time_ms": 5234.67
    }
  },
  "recent_executions": [...]
}
```

#### Get Agent-Specific Metrics
```bash
GET /api/metrics/agents
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "agents": {
      "searcher": {
        "total_runs": 20,
        "successful_runs": 18,
        "success_rate": 0.9,
        "avg_time_ms": 8500.5,
        "min_time_ms": 6000,
        "max_time_ms": 12000
      }
    },
    "overall": {
      "total_research": 20,
      "successful_research": 18,
      "avg_time_ms": 35000.0
    }
  }
}
```

---

## Database Schema

### SQLite (`data/agentoffice.db`)

**Tables:**

1. **research_history**
   - `id` - Primary key
   - `query` - User query
   - `goal` - Research goal
   - `success` - Boolean
   - `final_output` - Research result
   - `plan_json` - Execution plan
   - `outputs_json` - Agent outputs
   - `log_json` - Execution log
   - `created_at` - Timestamp
   - `execution_time_ms` - Duration

2. **agent_metrics**
   - `id` - Primary key
   - `research_id` - Foreign key
   - `agent_name` - Agent name
   - `success` - Boolean
   - `execution_time_ms` - Duration
   - `attempt_number` - Retry count
   - `error_message` - Error details
   - `created_at` - Timestamp

---

## Supabase Setup (Optional)

### 1. Create Supabase Project

Visit: https://supabase.com

### 2. Create Storage Bucket

```sql
-- In Supabase SQL Editor
CREATE TABLE research_history (
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

### 3. Create Storage Bucket

1. Go to Storage → Create bucket
2. Name: `research-pdfs`
3. Set to **Public** (for PDF downloads)

### 4. Update `.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
```

---

## API Health Check

```bash
curl http://localhost:8000/api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "gemini_key": "set",
  "supabase": "configured",
  "email": "configured",
  "uptime_seconds": 3600
}
```

---

## Testing the Features

### 1. Test WebSocket Streaming

```javascript
// Your frontend can connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/test-123');
ws.onopen = () => ws.send(JSON.stringify({ query: "AI in education" }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### 2. Test History & Caching

```bash
# Run research
curl -X POST http://localhost:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{"query": "blockchain technology", "use_cache": true}'

# Get history
curl http://localhost:8000/api/history

# Search similar
curl "http://localhost:8000/api/search?q=blockchain"
```

### 3. Test PDF Export

```bash
# Get research ID from history, then:
curl http://localhost:8000/api/export/pdf/1 --output research.pdf
```

### 4. Test Email

```bash
curl -X POST http://localhost:8000/api/export/email \
  -H "Content-Type: application/json" \
  -d '{"research_id": 1, "email": "your@email.com"}'
```

### 5. Test Metrics

```bash
# Overall metrics
curl http://localhost:8000/api/metrics

# Last 24 hours
curl "http://localhost:8000/api/metrics?hours=24"

# Agent-specific
curl http://localhost:8000/api/metrics/agents
```

---

## Architecture

```
User Request
    ↓
FastAPI Server (port 8000)
    ↓
┌─────────────┬──────────────┬──────────────┬────────────┐
│   Planner   │ Orchestrator │  Streaming   │  Metrics   │
└─────────────┴──────────────┴──────────────┴────────────┘
         ↓             ↓              ↓            ↓
    ┌────────────────────────────────────────────────┐
    │  Research Agents (Searcher, Analyzer, etc.)    │
    └────────────────────────────────────────────────┘
                       ↓
    ┌─────────────────┬──────────────┬───────────────┐
    │  SQLite DB      │  Supabase    │  Email SMTP   │
    │  (Local)        │  (Cloud)     │  (Gmail)      │
    └─────────────────┴──────────────┴───────────────┘
```

---

## Production Deployment Tips

1. **Database Backups:** Backup `data/agentoffice.db` regularly
2. **Rate Limiting:** Add rate limiting to prevent abuse
3. **Authentication:** Implement API keys for production
4. **CORS:** Update `FRONTEND_ORIGINS` for your domain
5. **Error Monitoring:** Add Sentry or similar
6. **Caching:** Configure Redis for better performance

---

## What Your Friend Needs (Frontend Integration)

### Endpoints to Use:

1. **WebSocket Streaming:**
   - `ws://localhost:8000/ws/{sessionId}`
   - Show live progress as agents work

2. **Regular API:**
   - `POST /api/run` - Execute research
   - `GET /api/history` - Show past research
   - `GET /api/metrics` - Display analytics
   - `GET /api/export/pdf/{id}` - Download PDF
   - `POST /api/export/email` - Email report

3. **UI Components Needed:**
   - Progress bar with agent names
   - History list with search
   - Metrics dashboard
   - Export buttons (PDF/Email)

---

## Questions?

Check `/api/health` to verify all services are configured correctly.

All features work independently - you can use them individually without configuring everything at once!
