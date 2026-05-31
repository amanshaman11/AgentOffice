"use client";

import { useEffect, useState } from "react";
import { BackendStatus } from "./BackendStatus";

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
      <BackendStatus />

      <div className="text-xs font-mono text-[var(--color-text-muted)]">
        {time || "--:--"}
      </div>
    </footer>
  );
}
