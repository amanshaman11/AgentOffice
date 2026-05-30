"use client";

import { useEffect, useState } from "react";
import { Plus, Activity } from "lucide-react";

export function BottomHud() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_70%,transparent)] backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Activity
          size={14}
          className="text-[var(--color-neon-green)]"
          style={{ filter: "drop-shadow(0 0 6px var(--color-neon-green))" }}
        />
        <span className="text-[var(--color-text-primary)]">System Status</span>
        <span className="text-[var(--color-text-dim)]">·</span>
        <span>All systems operational</span>
      </div>

      <button className="btn-neon">
        <Plus size={14} />
        Create New Office
      </button>

      <div className="text-xs font-mono text-[var(--color-text-muted)]">
        {time || "--:--"}
      </div>
    </footer>
  );
}
