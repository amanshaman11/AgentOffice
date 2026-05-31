import { createClient } from "@supabase/supabase-js";
import { BACKEND_URL } from "./config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface ResearchDocument {
  id: string;
  query: string;
  query_hash: string;
  goal: string;
  success: boolean;
  final_output: string;
  execution_time_ms: number;
  created_at: string;
  expires_at: string | null;
  pdf_url: string | null;
  source?: "cloud" | "local";
}

interface LocalHistoryRecord {
  id: number;
  query: string;
  goal: string;
  success: number | boolean;
  final_output: string;
  created_at: string;
  execution_time_ms: number;
}

function mapLocalRecord(record: LocalHistoryRecord): ResearchDocument {
  return {
    id: String(record.id),
    query: record.query,
    query_hash: "",
    goal: record.goal,
    success: Boolean(record.success),
    final_output: record.final_output ?? "",
    execution_time_ms: record.execution_time_ms ?? 0,
    created_at: record.created_at,
    expires_at: null,
    pdf_url: null,
    source: "local",
  };
}

async function fetchCloudDocuments(limit: number): Promise<ResearchDocument[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("research_history")
      .select("*")
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Supabase fetch failed, falling back to local history:", error.message);
      return [];
    }

    return (data ?? []).map((doc) => ({ ...doc, source: "cloud" as const }));
  } catch (error) {
    console.warn("Supabase fetch failed, falling back to local history:", error);
    return [];
  }
}

async function fetchLocalDocuments(limit: number): Promise<ResearchDocument[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/history?limit=${limit}`);
    if (!res.ok) {
      return [];
    }

    const body = (await res.json()) as { history?: LocalHistoryRecord[] };
    return (body.history ?? [])
      .filter((record) => Boolean(record.success))
      .map(mapLocalRecord);
  } catch (error) {
    console.warn("Local history fetch failed:", error);
    return [];
  }
}

export async function fetchDocuments(limit = 50): Promise<ResearchDocument[]> {
  const cloudDocs = await fetchCloudDocuments(limit);
  if (cloudDocs.length > 0) {
    return cloudDocs;
  }

  return fetchLocalDocuments(limit);
}

async function searchCloudDocuments(query: string): Promise<ResearchDocument[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("research_history")
      .select("*")
      .eq("success", true)
      .or(`query.ilike.%${query}%,goal.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("Supabase search failed, falling back to local history:", error.message);
      return [];
    }

    return (data ?? []).map((doc) => ({ ...doc, source: "cloud" as const }));
  } catch (error) {
    console.warn("Supabase search failed, falling back to local history:", error);
    return [];
  }
}

async function searchLocalDocuments(query: string): Promise<ResearchDocument[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) {
      return [];
    }

    const body = (await res.json()) as { results?: LocalHistoryRecord[] };
    return (body.results ?? []).map(mapLocalRecord);
  } catch (error) {
    console.warn("Local search failed:", error);
    return [];
  }
}

export async function searchDocuments(query: string): Promise<ResearchDocument[]> {
  const cloudDocs = await searchCloudDocuments(query);
  if (cloudDocs.length > 0) {
    return cloudDocs;
  }

  return searchLocalDocuments(query);
}

export function getDocumentPdfUrl(doc: ResearchDocument): string | null {
  if (doc.pdf_url) {
    return doc.pdf_url;
  }

  if (/^\d+$/.test(doc.id)) {
    return `${BACKEND_URL}/api/export/pdf/${doc.id}`;
  }

  return null;
}
