"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Search, Calendar, Clock, ExternalLink } from "lucide-react";
import { fetchDocuments, searchDocuments, type ResearchDocument } from "@/lib/supabase";
import clsx from "clsx";

export function Library() {
  const [documents, setDocuments] = useState<ResearchDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const docs = await fetchDocuments(50);
    setDocuments(docs);
    setLoading(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      loadDocuments();
      return;
    }

    setSearching(true);
    const docs = await searchDocuments(query);
    setDocuments(docs);
    setSearching(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const downloadPDF = async (doc: ResearchDocument) => {
    if (doc.pdf_url) {
      window.open(doc.pdf_url, "_blank");
    } else {
      console.warn("No PDF URL available for this document");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-1)]">
      <div className="flex-none p-4 border-b border-[var(--color-stroke)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <FileText size={20} />
          Document Library
        </h2>
        
        <div className="relative">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-stroke)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-neon-violet)] focus:ring-opacity-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-neon-violet)] border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--color-text-muted)] px-4 text-center">
            <FileText size={32} className="mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? "No documents found" : "No documents yet"}
            </p>
            <p className="text-xs mt-1">
              {searchQuery ? "Try a different search" : "Run a research query to generate documents"}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDownload={() => downloadPDF(doc)}
                formatDate={formatDate}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentCardProps {
  doc: ResearchDocument;
  onDownload: () => void;
  formatDate: (date: string) => string;
  formatTime: (ms: number) => string;
}

function DocumentCard({ doc, onDownload, formatDate, formatTime }: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-stroke)] rounded-lg p-3 hover:border-[var(--color-neon-violet)] hover:border-opacity-50 transition group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {doc.goal}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
            {doc.query}
          </p>
        </div>
        
        <button
          onClick={onDownload}
          className="flex-none p-1.5 rounded hover:bg-[var(--color-bg-3)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-violet)] transition"
          title="View PDF"
        >
          <ExternalLink size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(doc.created_at)}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatTime(doc.execution_time_ms)}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-stroke)]">
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-4">
            {doc.final_output.substring(0, 200)}...
          </p>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-[var(--color-neon-violet)] hover:underline mt-2"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
