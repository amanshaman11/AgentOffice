"use client";

import { create } from "zustand";

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export type BuildStatus = "idle" | "building" | "ready" | "error";

export interface AgentProgress {
  agent: string;
  status: "running" | "done" | "failed";
  message?: string;
}

interface CodeStore {
  files: CodeFile[];
  activeFilePath: string | null;
  buildStatus: BuildStatus;
  researchId: number | null;
  agentProgress: AgentProgress[];
  previewUrl: string | null;
  setupInstructions: string;

  setFiles: (files: CodeFile[]) => void;
  setActiveFilePath: (path: string | null) => void;
  setBuildStatus: (status: BuildStatus) => void;
  setResearchId: (id: number | null) => void;
  upsertAgentProgress: (progress: AgentProgress) => void;
  setPreviewUrl: (url: string | null) => void;
  setSetupInstructions: (instructions: string) => void;
  reset: () => void;
}

const initialState = {
  files: [],
  activeFilePath: null,
  buildStatus: "idle" as BuildStatus,
  researchId: null,
  agentProgress: [],
  previewUrl: null,
  setupInstructions: "",
};

export const useCodeStore = create<CodeStore>()((set, get) => ({
  ...initialState,

  setFiles: (files) =>
    set({ files, activeFilePath: files[0]?.path ?? get().activeFilePath }),

  setActiveFilePath: (path) => set({ activeFilePath: path }),

  setBuildStatus: (buildStatus) => set({ buildStatus }),

  setResearchId: (researchId) => set({ researchId }),

  upsertAgentProgress: (progress) =>
    set((s) => {
      const existing = s.agentProgress.findIndex((p) => p.agent === progress.agent);
      if (existing >= 0) {
        const updated = [...s.agentProgress];
        updated[existing] = progress;
        return { agentProgress: updated };
      }
      return { agentProgress: [...s.agentProgress, progress] };
    }),

  setPreviewUrl: (previewUrl) => set({ previewUrl }),

  setSetupInstructions: (setupInstructions) => set({ setupInstructions }),

  reset: () => set(initialState),
}));
