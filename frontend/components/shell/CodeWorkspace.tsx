"use client";

import { useEffect, useState } from "react";
import { useCodeStore } from "@/lib/store/code";
import { VercelDeployButton } from "@/components/shell/VercelDeployButton";
import { Monitor, Code, Loader2 } from "lucide-react";
import clsx from "clsx";

type Tab = "code" | "preview";

function getLanguageClass(language: string): string {
  const map: Record<string, string> = {
    typescript: "language-typescript",
    javascript: "language-javascript",
    tsx: "language-tsx",
    jsx: "language-jsx",
    python: "language-python",
    css: "language-css",
    html: "language-html",
    json: "language-json",
    markdown: "language-markdown",
    yaml: "language-yaml",
    toml: "language-toml",
    shell: "language-shell",
    bash: "language-bash",
  };
  return map[language?.toLowerCase()] ?? "";
}

function CodeViewer({ content, language }: { content: string; language: string }) {
  return (
    <pre
      className={clsx(
        "h-full overflow-auto p-4 text-xs leading-relaxed font-mono",
        "bg-[#0d0d14] text-[#c9d1d9]",
        getLanguageClass(language),
      )}
    >
      <code>{content}</code>
    </pre>
  );
}

function PreviewPane({ previewUrl }: { previewUrl: string | null }) {
  if (!previewUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-neon-violet)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Starting preview environment…
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={previewUrl}
      className="flex-1 w-full border-0 bg-white"
      title="Project preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
    />
  );
}

export function CodeWorkspace() {
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const files = useCodeStore((s) => s.files);
  const activeFilePath = useCodeStore((s) => s.activeFilePath);
  const previewUrl = useCodeStore((s) => s.previewUrl);
  const buildStatus = useCodeStore((s) => s.buildStatus);
  const researchId = useCodeStore((s) => s.researchId);

  useEffect(() => {
    if (previewUrl) setActiveTab("preview");
  }, [previewUrl]);

  const activeFile = files.find((f) => f.path === activeFilePath) ?? files[0] ?? null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "code", label: "Code", icon: <Code size={14} /> },
    { id: "preview", label: "Preview", icon: <Monitor size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0d0d14]">
      <div
        className="flex items-center gap-0 border-b shrink-0"
        style={{ borderColor: "var(--color-stroke)", background: "var(--color-bg-1)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs border-b-2 transition",
              activeTab === tab.id
                ? "border-[var(--color-neon-violet)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {activeTab === "preview" && previewUrl && researchId != null ? (
          <div className="ml-auto mr-4">
            <VercelDeployButton researchId={researchId} />
          </div>
        ) : activeFile ? (
          <span className="ml-auto mr-4 text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">
            {activeFile.path}
          </span>
        ) : null}
        {buildStatus === "building" && (
          <div className="flex items-center gap-1.5 mr-4 text-xs text-[var(--color-neon-violet)]">
            <Loader2 size={12} className="animate-spin" />
            Building…
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "code" ? (
          activeFile ? (
            <CodeViewer content={activeFile.content} language={activeFile.language} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
              No file selected
            </div>
          )
        ) : (
          <PreviewPane previewUrl={previewUrl} />
        )}
      </div>
    </div>
  );
}
