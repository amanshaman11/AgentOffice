"use client";

import { useAgentStore, type RunStep } from "@/lib/store/agents";
import {
  runQuery as apiRun,
  type RunPayload,
  type RunResult,
} from "@/lib/api";
import type { RoleId } from "@/lib/roles";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const PHASES = { walk: 1200, speak: 1500, back: 900 } as const;

const STEP_SUCCESS_RE = /^Step (\d+) '([a-z_]+)' succeeded\.$/;
const STEP_FAILED_RE = /^Step (\d+) '([a-z_]+)' failed \(attempt \d+\): (.+)$/;
const REROUTE_RE = /^Re-routing to '([a-z_]+)' per fallback rules\.$/;

function systemStep(message: string): RunStep {
  return {
    ts: Date.now(),
    agentId: `_system_${Math.random().toString(36).slice(2, 8)}`,
    message,
  };
}

function truncate(s: string, n = 280): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

/**
 * Animate the roster agent at the given 1-based step index. Falls back to a
 * log-only entry when the roster slot is empty (e.g. after a failed run cleared
 * agents).
 */
async function animateByStep(
  stepNum: number,
  agentName: string,
  message: string,
  verdict: "pass" | "revise",
  rosterAgents: ReturnType<typeof useAgentStore.getState>["agents"],
) {
  const get = useAgentStore.getState;
  const { setRun, appendLog } = get();

  const match = rosterAgents[stepNum - 1];

  if (!match) {
    appendLog({
      ts: Date.now(),
      agentId: `_missing_${agentName}_${Math.random().toString(36).slice(2, 6)}`,
      roleId: agentName as RoleId | undefined,
      message: `[${agentName}] ${message}`,
      verdict,
    });
    await sleep(450);
    return;
  }

  setRun({ activeAgentId: match.id, phase: "walking-to-stage" });
  await sleep(PHASES.walk);
  if (!get().run.isRunning) return;

  setRun({ phase: "speaking" });
  appendLog({
    ts: Date.now(),
    agentId: match.id,
    roleId: match.roleId,
    message,
    verdict,
  });
  await sleep(PHASES.speak);
  if (!get().run.isRunning) return;

  setRun({ phase: "returning" });
  await sleep(PHASES.back);
}

/**
 * Run a query end-to-end: POST /api/run with the active roster, then animate
 * agents in the room by replaying the backend log. Returns the full result so
 * callers (e.g. the chat) can display the final output.
 */
export async function runQueryAndAnimate(query: string): Promise<RunResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const get = useAgentStore.getState;
  const { setRun, appendLog } = get();
  const state = get();

  const activeAgents = state.agents.filter(
    (a) => a.officeId === state.activeOfficeId,
  );

  if (activeAgents.length === 0) {
    setRun({ isRunning: true, activeAgentId: null, phase: "idle", log: [] });
    appendLog(systemStep("Add agents to your office first."));
    setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
    return null;
  }

  const activeOffice = state.offices.find((o) => o.id === state.activeOfficeId);
  const officeType = (activeOffice?.type ?? "research") as "research" | "developer";

  const payload: RunPayload = {
    query: trimmed,
    office_type: officeType,
    agents: activeAgents.map((a) => a.roleId),
  };

  setRun({ isRunning: true, activeAgentId: null, phase: "idle", log: [] });
  appendLog(systemStep(`Query: "${trimmed}"`));
  appendLog(
    systemStep(
      `Running with: ${activeAgents.map((a) => a.roleId).join(" → ")}`,
    ),
  );
  appendLog(systemStep("Calling backend…"));

  let result: RunResult;
  try {
    result = await apiRun(payload);
  } catch (err) {
    appendLog(systemStep(err instanceof Error ? err.message : String(err)));
    setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
    return null;
  }

  appendLog(
    systemStep(
      `Plan ready (${result.plan.steps.length} steps): ${result.plan.goal}`,
    ),
  );

  // Snapshot roster at the time the result arrived so animation indices are stable
  const rosterAgents = get().agents.filter(
    (a) => a.officeId === state.activeOfficeId,
  );

  for (const line of result.log) {
    if (!get().run.isRunning) break;

    let m = STEP_SUCCESS_RE.exec(line);
    if (m) {
      const stepNum = parseInt(m[1], 10);
      const agentName = m[2];
      const out = result.outputs[m[1]];
      const msg = out?.output ? truncate(out.output) : `${agentName} done.`;
      await animateByStep(stepNum, agentName, msg, "pass", rosterAgents);
      continue;
    }

    m = STEP_FAILED_RE.exec(line);
    if (m) {
      const stepNum = parseInt(m[1], 10);
      const agentName = m[2];
      const reason = m[3];
      await animateByStep(stepNum, agentName, reason, "revise", rosterAgents);
      continue;
    }

    m = REROUTE_RE.exec(line);
    if (m) {
      appendLog(systemStep(`Re-routing to ${m[1]} per fallback rules.`));
      continue;
    }

    if (!line.startsWith("Planned ")) appendLog(systemStep(line));
  }

  if (get().run.isRunning) {
    appendLog(
      systemStep(
        result.success ? "Office run complete." : "Office run finished with errors.",
      ),
    );
  }
  setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
  return result;
}

export function stopRun() {
  useAgentStore
    .getState()
    .setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
}
