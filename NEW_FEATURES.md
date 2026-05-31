# AgentOffice Backend - New Features Guide

## Overview

Your backend now includes 4 powerful new features:
1. **WebSocket Streaming** - Real-time progress updates
2. **Research History & Smart Caching** - Save and reuse research
3. **PDF Export & Email Delivery** - Professional reports
4. **Performance Metrics Dashboard** - Analytics and monitoring

## Setup Instructions

### 1. Install Dependencies

Already done! But if you need to reinstall:

```bash
cd /Users/amannurm/Documents/AgentOffice
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Supabase (Required for History & PDF Storage)

1. Go to [https://supabase.com](https://supabase.com) and create a project
2. Create a storage bucket called `research-pdfs` (make it public)
3. Create a table called `research_history` with this SQL:

```sql
CREATE TABLE research_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  goal TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  final_output TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT
);

CREATE INDEX idx_query_hash ON research_history(query_hash);
CREATE INDEX idx_expires_at ON research_history(expires_at);
```

4. Add to your `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
```

### 3. Configure Email (Required for Email Delivery)

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Add to `.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM_EMAIL=your.email@gmail.com
SMTP_FROM_NAME=AgentOffice Research
```

For other email providers, update `SMTP_HOST` and `SMTP_PORT` accordingly.

## API Endpoints

### Health Check
```bash
GET /api/health
```

Returns system status including Supabase and email configuration.

**Response:**
```json
{
  "status": "ok",
  "gemini_key": "set",
  "supabase": "configured",
  "email": "configured",
  "uptime_seconds": 3600
}
```

---

### Run Research (with Caching)
```bash
POST /api/run
Content-Type: application/json

{
  "query": "cybersecurity best practices",
  "use_cache": true
}
```

**Features:**
- Automatically checks cache for similar queries
- Returns cached result if found (instant response)
- Saves successful research for future reuse
- Records performance metrics

**Response:** Same as before, plus `"Retrieved from cache."` in log if cached.

---

### Export Research (PDF + Email)
```bash
POST /api/export
Content-Type: application/json

{
  "query": "cybersecurity best practices",
  "email": "user@example.com",
  "generate_pdf": true
}
```

**Features:**
- Generates professionally formatted PDF
- Uploads PDF to Supabase Storage (if configured)
- Sends email with PDF attachment (if email provided)

**Response:**
```json
{
  "success": true,
  "pdf_url": "https://your-project.supabase.co/storage/v1/object/public/research-pdfs/research/...",
  "email_sent": true
}
```

---

### Get Research History
```bash
GET /api/history?limit=10
```

Returns recent research with cached results.

**Response:**
```json
[
  {
    "id": "uuid",
    "query": "cybersecurity best practices",
    "query_hash": "abc123",
    "goal": "...",
    "success": true,
    "final_output": "...",
    "execution_time_ms": 35000,
    "created_at": "2026-05-30T...",
    "expires_at": "2026-05-31T...",
    "pdf_url": "https://..."
  }
]
```

---

### Performance Metrics
```bash
GET /api/metrics?hours=24
```

Get analytics for the last N hours (optional, defaults to all time).

**Response:**
```json
{
  "total_executions": 42,
  "successful_executions": 40,
  "failed_executions": 2,
  "success_rate": 95.24,
  "average_execution_time_ms": 35500.5,
  "total_execution_time_ms": 1491021,
  "agent_metrics": {
    "searcher": {
      "total_executions": 42,
      "successes": 40,
      "failures": 2,
      "success_rate": 95.24,
      "average_time_ms": 8500.0
    },
    "analyzer": {...},
    "summarizer": {...},
    "sender": {...}
  },
  "recent_executions": [...]
}
```

---

### Download PDF
```bash
GET /api/export/pdf/{query_hash}
```

Download PDF for a specific research (query_hash from history).

---

### WebSocket Streaming (Real-Time Progress)
```javascript
const ws = new WebSocket('ws://localhost:8000/api/stream');

