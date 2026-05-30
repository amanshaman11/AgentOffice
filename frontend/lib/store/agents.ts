"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ROLES, type OfficeType, type RoleId } from "@/lib/roles";

export interface Office {
  id: string;
  name: string;
  type: OfficeType;
}

export interface Agent {
  id: string;
  officeId: string;
  roleId: RoleId;
  name: string;
  createdAt: number;
}

export type RunPhase =
  | "idle"
  | "walking-to-stage"
  | "speaking"
  | "returning";

export interface RunStep {
  ts: number;
  agentId: string;
  roleId: RoleId;
  message: string;
  verdict?: "pass" | "revise";
}

export interface RunState {
  isRunning: boolean;
  activeAgentId: string | null;
  phase: RunPhase;
  log: RunStep[];
}

interface AgentStore {
  // Data
  offices: Office[];
  agents: Agent[];
  activeOfficeId: string;
  selectedAgentId: string | null;
  run: RunState;

  // Office ops
  addOffice: (name: string, type: OfficeType) => void;
  removeOffice: (id: string) => void;
  setActiveOffice: (id: string) => void;

  // Agent ops
  addAgent: (roleId: RoleId) => void;
  removeAgent: (id: string) => void;
  renameAgent: (id: string, name: string) => void;
  clearAgents: () => void;
  selectAgent: (id: string | null) => void;

  // Run ops
  setRun: (patch: Partial<RunState>) => void;
  appendLog: (step: RunStep) => void;
  resetRun: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const officeAId = "office-research-default";
const officeBId = "office-developer-default";

const initialOffices: Office[] = [
  { id: officeAId, name: "Research Office", type: "research" },
  { id: officeBId, name: "Dev Office", type: "developer" },
];

const initialRun: RunState = {
  isRunning: false,
  activeAgentId: null,
  phase: "idle",
  log: [],
};

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      offices: initialOffices,
      agents: [],
      activeOfficeId: officeAId,
      selectedAgentId: null,
      run: initialRun,

      addOffice: (name, type) =>
        set((s) => {
          const office: Office = { id: makeId(), name, type };
          return { offices: [...s.offices, office], activeOfficeId: office.id };
        }),

      removeOffice: (id) =>
        set((s) => {
          if (s.offices.length <= 1) return s;
          const offices = s.offices.filter((o) => o.id !== id);
          const agents = s.agents.filter((a) => a.officeId !== id);
          const activeOfficeId =
            s.activeOfficeId === id ? offices[0].id : s.activeOfficeId;
          return { offices, agents, activeOfficeId };
        }),

      setActiveOffice: (id) =>
        set({ activeOfficeId: id, selectedAgentId: null, run: initialRun }),

      addAgent: (roleId) =>
        set((s) => {
          const office = s.offices.find((o) => o.id === s.activeOfficeId);
          if (!office) return s;
          // Re-key counter on each add so the default name accumulates per office/role
          const existing = s.agents.filter(
            (a) => a.officeId === office.id && a.roleId === roleId,
          ).length;
          const base = ROLES[roleId].name;
          const name = existing === 0 ? base : `${base} ${existing + 1}`;
          const agent: Agent = {
            id: makeId(),
            officeId: office.id,
            roleId,
            name,
            createdAt: Date.now(),
          };
          return { agents: [...s.agents, agent] };
        }),

      removeAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          selectedAgentId:
            s.selectedAgentId === id ? null : s.selectedAgentId,
        })),

      renameAgent: (id, name) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === id ? { ...a, name: name.trim() || a.name } : a,
          ),
        })),

      clearAgents: () =>
        set((s) => ({
          agents: s.agents.filter((a) => a.officeId !== s.activeOfficeId),
          selectedAgentId: null,
          run: initialRun,
        })),

      selectAgent: (id) => set({ selectedAgentId: id }),

      setRun: (patch) => set((s) => ({ run: { ...s.run, ...patch } })),

      appendLog: (step) =>
        set((s) => ({ run: { ...s.run, log: [...s.run.log, step] } })),

      resetRun: () => set({ run: initialRun }),
    }),
    {
      name: "agentoffice:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        offices: s.offices,
        agents: s.agents,
        activeOfficeId: s.activeOfficeId,
      }),
    },
  ),
);

// Selectors
export const selectActiveOffice = (s: AgentStore) =>
  s.offices.find((o) => o.id === s.activeOfficeId) ?? s.offices[0];

export const selectActiveAgents = (s: AgentStore) =>
  s.agents.filter((a) => a.officeId === s.activeOfficeId);
