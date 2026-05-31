# Library Feature Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Supabase

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=your_anon_key_here
```

### 3. Setup Supabase Database

Go to your Supabase project → SQL Editor and run:

```sql
-- Create research_history table
CREATE TABLE IF NOT EXISTS research_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  goal TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  final_output TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT
);

CREATE INDEX idx_query_hash ON research_history(query_hash);
CREATE INDEX idx_created_at ON research_history(created_at DESC);

ALTER TABLE research_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON research_history
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name: `research-pdfs`
4. Make it **Public**
5. Click Create

### 5. Start Frontend
```bash
npm run dev
```

## Using the Library

1. Click the **Library icon** (📚) in the left sidebar
2. View all your generated research documents
3. Use the search bar to find specific documents
4. Click download icon to get PDF
5. Click "Show more" to preview content

## Features

✅ View all research documents  
✅ Search by query or goal  
✅ Download PDFs  
✅ View from Supabase Storage  
✅ Document metadata (date, execution time)  
✅ Preview content  

## Troubleshooting

### No documents showing?
- Check Supabase URL and Key in `.env.local`
- Verify `research_history` table exists
- Run some research queries to generate documents

### Can't download PDFs?
- Ensure backend is running at `http://localhost:8000`
- Check that `research-pdfs` bucket is public in Supabase

### Search not working?
- Documents must have matching text in query or goal fields
- Try partial search terms

## Architecture

```
Frontend (React/Next.js)
    ↓
Supabase Client (fetch documents)
    ↓
Supabase Database (research_history table)
    ↓
Supabase Storage (research-pdfs bucket)
```

When a research query completes:
1. Backend saves to local SQLite
2. Backend saves to Supabase `research_history`
3. Backend generates PDF
4. Backend uploads PDF to Supabase Storage
5. Frontend fetches and displays in Library

---

**Need help?** See `LIBRARY_FEATURE.md` for full documentation.
