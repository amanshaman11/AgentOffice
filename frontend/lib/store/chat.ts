"use client";

import { create } from "zustand";

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
  sendMessage: (text: string) => void;
  clear: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  pending: false,

  sendMessage: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const user: ChatMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, user], pending: true }));

    // Placeholder echo until the backend is wired up.
    setTimeout(() => {
      const reply: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text:
          "Gemini backend isn't connected yet. Once your teammate wires up the FastAPI endpoint, replies will stream here.",
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, reply], pending: false }));
    }, 450);
  },

  clear: () => set({ messages: [], pending: false }),
}));
