"""
Supabase Database Setup

Run this SQL in your Supabase SQL Editor to create the research_history table.
"""

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_query_hash ON research_history(query_hash);
CREATE INDEX IF NOT EXISTS idx_expires_at ON research_history(expires_at);
CREATE INDEX IF NOT EXISTS idx_created_at ON research_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_success ON research_history(success);

-- Enable Row Level Security (RLS)
ALTER TABLE research_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth strategy)
CREATE POLICY "Allow all operations" ON research_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for PDFs (run this separately in Supabase dashboard or via client)
-- Go to: Storage > Create Bucket
-- Name: research-pdfs
-- Public: Yes
