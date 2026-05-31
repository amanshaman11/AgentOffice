"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { getHealth } from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";

type Status = "checking" | "ok" | "no-key" | "offline";

const POLL_MS = 15_000;

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const h = await getHealth();
        if (cancelled) return;
        setStatus(
          h.gemini_key === "set" && h.openai_key === "set" ? "ok" : "no-key",
        );
      } catch {
        if (cancelled) return;
        setStatus("offline");
      }
    }

    probe();
    const id = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const palette: Record<Status, { color: string; label: string }> = {
    checking: { color: "var(--color-text-dim)", label: "Checking backend…" },
    ok: { color: "var(--color-neon-green)", label: "Backend connected · APIs ready" },
    "no-key": {
      color: "var(--color-neon-amber)",
      label: "Backend up · API key missing (Gemini and/or OpenAI)",
    },
    offline: {
      color: "var(--color-neon-pink)",
      label: `Backend offline (${BACKEND_URL})`,
    },
  };

  const { color, label } = palette[status];

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <Activity
        size={14}
        style={{
          color,
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />
      <span className="text-[var(--color-text-primary)]">System Status</span>
      <span className="text-[var(--color-text-dim)]">·</span>
      <span>{label}</span>
    </div>
  );
}
