"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type LeftView = "offices" | "chat" | null;

interface UiStore {
  activeLeft: LeftView;
  rightOpen: boolean;
  chatFocusSignal: number;
  setActiveLeft: (v: LeftView) => void;
  toggleLeft: (v: NonNullable<LeftView>) => void;
  setRightOpen: (v: boolean) => void;
  toggleRight: () => void;
  focusChat: () => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      activeLeft: "offices",
      rightOpen: true,
      chatFocusSignal: 0,

      setActiveLeft: (v) => set({ activeLeft: v }),
      toggleLeft: (v) =>
        set({ activeLeft: get().activeLeft === v ? null : v }),

      setRightOpen: (v) => set({ rightOpen: v }),
      toggleRight: () => set({ rightOpen: !get().rightOpen }),
      focusChat: () =>
        set({
          activeLeft: "chat",
          chatFocusSignal: get().chatFocusSignal + 1,
        }),
    }),
    {
      name: "agentoffice:ui:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeLeft: s.activeLeft,
        rightOpen: s.rightOpen,
      }),
    },
  ),
);
