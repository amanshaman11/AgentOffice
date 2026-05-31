import type { AgentResult, OrchestrationResult } from "./api";
import { BACKEND_URL } from "./config";

export interface DeveloperRunMeta {
  researchId: number | null;
  zipUrl: string | null;
  filePaths: string[];
  setupInstructions: string;
  success: boolean;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function findOutput(result: OrchestrationResult, agent: string): AgentResult | undefined {
  return Object.values(result.outputs).find((o) => o.agent === agent);
}

export function buildDeveloperRunMeta(
  result: OrchestrationResult,
  researchId?: number | null,
  artifactUrl?: string | null,
): DeveloperRunMeta {
  const executor = findOutput(result, "executor");
  const executorData = executor?.output
    ? parseJson<{ files?: { path: string }[]; setup_instructions?: string }>(
        executor.output,
      )
    : null;

  const filePaths = executorData?.files?.map((f) => f.path) ?? [];
  const zipUrl =
    artifactUrl ??
    (researchId != null
      ? `${BACKEND_URL}/api/export/zip/${researchId}`
      : null);

  return {
    researchId: researchId ?? null,
    zipUrl,
    filePaths,
    setupInstructions: executorData?.setup_instructions ?? "",
    success: result.success,
  };
}

export function formatDeveloperResultForChat(
  result: OrchestrationResult,
  meta: DeveloperRunMeta,
): string {
  const lines: string[] = [];

  lines.push(`**Goal:** ${result.goal}`, "");

  if (meta.filePaths.length > 0) {
    lines.push("**Generated files:**");
    for (const path of meta.filePaths.slice(0, 20)) {
      lines.push(`• ${path}`);
    }
    if (meta.filePaths.length > 20) {
      lines.push(`• …and ${meta.filePaths.length - 20} more`);
    }
    lines.push("");
  } else {
    lines.push("_No code files were saved in this run._", "");
  }

  if (meta.setupInstructions) {
    lines.push("**Setup:**", meta.setupInstructions, "");
  }

  if (meta.zipUrl) {
    lines.push(`**Download project:** ${meta.zipUrl}`);
  }

  if (!result.success) {
    lines.push("", "_Run completed with errors — check the activity log._");
  }

  return lines.join("\n");
}

export function formatResearchResultForChat(result: OrchestrationResult): string {
  return result.final_output || "Run completed.";
}
