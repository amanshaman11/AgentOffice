"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type LeftView = "offices" | "chat" | null;

interface UiStore {
  activeLeft: LeftView;
  rightOpen: boolean;
  setActiveLeft: (v: LeftView) => void;
  toggleLeft: (v: NonNullable<LeftView>) => void;
  setRightOpen: (v: boolean) => void;
  toggleRight: () => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      activeLeft: "offices",
      rightOpen: true,

      setActiveLeft: (v) => set({ activeLeft: v }),
      toggleLeft: (v) =>
        set({ activeLeft: get().activeLeft === v ? null : v }),

      setRightOpen: (v) => set({ rightOpen: v }),
      toggleRight: () => set({ rightOpen: !get().rightOpen }),
    }),
    {
      name: "agentoffice:ui:v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
