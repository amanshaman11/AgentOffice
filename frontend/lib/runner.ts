"use client";

import { useAgentStore, type Agent } from "@/lib/store/agents";
import type { RoleId } from "@/lib/roles";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isVerdictRole = (r: RoleId) => r === "analyzer" || r === "qa";

const SPEECH: Record<RoleId, { pass: string; revise?: string }> = {
  searcher: { pass: "Pulling sources from arXiv, JSTOR, Semantic Scholar…" },
  analyzer: {
    pass: "Source quality verified. Passing to summarizer.",
    revise: "Sources too weak — sending back to Searcher.",
  },
  summarizer: { pass: "Drafting concise summary." },
  sender: { pass: "Formatting APA 7 citations. Delivered." },
  planner: { pass: "Breaking idea into development tasks." },
  executor: { pass: "Generating code…" },
  qa: {
    pass: "Tests pass, code looks clean. Approving.",
    revise: "Issue found — sending back to Executor.",
  },
  deployer: { pass: "Building deployment checklist." },
  marketing: { pass: "Drafting launch copy and social assets." },
};

const PHASES = {
  walk: 1400,
  speak: 1500,
  back: 1100,
} as const;

/**
 * Drives the visual run loop. Reads the latest store state on each tick so the
 * user can Stop mid-run.
 */
export async function runOffice(agents: Agent[]) {
  if (agents.length === 0) return;

  const get = useAgentStore.getState;
  const { setRun, appendLog } = get();

  setRun({
    isRunning: true,
    activeAgentId: null,
    phase: "idle",
    log: [],
  });

  const interventionUsed = new Set<string>();
  let i = 0;

  while (i < agents.length) {
    if (!get().run.isRunning) break;
    const agent = agents[i];

    // Walk to stage
    setRun({ activeAgentId: agent.id, phase: "walking-to-stage" });
    await sleep(PHASES.walk);
    if (!get().run.isRunning) break;

    // Decide verdict for verdict-bearing roles
    const verdictRole = isVerdictRole(agent.roleId);
    const revise =
      verdictRole &&
      !interventionUsed.has(agent.id) &&
      i > 0 &&
      Math.random() < 0.5;
    const verdict = verdictRole ? (revise ? "revise" : "pass") : undefined;

    const speech = SPEECH[agent.roleId];
    const message =
      revise && speech.revise ? speech.revise : speech.pass;

    // Speak
    setRun({ phase: "speaking" });
    appendLog({
      ts: Date.now(),
      agentId: agent.id,
      roleId: agent.roleId,
      message,
      verdict,
    });
    await sleep(PHASES.speak);
    if (!get().run.isRunning) break;

    // Return
    setRun({ phase: "returning" });
    await sleep(PHASES.back);

    if (revise && i > 0) {
      interventionUsed.add(agent.id);
      i = i - 1; // loop back one step
      continue;
    }
    i += 1;
  }

  setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
}

export function stopRun() {
  useAgentStore
    .getState()
    .setRun({ isRunning: false, activeAgentId: null, phase: "idle" });
}
