"use client";

import Image from "next/image";
import { Bell, User } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_70%,transparent)] backdrop-blur-md">
      <div className="flex items-center">
        <Image src="/agent_office.png" alt="Agent Office" width={150} height={38} priority />
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="p-2 rounded-lg border border-[var(--color-stroke)] hover:border-[var(--color-stroke-bright)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
        >
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2 panel px-3 py-1.5">
          <div className="w-7 h-7 rounded-full bg-[var(--color-bg-3)] flex items-center justify-center">
            <User size={14} className="text-[var(--color-neon-cyan)]" />
          </div>
          <div className="leading-tight">
            <div className="text-xs">User</div>
            <div className="text-[10px] text-[var(--color-text-dim)]">Pro Plan</div>
          </div>
        </div>
      </div>
    </header>
  );
}
