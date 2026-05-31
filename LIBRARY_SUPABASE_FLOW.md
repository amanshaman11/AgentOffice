# How Library + Supabase Storage Works

## Complete Flow

### 1. User Runs Research Query
```
User → Frontend → Backend /api/run
```

### 2. Backend Processes Research
```python
# In src/lib/server.py

async def _persist_result(query, result, execution_time_ms):
    # Step 1: Save to local SQLite
    research_id = save_research(...)
    
    # Step 2: If successful and Supabase configured
    if result.success and is_supabase_configured():
        # Generate PDF
        pdf_data = generate_research_pdf(query, goal, final_output)
        
        # Upload to Supabase Storage
        file_path = f"research/{research_id}_{timestamp}.pdf"
        pdf_url = await upload_pdf(file_path, pdf_data)
        
        # Save to Supabase database with PDF URL
        await _history.save_research(
            query=query,
            goal=goal,
            final_output=final_output,
            pdf_url=pdf_url,  # ← Supabase Storage URL
        )
```

### 3. Frontend Library Fetches Documents
```typescript
// In frontend/lib/supabase.ts

async function fetchDocuments() {
    const { data } = await supabase
        .from("research_history")
        .select("*")
        .order("created_at", { ascending: false });
    
    // Each document has pdf_url from Supabase Storage
    return data;
}
```

### 4. User Clicks PDF Icon
```typescript
// In frontend/components/shell/Library.tsx

const downloadPDF = (doc) => {
    // Open PDF directly from Supabase Storage
    window.open(doc.pdf_url, "_blank");
};
```

## Architecture Diagram

```
┌─────────────┐
│   User      │
│  Generates  │
│  Research   │
└──────┬──────┘
       ↓
┌──────────────────────────────────────┐
│  Backend (src/lib/server.py)         │
├──────────────────────────────────────┤
│  1. Run orchestrator                 │
│  2. Generate PDF (reportlab)         │
│  3. Upload PDF to Supabase Storage   │
│  4. Save metadata to Supabase DB     │
│     - query, goal, output            │
│     - pdf_url (Storage link)         │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  Supabase                            │
├──────────────────────────────────────┤
│  Database:                           │
│  └─ research_history table           │
│     └─ pdf_url column                │
│                                      │
│  Storage:                            │
│  └─ research-pdfs bucket             │
│     └─ research/{id}_{time}.pdf      │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  Frontend Library                    │
├──────────────────────────────────────┤
│  1. Fetch from Supabase DB           │
│  2. Display documents                │
│  3. Click → Open pdf_url             │
└──────────────────────────────────────┘
```

## Key Points

### Backend Auto-Generation
✅ PDF generated IMMEDIATELY after successful research  
✅ PDF uploaded to Supabase Storage automatically  
✅ PDF URL saved in database  
✅ Works for both `/api/run` and WebSocket streaming  

### Frontend Library
✅ Fetches documents from Supabase database  
✅ Each document has `pdf_url` field  
✅ Opens PDFs directly from Supabase Storage  
✅ No backend API calls needed for viewing  

### Supabase Storage
✅ Public bucket: `research-pdfs`  
✅ File path: `research/{research_id}_{timestamp}.pdf`  
✅ Public URL format: `https://{project}.supabase.co/storage/v1/object/public/research-pdfs/...`  

## Testing the Flow

### 1. Check Backend Config
```bash
# In root .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
```

### 2. Check Frontend Config
```bash
# In frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=your_anon_key
```

### 3. Verify Supabase Setup
- Database: `research_history` table exists
- Storage: `research-pdfs` bucket is PUBLIC

### 4. Run a Test Research
```bash
curl -X POST http://localhost:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{"query": "test research", "use_cache": false}'
```

### 5. Check Backend Logs
Look for:
```
PDF uploaded to Supabase: https://...
```

### 6. Check Library
- Open frontend
- Click Library icon
- See document listed
- Click PDF icon → Opens in new tab

## Troubleshooting

### PDFs not uploading?
1. Check `SUPABASE_URL` and `SUPABASE_KEY` in backend `.env`
2. Check bucket `research-pdfs` exists and is PUBLIC
3. Check backend logs for upload errors

### Library empty?
1. Check frontend `.env.local` has Supabase credentials
2. Check `research_history` table has data
3. Check RLS policies allow SELECT

### PDF URL is null?
1. Research might have been created before the fix
2. Run a new research query
3. Old documents won't have PDF URLs (generated before auto-upload)

## Files Modified

**Backend:**
- `src/lib/server.py` - Auto-generate and upload PDFs

**Frontend:**
- `frontend/components/shell/Library.tsx` - Simplified PDF viewing

## Summary

✅ **Automatic**: PDFs generated and uploaded after every successful research  
✅ **Fast**: No manual export needed  
✅ **Simple**: Library opens PDFs directly from Supabase  
✅ **Reliable**: All documents stored in Supabase Storage  
