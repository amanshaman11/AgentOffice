"use client";

import { PanelRightOpen } from "lucide-react";
import { useUiStore } from "@/lib/store/ui";

export function RightCollapsedTab() {
  const setRightOpen = useUiStore((s) => s.setRightOpen);

  return (
    <button
      onClick={() => setRightOpen(true)}
      aria-label="Open agents panel"
      title="Open agents panel"
      className="w-8 shrink-0 border-l border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex items-start justify-center pt-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
    >
      <PanelRightOpen size={16} />
    </button>
  );
}
