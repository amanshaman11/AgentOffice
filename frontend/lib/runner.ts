"use client";

import { useAgentStore, type RunStep } from "@/lib/store/agents";
import {
  runQuery as apiRun,
  type OrchestrationResult,
} from "@/lib/api";
import type { RoleId } from "@/lib/roles";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const PHASES = { walk: 1200, speak: 1500, back: 900 } as const;

const STEP_SUCCESS_RE = /^Step (\d+) '([a-z_]+)' succeeded\.$/;
const STEP_FAILED_RE = /^Step (\d+) '([a-z_]+)' failed \(attempt \d+\): (.+)$/;
const REROUTE_RE = /^Re-routing to '([a-z_]+)' per fallback rules\.$/;

const KNOWN_ROLES: RoleId[] = [
  "searcher",
  "analyzer",
  "summarizer",
  "sender",
  "planner",
  "executor",
  "qa",
  "deployer",
  "marketing",
];

const isRoleId = (s: string): s is RoleId => KNOWN_ROLES.includes(s as RoleId);

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

async function animateAgent(
  agentName: string,
  message: string,
  verdict: "pass" | "revise",
) {
  const get = useAgentStore.getState;
  const { setRun, appendLog } = get();
  const state = get();
  const roleId: RoleId | undefined = isRoleId(agentName) ? agentName : undefined;
  const match = roleId
    ? state.agents.find(
        (a) => a.officeId === state.activeOfficeId && a.roleId === roleId,
      )
    : undefined;

  if (!match) {
    appendLog({
      ts: Date.now(),
      agentId: `_missing_${agentName}_${Math.random().toString(36).slice(2, 6)}`,
      roleId,
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
 * Run a query end-to-end: POST /api/run, then animate the agents in the room
 * by walking the backend's log timeline. Returns the full result so callers
 * (e.g. the chat) can display final output.
 */
export async function runQueryAndAnimate(
  query: string,
): Promise<OrchestrationResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const get = useAgentStore.getState;
  const { setRun, appendLog } = get();

  setRun({
    isRunning: true,
    activeAgentId: null,
    phase: "idle",
    log: [],
  });

  appendLog(systemStep(`Query: "${trimmed}"`));
  appendLog(systemStep("Calling backend…"));

  let result: OrchestrationResult;
  try {
    result = await apiRun(trimmed);
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

  for (const line of result.log) {
    if (!get().run.isRunning) break;

    let m = STEP_SUCCESS_RE.exec(line);
    if (m) {
      const agentName = m[2];
      const out = result.outputs[agentName];
      const msg = out?.output ? truncate(out.output) : `${agentName} done.`;
      await animateAgent(agentName, msg, "pass");
      continue;
    }

    m = STEP_FAILED_RE.exec(line);
    if (m) {
      const agentName = m[2];
      const reason = m[3];
      await animateAgent(agentName, reason, "revise");
      continue;
    }

    m = REROUTE_RE.exec(line);
    if (m) {
      appendLog(systemStep(`Re-routing to ${m[1]} per fallback rules.`));
      continue;
    }

    // Skip the noisy "Planned N steps…" line; we already surfaced it.
    if (!line.startsWith("Planned ")) appendLog(systemStep(line));
  }

  if (get().run.isRunning) {
    appendLog(
      systemStep(
        result.success
          ? "Office run complete."
          : "Office run finished with errors.",
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