ws.onopen = () => {
  ws.send(JSON.stringify({
    query: "cybersecurity best practices"
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'status':
      console.log('Status:', message.data.message);
      break;
    case 'plan':
      console.log('Plan created:', message.data.steps, 'steps');
      break;
    case 'log':
      console.log('Log:', message.data.message);
      break;
    case 'complete':
      console.log('Complete!', message.data.final_output);
      break;
    case 'error':
      console.error('Error:', message.data.message);
      break;
  }
};
```

**Message Types:**
- `status` - Progress updates
- `plan` - Planning phase complete
- `log` - Agent execution logs (streamed in real-time)
- `complete` - Final result with output
- `error` - Error occurred

---

## Features in Detail

### 1. Smart Caching

**How it works:**
- Normalizes queries (lowercase, trimmed)
- Generates SHA256 hash for deduplication
- Checks Supabase for matching hash
- Returns cached result if not expired (24-hour TTL)

**Benefits:**
- Instant responses for repeated queries
- Saves Gemini API costs
- Reduces server load

### 2. Research History

**Automatic tracking:**
- Every successful research is saved
- Query, goal, outputs, execution time
- Optional PDF URL
- Expires after 24 hours (configurable)

**Query capabilities:**
- Get recent history
- Search by query hash
- Filter by success/failure
- Automatic cleanup of expired entries

### 3. PDF Export

**Professional formatting:**
- Title page with query and timestamp
- Properly formatted sections
- Citation blocks (APA 7 & MLA)
- Generated with ReportLab

**Storage:**
- Uploads to Supabase Storage
- Public URLs for sharing
- Organized by date and query hash

### 4. Email Delivery

**Features:**
- Plain text or HTML emails
- PDF attachment support
- Configurable sender name
- SMTP with TLS encryption

**Supported providers:**
- Gmail (with App Passwords)
- Outlook/Office 365
- Any SMTP server

### 5. Performance Metrics

**Tracked metrics:**
- Total/successful/failed executions
- Success rates per agent
- Average execution times
- Recent execution history

**Use cases:**
- Monitor system health
- Identify failing agents
- Optimize performance
- Show stats in frontend

### 6. WebSocket Streaming

**Real-time updates:**
- Planning phase progress
- Step-by-step agent logs
- Live execution status
- Final results

**Frontend integration:**
- Show progress bars
- Display agent activity
- Better UX (no 40s wait)
- Users see AI "thinking"

---

## Testing the New Features

### Test Caching
```bash
# First request (slow)
time curl -X POST http://localhost:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{"query": "AI ethics", "use_cache": true}'

# Second request (instant from cache)
time curl -X POST http://localhost:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{"query": "AI ethics", "use_cache": true}'
```

### Test PDF Export
```bash
curl -X POST http://localhost:8000/api/export \
  -H "Content-Type: application/json" \
  -d '{"query": "AI ethics", "generate_pdf": true}' | jq
```

### Test Email
```bash
curl -X POST http://localhost:8000/api/export \
  -H "Content-Type: application/json" \
  -d '{"query": "AI ethics", "email": "your@email.com", "generate_pdf": true}' | jq
```

### Test History
```bash
curl -s http://localhost:8000/api/history | jq
```

### Test Metrics
```bash
curl -s http://localhost:8000/api/metrics | jq
```

---

## Frontend Integration Examples

### Using WebSocket Streaming

```typescript
// frontend/lib/useResearchStream.ts
import { useState, useEffect } from 'react';

export function useResearchStream(query: string) {
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/stream');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ query }));
    };
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'status') setStatus(msg.data.message);
      if (msg.type === 'log') setLogs(prev => [...prev, msg.data.message]);
      if (msg.type === 'complete') setResult(msg.data);
    };
    
    return () => ws.close();
  }, [query]);
  
  return { status, logs, result };
}
```

### Fetching History

```typescript
// frontend/lib/api.ts
export async function getResearchHistory(limit = 10) {
  const response = await fetch(`http://localhost:8000/api/history?limit=${limit}`);
  return response.json();
}
```

### Exporting with Email

```typescript
export async function exportResearch(query: string, email?: string) {
  const response = await fetch('http://localhost:8000/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      email,
      generate_pdf: true
    })
  });
  return response.json();
}
```

---

## Environment Variables Summary

```bash
# Gemini (Required)
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

# Frontend
FRONTEND_ORIGINS=http://localhost:3000

# Supabase (Optional, for history & PDF storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here

# Email (Optional, for email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM_EMAIL=your.email@gmail.com
SMTP_FROM_NAME=AgentOffice Research
```

---

## What's Next?

Your backend is now **production-ready** with:
- ✅ Real-time streaming
- ✅ Smart caching
- ✅ Professional PDF exports
- ✅ Email delivery
- ✅ Research history
- ✅ Performance analytics

**Tell your friend (frontend dev):**
- WebSocket endpoint is ready at `ws://localhost:8000/api/stream`
- They can show live progress instead of a loading spinner
- History endpoint provides past research
- Export endpoint handles PDF generation

Enjoy building! 🚀
