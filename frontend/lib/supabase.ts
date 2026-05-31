import { createClient } from "@supabase/supabase-js";

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
}

export async function fetchDocuments(limit = 50): Promise<ResearchDocument[]> {
  if (!supabase) {
    console.warn("Supabase not configured");
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
      console.error("Error fetching documents:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching documents:", error);
    return [];
  }
}

export async function searchDocuments(query: string): Promise<ResearchDocument[]> {
  if (!supabase) {
    console.warn("Supabase not configured");
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
      console.error("Error searching documents:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error searching documents:", error);
    return [];
  }
}
