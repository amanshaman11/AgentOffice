"use client";

import { create } from "zustand";
import { runQueryAndAnimate } from "@/lib/runner";
import { streamRun } from "@/lib/streamRun";
import {
  suggestWorkflow as apiSuggest,
  editProject,
  getProjectFiles,
  type RunPayload,
  type RunResult,
} from "@/lib/api";
import {
  formatResearchResultForChat,
  type DeveloperRunMeta,
} from "@/lib/formatDeveloperResult";
import { useAgentStore } from "@/lib/store/agents";
import { useUiStore } from "@/lib/store/ui";
import { useCodeStore } from "@/lib/store/code";
import { previewLoadedFiles } from "@/lib/loadProjectPreview";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
  suggestedAgents?: string[];
  developerMeta?: DeveloperRunMeta;
}

interface ChatStore {
  messages: ChatMessage[];
  pending: boolean;
  sendMessage: (text: string) => Promise<void>;
  suggestWorkflow: (text: string) => Promise<void>;
  clear: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

async function handleDevEdit(trimmed: string, researchId: number, set: (fn: (s: ChatStore) => Partial<ChatStore>) => void) {
  const codeStore = useCodeStore.getState();
  useUiStore.getState().setActiveLeft("code");
  codeStore.setBuildStatus("building");

  try {
    const result = await editProject(researchId, trimmed);
    if (result.files?.length) {
      codeStore.setFiles(result.files);
      codeStore.setResearchId(result.research_id);
      codeStore.setSetupInstructions(result.setup_instructions ?? "");
      codeStore.setBuildStatus("ready");
      previewLoadedFiles();
    }

    const assistant: ChatMessage = {
      id: makeId(),
      role: "assistant",
      text: `Edit applied. ${result.files.length} file(s) updated. New version saved (ID: ${result.research_id}).`,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, assistant], pending: false }));
  } catch (err) {
    codeStore.setBuildStatus("error");
    const sys: ChatMessage = {
      id: makeId(),
      role: "system",
      text: err instanceof Error ? err.message : String(err),
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, sys], pending: false }));
  }
}

function handleDevStream(
  trimmed: string,
  set: (fn: (s: ChatStore) => Partial<ChatStore>) => void,
) {
  const agentStore = useAgentStore.getState();
  const uiStore = useUiStore.getState();
  const officeId = agentStore.activeOfficeId;
  const agents = agentStore.agents
    .filter((a) => a.officeId === officeId)
    .map((a) => a.roleId);

  uiStore.setActiveLeft("code");

  const sessionId = makeId();

  const cleanup = streamRun({
    query: trimmed,
    agents,
    officeType: "developer",
    officeId,
    sessionId,
  });

  const checkInterval = setInterval(() => {
    const status = useCodeStore.getState().buildStatus;
    if (status === "ready" || status === "error") {
      clearInterval(checkInterval);
      cleanup();

      const cs = useCodeStore.getState();
      let body: string;
      if (status === "ready" && cs.files.length) {
        const fileList = cs.files.map((f) => `- \`${f.path}\``).join("\n");
        body = [
          "Project generated successfully.",
          "",
          `**${cs.files.length} files** ready in the Coding tab.`,
          "",
          "Files:",
          fileList,
          "",
          cs.setupInstructions ? `**Setup:**\n${cs.setupInstructions}` : "",
          cs.researchId ? `\nDownload: \`/api/export/zip/${cs.researchId}\`` : "",
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        body = "Run finished with errors. Check the activity log.";
      }

      const assistant: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: body,
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, assistant], pending: false }));
    }
  }, 800);
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  pending: false,

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const user: ChatMessage = { id: makeId(), role: "user", text: trimmed, ts: Date.now() };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    const agentStore = useAgentStore.getState();
    const activeOffice = agentStore.offices.find((o) => o.id === agentStore.activeOfficeId);
    const officeType = (activeOffice?.type ?? "research") as RunPayload["office_type"];

    if (officeType === "developer") {
      const codeStore = useCodeStore.getState();
      const existingProjectId = codeStore.researchId;

      if (existingProjectId && codeStore.buildStatus === "ready") {
        await handleDevEdit(trimmed, existingProjectId, set);
        return;
      }

      handleDevStream(trimmed, set);
      return;
    }

    const result: RunResult | null = await runQueryAndAnimate(trimmed);

    if (!result) {
      const sys: ChatMessage = { id: makeId(), role: "system", text: "Run failed. Check the activity log for details.", ts: Date.now() };
      set((s) => ({ messages: [...s.messages, sys], pending: false }));
      return;
    }

    const assistant: ChatMessage = {
      id: makeId(),
      role: "assistant",
      text: formatResearchResultForChat(result),
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, assistant], pending: false }));
  },

  suggestWorkflow: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const user: ChatMessage = { id: makeId(), role: "user", text: `Suggest workflow: ${trimmed}`, ts: Date.now() };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    try {
      const agentStore = useAgentStore.getState();
      const activeOffice = agentStore.offices.find((o) => o.id === agentStore.activeOfficeId);
      const officeType = (activeOffice?.type ?? "research") as RunPayload["office_type"];
      const suggestion = await apiSuggest(trimmed, officeType);
      const agentLines = suggestion.suggested_agents.map((a, i) => `${i + 1}. ${a}`).join("\n");
      const body = ["Suggested workflow:", "", agentLines, "", suggestion.rationale].join("\n");

      const assistant: ChatMessage = { id: makeId(), role: "assistant", text: body, ts: Date.now(), suggestedAgents: suggestion.suggested_agents };
      set((s) => ({ messages: [...s.messages, assistant], pending: false }));
    } catch (err) {
      const sys: ChatMessage = { id: makeId(), role: "system", text: err instanceof Error ? err.message : String(err), ts: Date.now() };
      set((s) => ({ messages: [...s.messages, sys], pending: false }));
    }
  },

  clear: () => set({ messages: [], pending: false }),
}));
