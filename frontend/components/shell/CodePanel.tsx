"use client";

import { useCodeStore } from "@/lib/store/code";
import { BACKEND_URL } from "@/lib/config";
import {
  ChevronRight,
  File,
  Folder,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import clsx from "clsx";

function buildTree(files: { path: string }[]) {
  const tree: Record<string, string[]> = {};
  const rootFiles: string[] = [];
  for (const { path } of files) {
    const parts = path.split("/");
    if (parts.length === 1) {
      rootFiles.push(path);
    } else {
      const dir = parts.slice(0, -1).join("/");
      tree[dir] = tree[dir] ?? [];
      tree[dir].push(path);
    }
  }
  return { tree, rootFiles };
}

function AgentBadge({ agent, status, message }: { agent: string; status: string; message?: string }) {
  const icon =
    status === "running" ? (
      <Loader2 size={12} className="animate-spin text-[var(--color-neon-violet)]" />
    ) : status === "done" ? (
      <CheckCircle2 size={12} className="text-emerald-400" />
    ) : (
      <XCircle size={12} className="text-red-400" />
    );

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ background: "var(--color-bg-2)" }}>
      {icon}
      <span className="capitalize text-[var(--color-text-primary)]">{agent}</span>
      {message && <span className="text-[var(--color-text-muted)] truncate max-w-[140px]">{message}</span>}
    </div>
  );
}

export function CodePanel() {
  const files = useCodeStore((s) => s.files);
  const activeFilePath = useCodeStore((s) => s.activeFilePath);
  const buildStatus = useCodeStore((s) => s.buildStatus);
  const researchId = useCodeStore((s) => s.researchId);
  const agentProgress = useCodeStore((s) => s.agentProgress);
  const setActiveFilePath = useCodeStore((s) => s.setActiveFilePath);

  const { tree, rootFiles } = buildTree(files);
  const dirs = Object.keys(tree).sort();

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[var(--color-bg-1)] border-r border-[var(--color-stroke)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-stroke)] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Project Files
        </span>
        {researchId && (
          <a
            href={`${BACKEND_URL}/api/export/zip/${researchId}`}
            download
            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition"
            style={{ background: "var(--color-neon-violet)", color: "#fff" }}
          >
            <Download size={12} />
            Download
          </a>
        )}
      </div>

      {buildStatus === "building" && agentProgress.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--color-stroke)] flex flex-col gap-1 shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            Building…
          </p>
          {agentProgress.map((p) => (
            <AgentBadge key={p.agent} {...p} />
          ))}
        </div>
      )}

      {buildStatus === "idle" && files.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <Clock size={28} className="text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Start a SaaS project from the Dev Office to see files here.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {rootFiles.map((path) => (
          <FileRow
            key={path}
            path={path}
            label={path}
            active={activeFilePath === path}
            onClick={() => setActiveFilePath(path)}
          />
        ))}
        {dirs.map((dir) => (
          <DirGroup
            key={dir}
            dir={dir}
            paths={tree[dir]}
            activeFilePath={activeFilePath}
            onSelect={setActiveFilePath}
          />
        ))}
      </div>
    </div>
  );
}

function FileRow({
  path,
  label,
  active,
  onClick,
  indent = 0,
}: {
  path: string;
  label: string;
  active: boolean;
  onClick: () => void;
  indent?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={path}
      className={clsx(
        "w-full flex items-center gap-1.5 px-3 py-1 text-xs text-left transition truncate",
        active
          ? "bg-[color-mix(in_oklab,var(--color-neon-violet)_18%,transparent)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text-primary)]",
      )}
      style={{ paddingLeft: `${12 + indent * 12}px` }}
    >
      <File size={12} className="shrink-0" />
      <span className="truncate">{label.split("/").pop()}</span>
    </button>
  );
}

function DirGroup({
  dir,
  paths,
  activeFilePath,
  onSelect,
}: {
  dir: string;
  paths: string[];
  activeFilePath: string | null;
  onSelect: (p: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1 px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        <Folder size={11} className="shrink-0" />
        <span className="truncate">{dir}</span>
      </div>
      {paths.map((path) => (
        <FileRow
          key={path}
          path={path}
          label={path}
          active={activeFilePath === path}
          onClick={() => onSelect(path)}
          indent={1}
        />
      ))}
    </>
  );
}
