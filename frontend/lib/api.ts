import { BACKEND_URL } from "./config";

export interface PlanStep {
  step: number;
  agent: string;
  depends_on: number[];
  required: boolean;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  fallback_rules: string[];
}

export interface AgentResult {
  agent: string;
  success: boolean;
  output: string;
  feedback: string;
}

export interface OrchestrationResult {
  goal: string;
  plan: Plan;
  success: boolean;
  outputs: Record<string, AgentResult>;
  final_output: string;
  log: string[];
}

export interface HealthResponse {
  status: string;
  gemini_key: string;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new Error(
      `Cannot reach backend at ${BACKEND_URL}. Is it running? (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Backend ${path} ${res.status}: ${detail || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return http<HealthResponse>("/api/health", { signal });
}

export function getPlan(query: string): Promise<Plan> {
  return http<Plan>("/api/plan", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function runQuery(query: string): Promise<OrchestrationResult> {
  return http<OrchestrationResult>("/api/run", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}
