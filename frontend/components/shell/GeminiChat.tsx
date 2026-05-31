"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  PanelLeftClose,
  CornerDownLeft,
  Wand2,
  Check,
  Download,
  Package,
} from "lucide-react";
import clsx from "clsx";
import { useChatStore, type ChatMessage } from "@/lib/store/chat";
import { useUiStore } from "@/lib/store/ui";
import { useAgentStore } from "@/lib/store/agents";
import { BACKEND_URL, GEMINI_MODEL_LABEL } from "@/lib/config";
import { ROLES, type RoleId } from "@/lib/roles";

export function GeminiChat() {
  const messages = useChatStore((s) => s.messages);
  const pending = useChatStore((s) => s.pending);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const suggestWorkflow = useChatStore((s) => s.suggestWorkflow);
  const clear = useChatStore((s) => s.clear);
  const setActiveLeft = useUiStore((s) => s.setActiveLeft);
  const focusSignal = useUiStore((s) => s.chatFocusSignal);
  const isRunning = useAgentStore((s) => s.run.isRunning);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, pending]);

  useEffect(() => {
    if (focusSignal > 0) textareaRef.current?.focus();
  }, [focusSignal]);

  const handleSend = () => {
    if (!draft.trim() || pending || isRunning) return;
    sendMessage(draft);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSuggest = () => {
    if (!draft.trim() || pending || isRunning) return;
    suggestWorkflow(draft);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const busy = pending || isRunning;
  const disabled = !draft.trim() || busy;

  return (
    <aside className="w-full h-full shrink-0 border-r border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col min-h-0">
      <div className="px-3 py-2.5 border-b border-[var(--color-stroke)] flex items-center gap-2">
        <Sparkles
          size={14}
          className="text-[var(--color-neon-violet)]"
          style={{ filter: "drop-shadow(0 0 6px var(--color-neon-violet))" }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Gemini Office Chat</div>
          <div className="text-[10px] text-[var(--color-text-dim)]">
            {GEMINI_MODEL_LABEL} · runs the active office
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            aria-label="Clear chat"
            className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-neon-pink)] transition"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={() => setActiveLeft(null)}
          aria-label="Close panel"
          className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2.5"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => <MessageItem key={m.id} message={m} />)
        )}
        {busy && <Bubble role="assistant" text="…" pulsing />}
      </div>

      <div className="p-2.5 border-t border-[var(--color-stroke)]">
        <div className="panel-raised p-2 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe your SaaS idea or research question…"
            disabled={busy}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-[var(--color-text-dim)] focus:outline-none max-h-[140px] disabled:opacity-50"
          />
          <button
            onClick={handleSuggest}
            disabled={disabled}
            className="btn-ghost !py-1.5 !px-2.5 disabled:opacity-40"
            aria-label="Suggest workflow"
            title="Suggest workflow (no run)"
          >
            <Wand2 size={14} />
          </button>
          <button
            onClick={handleSend}
            disabled={disabled}
            className="btn-neon !py-1.5 !px-2.5 disabled:opacity-40"
            aria-label="Send"
            title="Send & run office"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-[var(--color-text-dim)]">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={10} />
            Enter to run · Wand = suggest workflow
          </span>
          <span>{draft.length}</span>
        </div>
      </div>
    </aside>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.developerMeta) {
    return (
      <div className="flex flex-col gap-2">
        <Bubble role={message.role} text={message.text} />
        <DeveloperRunActions meta={message.developerMeta} />
      </div>
    );
  }
  if (!message.suggestedAgents) {
    return <Bubble role={message.role} text={message.text} />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Bubble role={message.role} text={message.text} />
      <ApplyWorkflowButton agents={message.suggestedAgents} />
    </div>
  );
}

function DeveloperRunActions({
  meta,
}: {
  meta: NonNullable<ChatMessage["developerMeta"]>;
}) {
  if (!meta.zipUrl && meta.filePaths.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-start px-1">
      {meta.zipUrl && (
        <a
          href={meta.zipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neon text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5"
        >
          <Package size={14} />
          Download project (.zip)
        </a>
      )}
      {meta.researchId != null && (
        <a
          href={`${BACKEND_URL}/api/projects/${meta.researchId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5"
        >
          <Download size={14} />
          Project manifest
        </a>
      )}
    </div>
  );
}

function ApplyWorkflowButton({ agents }: { agents: string[] }) {
  const [applied, setApplied] = useState(false);
  const clearAgents = useAgentStore((s) => s.clearAgents);
  const addAgent = useAgentStore((s) => s.addAgent);
  const isRunning = useAgentStore((s) => s.run.isRunning);

  const validAgents = agents.filter((a) => a in ROLES);

  const handleApply = () => {
    if (isRunning || validAgents.length === 0) return;
    clearAgents();
    for (const roleId of validAgents) {
      addAgent(roleId as RoleId);
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  if (validAgents.length === 0) return null;

  return (
    <div className="flex justify-start">
      <button
        onClick={handleApply}
        disabled={isRunning || applied}
        className={clsx(
          "btn-ghost text-[11px] !py-1 !px-2.5 flex items-center gap-1.5 transition",
          applied && "text-[var(--color-neon-green)]",
        )}
      >
        {applied ? (
          <>
            <Check size={12} />
            Applied
          </>
        ) : (
          <>
            <Sparkles size={12} />
            Apply to office
          </>
        )}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel p-4 text-center mt-2">
      <Sparkles
        size={20}
        className="text-[var(--color-neon-violet)] mx-auto mb-2"
        style={{ filter: "drop-shadow(0 0 8px var(--color-neon-violet))" }}
      />
      <div className="text-sm text-[var(--color-text-primary)] mb-1">
        Run the office with a query
      </div>
      <div className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Type a research question and hit Send.
        <br />
        Use the wand to get an AI workflow suggestion.
      </div>
    </div>
  );
}

function Bubble({
  role,
  text,
  pulsing,
}: {
  role: "user" | "assistant" | "system";
  text: string;
  pulsing?: boolean;
}) {
  const isUser = role === "user";
  const isSystem = role === "system";
  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed border whitespace-pre-wrap break-words",
          isUser &&
            "bg-[color-mix(in_oklab,var(--color-neon-violet)_18%,transparent)] border-[color-mix(in_oklab,var(--color-neon-violet)_40%,transparent)] text-[var(--color-text-primary)]",
          isSystem &&
            "bg-transparent border-[color-mix(in_oklab,var(--color-neon-pink)_40%,transparent)] text-[var(--color-neon-pink)] italic",
          !isUser &&
            !isSystem &&
            "bg-[var(--color-bg-2)] border-[var(--color-stroke)] text-[var(--color-text-primary)]",
          pulsing && "animate-pulse",
        )}
      >
        {text}
      </div>
    </div>
  );
}
