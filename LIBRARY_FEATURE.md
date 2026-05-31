# Library Feature

## Overview

The Library feature allows users to view, search, and download all their generated research documents directly from the sidebar.

## Features

- **Document List**: View all your research documents sorted by date
- **Search**: Search documents by query or goal
- **Quick Actions**: 
  - Download PDFs locally
  - Open PDFs from Supabase Storage (if available)
  - View document summaries
- **Document Details**: See execution time, creation date, and preview

## Setup

### 1. Configure Supabase (Frontend)

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_anon_key_here
```

### 2. Supabase Database Setup

Run the SQL in `supabase_setup.sql` in your Supabase SQL Editor to create the `research_history` table.

### 3. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `research-pdfs`
3. Make it **Public**

## How It Works

### Data Flow

1. **Backend Saves Research**:
   - When research completes, backend saves to local SQLite
   - If Supabase is configured, also saves to Supabase `research_history` table
   - Generates PDF and uploads to Supabase Storage

2. **Frontend Displays Documents**:
   - Library component fetches documents from Supabase
   - Displays in a searchable, sortable list
   - Users can download or view PDFs

### API Integration

The Library uses:
- `fetchDocuments()` - Get recent documents from Supabase
- `searchDocuments(query)` - Search documents by text
- `GET /api/export/pdf/{id}` - Download PDF from backend

## UI Components

### Library Icon
Located in the left sidebar rail, between Chat and Offices icons.

### Library Panel
- **Search Bar**: Real-time search through documents
- **Document Cards**: Show query, goal, date, execution time
- **Actions**: Download/view PDF, expand for preview

## Usage

1. Click the Library icon (📚) in the left sidebar
2. Browse your documents or search for specific topics
3. Click the download icon to get the PDF
4. Click "Show more" to see document preview

## Technical Details

### Files Created

- `frontend/lib/supabase.ts` - Supabase client and API functions
- `frontend/components/shell/Library.tsx` - Library UI component
- `frontend/.env.local.example` - Environment variable template

### Files Modified

- `frontend/lib/store/ui.ts` - Added "library" to LeftView type
- `frontend/components/shell/LeftRail.tsx` - Added Library icon
- `frontend/components/shell/LeftSidebarSlot.tsx` - Added Library panel routing

### Dependencies

- `@supabase/supabase-js` - Supabase JavaScript client

## Optional Configuration

The Library works even without Supabase configuration:
- Without Supabase: Shows empty state message
- With Supabase: Full document library functionality

## Troubleshooting

### No documents showing up

1. **Check Supabase Config**:
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` in `.env.local`
   - Restart frontend dev server after adding env variables

2. **Check Database**:
   - Verify `research_history` table exists in Supabase
   - Check that backend is saving to Supabase (check backend logs)

3. **Check RLS Policies**:
   - Ensure Row Level Security policies allow reading from `research_history`

### PDFs not downloading

1. **Check Backend**:
   - Verify backend is running at `http://localhost:8000`
   - Test endpoint: `GET /api/export/pdf/{research_id}`

2. **Check Supabase Storage**:
   - Verify `research-pdfs` bucket exists and is public
   - Check if PDFs are being uploaded (view in Storage dashboard)

## Future Enhancements

- Bulk download multiple PDFs
- Share documents via link
- Filter by date range or success status
- Organize documents into collections
- Export document list as CSV
