"use client";

import dynamic from "next/dynamic";
import { TopBar } from "@/components/shell/TopBar";
import { LeftRail } from "@/components/shell/LeftRail";
import { LeftSidebarSlot } from "@/components/shell/LeftSidebarSlot";
import { RightSidebarSlot } from "@/components/shell/RightSidebarSlot";
import { BottomHud } from "@/components/shell/BottomHud";
import { CodeWorkspace } from "@/components/shell/CodeWorkspace";
import { useUiStore } from "@/lib/store/ui";
import { useCodeStore } from "@/lib/store/code";

const RoomScene = dynamic(() => import("@/components/scene/RoomScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-dim)] text-sm">
      Initializing room…
    </div>
  ),
});

export default function Home() {
  const activeLeft = useUiStore((s) => s.activeLeft);
  const buildStatus = useCodeStore((s) => s.buildStatus);
  const showWorkspace =
    activeLeft === "code" &&
    (buildStatus === "ready" || buildStatus === "error" || buildStatus === "building");

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftRail />
        <LeftSidebarSlot />

        <main className="flex-1 relative min-w-0 transition-[flex] duration-300 ease-in-out flex">
          {showWorkspace ? (
            <CodeWorkspace />
          ) : (
            <>
              <RoomScene />
            </>
          )}
        </main>

        <RightSidebarSlot />
      </div>
      <BottomHud />
    </div>
  );
}
