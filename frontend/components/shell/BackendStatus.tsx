"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { getHealth } from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";

type Status = "checking" | "ok" | "no-key" | "offline";

const POLL_MS = 15_000;

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [label, setLabel] = useState("Checking backend…");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const h = await getHealth();
        if (cancelled) return;
        const apisReady = h.gemini_key === "set" && h.openai_key === "set";
        if (!apisReady) {
          setStatus("no-key");
          setLabel("Backend up · API key missing (Gemini and/or OpenAI)");
          return;
        }
        setStatus("ok");
        setLabel(
          h.vercel_token === "set"
            ? "Backend connected · APIs ready · Vercel ready"
            : "Backend connected · APIs ready · Vercel token missing",
        );
      } catch {
        if (cancelled) return;
        setStatus("offline");
        setLabel(`Backend offline (${BACKEND_URL})`);
      }
    }

    probe();
    const id = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const palette: Record<Status, string> = {
    checking: "var(--color-text-dim)",
    ok: "var(--color-neon-green)",
    "no-key": "var(--color-neon-amber)",
    offline: "var(--color-neon-pink)",
  };

  const color = palette[status];

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
