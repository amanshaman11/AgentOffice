"use client";

import { create } from "zustand";
import type { RoleId } from "@/lib/roles";

export interface Agent {
  id: string;
  roleId: RoleId;
  createdAt: number;
}

interface AgentStore {
  agents: Agent[];
  addAgent: (roleId: RoleId) => void;
  removeAgent: (id: string) => void;
  clear: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  addAgent: (roleId) =>
    set((s) => ({
      agents: [...s.agents, { id: makeId(), roleId, createdAt: Date.now() }],
    })),
  removeAgent: (id) =>
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  clear: () => set({ agents: [] }),
}));
