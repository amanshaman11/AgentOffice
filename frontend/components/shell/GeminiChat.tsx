"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  PanelLeftClose,
  CornerDownLeft,
} from "lucide-react";
import clsx from "clsx";
import { useChatStore } from "@/lib/store/chat";
import { useUiStore } from "@/lib/store/ui";

export function GeminiChat() {
  const messages = useChatStore((s) => s.messages);
  const pending = useChatStore((s) => s.pending);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clear = useChatStore((s) => s.clear);
  const setActiveLeft = useUiStore((s) => s.setActiveLeft);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, pending]);

  const handleSend = () => {
    if (!draft.trim() || pending) return;
    sendMessage(draft);
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

  return (
    <aside className="w-80 shrink-0 border-r border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-stroke)] flex items-center gap-2">
        <Sparkles
          size={14}
          className="text-[var(--color-neon-violet)]"
          style={{ filter: "drop-shadow(0 0 6px var(--color-neon-violet))" }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Gemini</div>
          <div className="text-[10px] text-[var(--color-text-dim)]">
            gemini-1.5-flash · not connected
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

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2.5"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => <Bubble key={m.id} role={m.role} text={m.text} />)
        )}
        {pending && <Bubble role="assistant" text="…" pulsing />}
      </div>

      {/* Composer */}
      <div className="p-2.5 border-t border-[var(--color-stroke)]">
        <div className="panel-raised p-2 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask Gemini…"
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-[var(--color-text-dim)] focus:outline-none max-h-[140px]"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || pending}
            className="btn-neon !py-1.5 !px-2.5 disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-[var(--color-text-dim)]">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={10} />
            Enter to send · Shift+Enter newline
          </span>
          <span>{draft.length}</span>
        </div>
      </div>
    </aside>
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
        Chat with Gemini
      </div>
      <div className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Ask anything — research questions, code, ideas.
        <br />
        Backend wiring comes next.
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
  return (
    <div
      className={clsx(
        "flex",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed border whitespace-pre-wrap break-words",
          isUser
            ? "bg-[color-mix(in_oklab,var(--color-neon-violet)_18%,transparent)] border-[color-mix(in_oklab,var(--color-neon-violet)_40%,transparent)] text-[var(--color-text-primary)]"
            : "bg-[var(--color-bg-2)] border-[var(--color-stroke)] text-[var(--color-text-primary)]",
          pulsing && "animate-pulse",
        )}
      >
        {text}
      </div>
    </div>
  );
}
