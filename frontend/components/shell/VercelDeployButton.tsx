"use client";

import { useEffect, useState } from "react";
import { deployProject, getHealth } from "@/lib/api";
import { ExternalLink, Loader2, Rocket } from "lucide-react";
import clsx from "clsx";

interface VercelDeployButtonProps {
  researchId: number;
  disabled?: boolean;
}

export function VercelDeployButton({ researchId, disabled }: VercelDeployButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [vercelReady, setVercelReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setVercelReady(health.vercel_token === "set");
      })
      .catch(() => {
        if (!cancelled) setVercelReady(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setDeployedUrl(null);
    try {
      const result = await deployProject(researchId);
      setDeployedUrl(result.deployment_url);
      window.open(result.deployment_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading || vercelReady === false;

  return (
    <div className="flex items-center gap-2">
      {deployedUrl ? (
        <a
          href={deployedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:opacity-90 transition"
        >
          <ExternalLink size={12} />
          Open live site
        </a>
      ) : (
        <button
          type="button"
          onClick={handleDeploy}
          disabled={isDisabled}
          title={
            vercelReady === false
              ? "Add VERCEL_API_TOKEN to backend .env"
              : loading
                ? "Deploying… this takes ~30–60 s"
                : "Deploy to Vercel"
          }
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition",
            isDisabled
              ? "opacity-50 cursor-not-allowed bg-[var(--color-bg-2)] text-[var(--color-text-muted)]"
              : "bg-[var(--color-neon-violet)] text-white hover:opacity-90",
          )}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
          {loading ? "Deploying…" : "Deploy"}
        </button>
      )}
      {error && (
        <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
