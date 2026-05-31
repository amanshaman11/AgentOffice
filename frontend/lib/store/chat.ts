"use client";

import { create } from "zustand";
import { runQueryAndAnimate } from "@/lib/runner";
import { suggestWorkflow as apiSuggest, type RunPayload } from "@/lib/api";
import { useAgentStore } from "@/lib/store/agents";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
  suggestedAgents?: string[];
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

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  pending: false,

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const user: ChatMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    const result = await runQueryAndAnimate(trimmed);

    if (!result) {
      const sys: ChatMessage = {
        id: makeId(),
        role: "system",
        text: "Run failed. Check the activity log for details.",
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, sys], pending: false }));
      return;
    }

    const body =
      result.final_output ||
      "Run completed but no final output was produced.";
    const assistant: ChatMessage = {
      id: makeId(),
      role: "assistant",
      text: body,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, assistant], pending: false }));
  },

  suggestWorkflow: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const user: ChatMessage = {
      id: makeId(),
      role: "user",
      text: `Suggest workflow: ${trimmed}`,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    try {
      const agentStore = useAgentStore.getState();
      const activeOffice = agentStore.offices.find(
        (o) => o.id === agentStore.activeOfficeId,
      );
      const officeType =
        (activeOffice?.type ?? "research") as RunPayload["office_type"];

      const suggestion = await apiSuggest(trimmed, officeType);

      const agentLines = suggestion.suggested_agents
        .map((a, i) => `${i + 1}. ${a}`)
        .join("\n");

      const body = [
        "Suggested workflow:",
        "",
        agentLines,
        "",
        suggestion.rationale,
      ].join("\n");

      const assistant: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: body,
        ts: Date.now(),
        suggestedAgents: suggestion.suggested_agents,
      };
      set((s) => ({ messages: [...s.messages, assistant], pending: false }));
    } catch (err) {
      const sys: ChatMessage = {
        id: makeId(),
        role: "system",
        text: err instanceof Error ? err.message : String(err),
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, sys], pending: false }));
    }
  },

  clear: () => set({ messages: [], pending: false }),
}));
