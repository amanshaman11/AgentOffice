"use client";

import { create } from "zustand";
import { runQueryAndAnimate } from "@/lib/runner";
import { getPlan } from "@/lib/api";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
}

interface ChatStore {
  messages: ChatMessage[];
  pending: boolean;
  sendMessage: (text: string) => Promise<void>;
  previewPlan: (text: string) => Promise<void>;
  clear: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const formatPlan = (steps: { step: number; agent: string; required: boolean }[]) =>
  steps
    .map((s) => `${s.step}. ${s.agent}${s.required ? "" : " (optional)"}`)
    .join("\n");

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

  previewPlan: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const user: ChatMessage = {
      id: makeId(),
      role: "user",
      text: `Preview plan: ${trimmed}`,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    try {
      const plan = await getPlan(trimmed);
      const body = [
        `Goal: ${plan.goal}`,
        "",
        formatPlan(plan.steps),
        plan.fallback_rules.length
          ? "\nFallback rules:\n" +
            plan.fallback_rules.map((r) => `· ${r}`).join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const assistant: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: body,
        ts: Date.now(),
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
