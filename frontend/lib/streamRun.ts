"use client";

import { BACKEND_URL } from "@/lib/config";
import { useAgentStore, type RunStep } from "@/lib/store/agents";
import { useCodeStore } from "@/lib/store/code";
import { getProjectFiles } from "@/lib/api";
import { previewLoadedFiles } from "@/lib/loadProjectPreview";
import type { RoleId } from "@/lib/roles";

const PHASES = { walk: 1200, speak: 1500, back: 900 } as const;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function systemStep(message: string): RunStep {
  return { ts: Date.now(), agentId: `_sys_${Math.random().toString(36).slice(2, 8)}`, message };
}

function truncate(s: string, n = 280): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

async function animateAgent(
  agentName: string,
  message: string,
  verdict: "pass" | "revise",
  officeId: string,
): Promise<void> {
  const { agents, setRun, appendLog } = useAgentStore.getState();
  const roster = agents.filter((a) => a.officeId === officeId);
  const match = roster.find((a) => a.roleId === agentName);

  if (!match) {
    appendLog({ ts: Date.now(), agentId: `_${agentName}`, roleId: agentName as RoleId, message: `[${agentName}] ${message}`, verdict });
    await sleep(450);
    return;
  }

  setRun({ activeAgentId: match.id, phase: "walking-to-stage" });
  await sleep(PHASES.walk);
  appendLog({ ts: Date.now(), agentId: match.id, roleId: match.roleId, message, verdict });
  setRun({ phase: "speaking" });
  await sleep(PHASES.speak);
  setRun({ phase: "returning" });
  await sleep(PHASES.back);
}

export interface StreamRunOptions {
  query: string;
  agents: string[];
  officeType: "developer" | "research";
  officeId: string;
  sessionId: string;
}

export function streamRun(options: StreamRunOptions): () => void {
  const { query, agents, officeType, officeId } = options;
  const { setRun, appendLog, resetRun } = useAgentStore.getState();
  const {
    setBuildStatus,
    setResearchId,
    setFiles,
    upsertAgentProgress,
    setSetupInstructions,
    reset: resetCode,
  } = useCodeStore.getState();

  resetRun();
  resetCode();
  setBuildStatus("building");
  setRun({ isRunning: true, activeAgentId: null, phase: "idle", log: [] });
  appendLog(systemStep(`Query: "${query}"`));

  const abortController = new AbortController();
  let stopped = false;

  const failRun = (message: string) => {
    appendLog(systemStep(message));
    setBuildStatus("error");
    setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
  };

  const handleEvent = async (msg: Record<string, unknown>) => {
    const type = msg.type as string;

    if (type === "progress") {
      const agent = msg.agent as string;
      const status = msg.status as string;
      const message = (msg.message as string) ?? "";
      upsertAgentProgress({
        agent,
        status: status === "started" ? "running" : status === "completed" ? "done" : "running",
        message: truncate(message, 80),
      });
      appendLog(systemStep(`[${agent}] ${message}`));
    }

    if (type === "agent_output") {
      const agent = msg.agent as string;
      const success = msg.success as boolean;
      const output = (msg.output as string) ?? "";
      upsertAgentProgress({ agent, status: success ? "done" : "failed" });

      if (agent === "executor" && success) {
        appendLog(systemStep("Executor finished — code generated."));
      }

      await animateAgent(agent, truncate(output || (success ? "Done." : "Failed.")), success ? "pass" : "revise", officeId);
    }

    if (type === "completion") {
      const success = msg.success as boolean;
      const researchId = msg.research_id as number | null;

      setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
      appendLog(systemStep(success ? "Run complete." : "Run finished with errors."));

      if (researchId) {
        setResearchId(researchId);
        try {
          const project = await getProjectFiles(researchId);
          if (project.files?.length) {
            setFiles(project.files);
            setSetupInstructions(project.setup_instructions ?? "");
            setBuildStatus("ready");
            previewLoadedFiles();
          } else {
            setBuildStatus(success ? "ready" : "error");
          }
        } catch {
          setBuildStatus("error");
        }
      } else {
        setBuildStatus(success ? "ready" : "error");
      }
    }

    if (type === "error") {
      failRun(`Error: ${msg.error as string}`);
    }
  };

  const run = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/run/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, office_type: officeType, agents }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        failRun(detail || `Stream request failed (${response.status}).`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        failRun("Stream response had no body.");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            await handleEvent(JSON.parse(line) as Record<string, unknown>);
          } catch {
            appendLog(systemStep("Received malformed stream event."));
          }
        }
      }

      if (!stopped && useCodeStore.getState().buildStatus === "building") {
        failRun("Stream ended before completion.");
      }
    } catch (err) {
      if (stopped || (err instanceof DOMException && err.name === "AbortError")) return;
      failRun(err instanceof Error ? err.message : String(err));
    }
  };

  void run();

  return () => {
    stopped = true;
    abortController.abort();
  };
}
