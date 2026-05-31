"use client";

import clsx from "clsx";
import { AgentRoster } from "@/components/shell/AgentRoster";
import { RightCollapsedTab } from "@/components/shell/RightCollapsedTab";
import { useUiStore } from "@/lib/store/ui";

const ROSTER_WIDTH = 288;
const COLLAPSED_WIDTH = 32;

export function RightSidebarSlot() {
  const rightOpen = useUiStore((s) => s.rightOpen);

  return (
    <div
      className="relative shrink-0 h-full min-h-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: rightOpen ? ROSTER_WIDTH : COLLAPSED_WIDTH }}
    >
      <div
        className={clsx(
          "absolute inset-y-0 right-0 w-72 transition-opacity duration-300 ease-in-out",
          rightOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      >
        <AgentRoster />
      </div>
      <div
        className={clsx(
          "absolute inset-y-0 right-0 w-8 transition-opacity duration-300 ease-in-out",
          rightOpen
            ? "opacity-0 pointer-events-none"
            : "opacity-100 pointer-events-auto",
        )}
      >
        <RightCollapsedTab />
      </div>
    </div>
  );
}
