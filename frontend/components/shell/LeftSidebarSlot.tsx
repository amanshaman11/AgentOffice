"use client";

import { useEffect, useState } from "react";
import { OfficesPanel } from "@/components/shell/OfficesPanel";
import { GeminiChat } from "@/components/shell/GeminiChat";
import { Library } from "@/components/shell/Library";
import { useUiStore, type LeftView } from "@/lib/store/ui";

const LEFT_OPEN_WIDTH = 320;
const TRANSITION_MS = 300;

export function LeftSidebarSlot() {
  const activeLeft = useUiStore((s) => s.activeLeft);
  const [visiblePanel, setVisiblePanel] = useState<LeftView>(activeLeft);

  useEffect(() => {
    if (activeLeft) {
      setVisiblePanel(activeLeft);
      return;
    }
    const id = window.setTimeout(() => setVisiblePanel(null), TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [activeLeft]);

  const width = activeLeft ? LEFT_OPEN_WIDTH : 0;

  return (
    <div
      className="shrink-0 h-full min-h-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width }}
    >
      {visiblePanel === "offices" && <OfficesPanel />}
      {visiblePanel === "chat" && <GeminiChat />}
      {visiblePanel === "library" && <Library />}
    </div>
  );
}
