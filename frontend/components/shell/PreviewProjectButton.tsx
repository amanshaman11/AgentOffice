"use client";

import { useState } from "react";
import { Monitor, Loader2 } from "lucide-react";
import clsx from "clsx";
import { loadProjectPreview } from "@/lib/loadProjectPreview";

interface PreviewProjectButtonProps {
  researchId: number;
  className?: string;
  variant?: "neon" | "ghost";
}

export function PreviewProjectButton({
  researchId,
  className,
  variant = "neon",
}: PreviewProjectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const result = await loadProjectPreview(researchId);
    if (!result.ok) setError(result.error ?? "Failed to load preview");
    setLoading(false);
  };

  const baseClass = variant === "neon" ? "btn-neon" : "btn-ghost";

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={clsx(
          baseClass,
          "text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5",
          className,
        )}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Monitor size={14} />
        )}
        Preview again
      </button>
      {error && <span className="text-[10px] text-red-400 px-1">{error}</span>}
    </div>
  );
}
