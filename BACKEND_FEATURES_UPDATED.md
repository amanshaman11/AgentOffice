# Backend Features v2.0 (No Email)

## ✅ Completed Features

Your backend now includes **3 major features**:

1. **WebSocket Streaming** - Real-time progress updates
2. **Research History & Caching** - SQLite + Supabase storage
3. **Export System** - PDF generation + Supabase Storage

---

## 1. WebSocket Streaming ⚡

### Real-Time Progress Updates

**Endpoint:** `ws://localhost:8000/ws/{session_id}`

Users see live updates as each agent works.

**Message Types:**
- `progress` - Agent status updates  
- `agent_output` - Agent completion output
- `completion` - Final research result
- `error` - Error messages

---

## 2. Research History & Caching 💾

### Dual Storage System

- **SQLite** - Local database (always available)
- **Supabase** - Cloud storage (optional, for caching)

### Key Endpoints

```bash
GET  /api/history              # Local SQLite history
GET  /api/history/cloud        # Supabase cloud history  
GET  /api/research/{id}        # Get specific research
GET  /api/search?q=query       # Search similar research
POST /api/run                  # Execute with auto-caching
```

### Auto-Caching

When `use_cache: true` in `/api/run`:
- Checks Supabase for cached results (24-hour TTL)
- Returns instantly if found
- Executes fresh research if not found

---

## 3. Export System 📄

### PDF Generation + Supabase Storage

#### Download PDF
```bash
GET /api/export/pdf/{research_id}
```

**Features:**
- Professional formatting with ReportLab
- Includes APA 7 and MLA citations
- Automatically uploads to Supabase Storage
- Returns Supabase URL in `X-PDF-URL` header

**Response Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=research_{id}.pdf
X-PDF-URL: https://your-project.supabase.co/storage/v1/object/public/...
```

---

## 4. Performance Metrics 📊

### Analytics Dashboard

```bash
GET /api/metrics               # Overall metrics
GET /api/metrics/agents        # Agent-specific data
```

**Response:**
```json
{
  "total_executions": 15,
  "successful_executions": 14,
  "success_rate": 93.33,
  "average_execution_time_ms": 32500.50,
  "agent_metrics": {
    "searcher": {
      "total_executions": 15,
      "successes": 14,
      "success_rate": 93.33,
      "average_time_ms": 8125.12
    }
  }
}
```

---

## API Endpoints Summary

### Core
- `GET  /api/health` - System status
- `POST /api/plan` - Generate execution plan
- `POST /api/run` - Execute research with caching

### WebSocket
- `WS /ws/{session_id}` - Real-time streaming

### History
- `GET /api/history` - Local history (SQLite)
- `GET /api/history/cloud` - Cloud history (Supabase)
- `GET /api/research/{id}` - Get specific research
- `GET /api/search?q=query` - Search similar

### Export
- `GET /api/export/pdf/{id}` - Download PDF

### Metrics
- `GET /api/metrics` - Overall performance
- `GET /api/metrics/agents` - Agent analytics

---

## Database Schema

### SQLite (`data/agentoffice.db`)

**research_history:**
- Complete research records with plans, outputs, logs
- Indexed by query and created_at

**agent_metrics:**
- Per-agent performance tracking
- Success rates and execution times

---

## Supabase Setup (Optional)

### 1. Create Supabase Project
Visit: https://supabase.com

### 2. Create Research History Table
```sql
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
3. Set to **Public**

### 4. Update `.env`
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
```

---

## Configuration

### Required
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGINS=http://localhost:3000
```

### Optional (Supabase)
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

---

## Health Check

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
  "uptime_seconds": 120
}
```

---

## Frontend Integration

Your friend needs these endpoints:

### 1. WebSocket for Real-time Progress
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/session-123');
ws.onopen = () => ws.send(JSON.stringify({ query: "AI ethics" }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // Handle progress, agent_output, completion, error
};
```

### 2. Execute Research
```javascript
const response = await fetch('http://localhost:8000/api/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    query: "cybersecurity best practices",
    use_cache: true 
  })
});
const result = await response.json();
```

### 3. Get History
```javascript
const history = await fetch('http://localhost:8000/api/history')
  .then(r => r.json());
```

### 4. Download PDF
```javascript
const response = await fetch(`http://localhost:8000/api/export/pdf/${researchId}`);
const pdfUrl = response.headers.get('X-PDF-URL'); // Supabase URL
const blob = await response.blob(); // Or download directly
```

### 5. Display Metrics
```javascript
const metrics = await fetch('http://localhost:8000/api/metrics')
  .then(r => r.json());
```

---

## What Changed (Removed Email)

### ❌ Removed
- Email sender modules
- SMTP configuration
- `/api/export/email` endpoint
- Email dependencies (aiosmtplib, email-validator)

### ✅ Enhanced
- PDF export now returns Supabase URL in header
- All results can be shown directly in the app
- Cleaner, simpler configuration

---

## Production Ready

- ✅ Works offline (SQLite)
- ✅ Cloud caching (Supabase)
- ✅ Real-time updates (WebSocket)
- ✅ Analytics dashboard (Metrics)
- ✅ PDF generation and storage
- ✅ No external email dependencies

---

## Dependencies

```
google-genai>=1.33.0
pydantic>=2.7.0
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
python-dotenv>=1.0.1
supabase>=2.4.0
reportlab>=4.0.0
websockets>=12.0
redis>=5.0.0
aiofiles>=23.2.0
```

---

**Server:** http://localhost:8000  
**Version:** 2.0.0  
**Branch:** `backend`
