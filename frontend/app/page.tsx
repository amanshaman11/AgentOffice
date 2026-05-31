"use client";

import dynamic from "next/dynamic";
import { TopBar } from "@/components/shell/TopBar";
import { LeftRail } from "@/components/shell/LeftRail";
import { LeftSidebarSlot } from "@/components/shell/LeftSidebarSlot";
import { RightSidebarSlot } from "@/components/shell/RightSidebarSlot";
import { BottomHud } from "@/components/shell/BottomHud";

const RoomScene = dynamic(() => import("@/components/scene/RoomScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-dim)] text-sm">
      Initializing room…
    </div>
  ),
});

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftRail />
        <LeftSidebarSlot />

        <main className="flex-1 relative min-w-0 transition-[flex] duration-300 ease-in-out">
          {/* Tagline overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
            <div className="text-[10px] tracking-[0.32em] text-[var(--color-text-dim)] uppercase">
              Build your
            </div>
            <div
              className="text-xl font-semibold tracking-[0.18em] text-[var(--color-neon-violet)]"
              style={{
                textShadow: "0 0 14px rgb(138 123 255 / 0.65)",
              }}
            >
              AI WORKFORCE
            </div>
          </div>

          <RoomScene />
        </main>

        <RightSidebarSlot />
      </div>
      <BottomHud />
    </div>
  );
}
