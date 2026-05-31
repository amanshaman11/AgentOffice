import type { AgentResult, OrchestrationResult } from "./api";
import { BACKEND_URL } from "./config";

export interface DeveloperRunMeta {
  researchId: number | null;
  zipUrl: string | null;
  filePaths: string[];
  setupInstructions: string;
  tagline: string | null;
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
  const marketing = findOutput(result, "marketing");
  const executorData = executor?.output
    ? parseJson<{ files?: { path: string }[]; setup_instructions?: string }>(
        executor.output,
      )
    : null;
  const marketingData = marketing?.output
    ? parseJson<{ tagline?: string }>(marketing.output)
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
    tagline: marketingData?.tagline ?? null,
    success: result.success,
  };
}

export function formatDeveloperResultForChat(
  result: OrchestrationResult,
  meta: DeveloperRunMeta,
): string {
  const lines: string[] = [];

  if (meta.tagline) {
    lines.push(`**${meta.tagline}**`, "");
  }

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

  const deployer = findOutput(result, "deployer");
  if (deployer?.output) {
    const deploy = parseJson<{ platform_recommendation?: string; steps?: string[] }>(
      deployer.output,
    );
    if (deploy?.platform_recommendation) {
      lines.push(`**Deploy to:** ${deploy.platform_recommendation}`);
      if (deploy.steps?.length) {
        lines.push("1. " + deploy.steps.slice(0, 5).join("\n2. "));
      }
      lines.push("");
    }
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
