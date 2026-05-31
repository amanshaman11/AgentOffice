"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  X,
  Users,
  Pencil,
  Check,
  PanelRightClose,
  MessageSquare,
  Square,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import {
  ROLES,
  ROLE_LIST,
  type RoleId,
  type OfficeType,
} from "@/lib/roles";
import { useShallow } from "zustand/shallow";
import {
  useAgentStore,
  selectActiveAgents,
  selectActiveOffice,
} from "@/lib/store/agents";
import { stopRun } from "@/lib/runner";
import { useUiStore } from "@/lib/store/ui";

export function AgentRoster() {
  const office = useAgentStore(selectActiveOffice);
  const agents = useAgentStore(useShallow(selectActiveAgents));
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const renameAgent = useAgentStore((s) => s.renameAgent);
  const clearAgents = useAgentStore((s) => s.clearAgents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const run = useAgentStore((s) => s.run);
  const setRightOpen = useUiStore((s) => s.setRightOpen);
  const focusChat = useUiStore((s) => s.focusChat);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleAdd = (roleId: RoleId) => {
    addAgent(roleId);
    setPickerOpen(false);
  };

  const beginEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditValue(current);
  };
  const commitEdit = () => {
    if (editingId) renameAgent(editingId, editValue);
    setEditingId(null);
  };

  const roleGroups: { label: string; office: OfficeType }[] = [
    { label: "Research Office", office: "research" },
    { label: "Developer Office", office: "developer" },
  ];

  const isDevOffice = office.type === "developer";
  const canRun = !run.isRunning && agents.length > 0 && !isDevOffice;

  const handleRun = () => {
    if (run.isRunning) {
      stopRun();
    } else {
      focusChat();
    }
  };

  return (
    <aside className="w-full h-full shrink-0 p-3 border-l border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)] px-1">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          {office.name}
        </span>
        <div className="flex items-center gap-2">
          <span className="normal-case tracking-normal">
            {agents.length} agents
          </span>
          <button
            onClick={() => setRightOpen(false)}
            aria-label="Close panel"
            className="p-1 -mr-1 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition"
          >
            <PanelRightClose size={13} />
          </button>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="btn-neon w-full justify-center"
          disabled={run.isRunning}
        >
          <Plus size={14} />
          Add Agent
        </button>

        {pickerOpen && (
          <div className="absolute z-20 top-full mt-2 left-0 right-0 panel-raised p-2 shadow-xl">
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              {roleGroups.map(({ label, office: groupOffice }) => {
                const roles = ROLE_LIST.filter((r) => r.office === groupOffice);
                return (
                  <div key={groupOffice}>
                    <div className="sticky top-0 z-10 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] bg-[var(--color-bg-1)] border-b border-[var(--color-stroke)]">
                      {label}
                    </div>
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => handleAdd(role.id)}
                        style={{ "--role-color": role.color } as React.CSSProperties}
                        className="group flex items-start gap-2 p-2 rounded-md text-left w-full transition-all duration-150 border border-transparent hover:cursor-pointer hover:border-[color-mix(in_oklab,var(--role-color)_45%,transparent)] hover:bg-[color-mix(in_oklab,var(--role-color)_16%,transparent)] hover:shadow-[0_0_14px_color-mix(in_oklab,var(--role-color)_35%,transparent)]"
                      >
                        <span
                          className="status-dot mt-1.5 shrink-0 transition-transform duration-150 group-hover:scale-125"
                          style={{ background: role.color, color: role.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium transition-colors duration-150 group-hover:text-[var(--role-color)]">
                            {role.name}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-dim)] leading-snug transition-colors duration-150 group-hover:text-[var(--color-text-muted)]">
                            {role.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isDevOffice && (
        <div className="panel px-3 py-2 text-[11px] text-[var(--color-text-dim)] text-center leading-snug">
          Developer workflows coming soon.
          <br />
          Switch to Research Office to run.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRun}
          className="btn-neon flex-1 justify-center"
          disabled={!run.isRunning && !canRun}
          style={
            run.isRunning
              ? {
                  borderColor:
                    "color-mix(in oklab, var(--color-neon-pink) 50%, transparent)",
                  background:
                    "color-mix(in oklab, var(--color-neon-pink) 14%, transparent)",
                }
              : undefined
          }
          title={
            run.isRunning
              ? "Stop current run"
              : agents.length === 0
                ? "Add agents to your office first"
                : isDevOffice
                  ? "Developer office not yet supported"
                  : "Open chat to send a query"
          }
        >
          {run.isRunning ? (
            <>
              <Square size={14} />
              Stop
            </>
          ) : (
            <>
              <MessageSquare size={14} />
              Run via Chat
            </>
          )}
        </button>
        {agents.length > 0 && !run.isRunning && (
          <button
            onClick={clearAgents}
            className="btn-ghost"
            aria-label="Clear all agents"
          >
            Clear
          </button>
        )}
      </div>

      {/* Roster */}
      <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto pr-1 max-h-[40%]">
        {agents.length === 0 ? (
          <div className="panel p-4 text-center">
            <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              The room is empty.
              <br />
              Add an agent to begin.
            </div>
          </div>
        ) : (
          agents.map((a, i) => {
            const role = ROLES[a.roleId];
            const isSelected = selectedAgentId === a.id;
            const isActive = run.activeAgentId === a.id;
            return (
              <div
                key={a.id}
                onClick={() => selectAgent(isSelected ? null : a.id)}
                className={clsx(
                  "panel flex items-center gap-2 px-2.5 py-2 group cursor-pointer transition",
                  isSelected &&
                    "border-[color-mix(in_oklab,var(--color-neon-violet)_60%,transparent)]",
                  isActive &&
                    "shadow-[0_0_18px_color-mix(in_oklab,var(--color-neon-cyan)_55%,transparent)]",
                )}
              >
                <div
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold leading-none"
                  style={{
                    background: `color-mix(in oklab, ${role.color} 18%, transparent)`,
                    color: role.color,
                    border: `1px solid color-mix(in oklab, ${role.color} 40%, transparent)`,
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === a.id ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[var(--color-bg-0)] border border-[var(--color-stroke)] rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-[var(--color-neon-violet)]"
                    />
                  ) : (
                    <div className="text-sm font-medium truncate">{a.name}</div>
                  )}
                  <div className="text-[10px] text-[var(--color-text-dim)] truncate">
                    {role.name} · {role.description}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editingId === a.id
                        ? commitEdit()
                        : beginEdit(a.id, a.name);
                    }}
                    aria-label="Rename agent"
                    className="text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]"
                  >
                    {editingId === a.id ? (
                      <Check size={14} />
                    ) : (
                      <Pencil size={12} />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAgent(a.id);
                    }}
                    aria-label="Remove agent"
                    disabled={run.isRunning}
                    className="text-[var(--color-text-dim)] hover:text-[var(--color-neon-pink)] disabled:opacity-40"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Activity log */}
      <ActivityLog />
    </aside>
  );
}

function ActivityLog() {
  const log = useAgentStore((s) => s.run.log);
  const isRunning = useAgentStore((s) => s.run.isRunning);
  const agents = useAgentStore((s) => s.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log.length]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 pt-2 border-t border-[var(--color-stroke)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)] px-1">
        {isRunning ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <span className="status-dot" style={{ background: "var(--color-text-dim)", color: "var(--color-text-dim)" }} />
        )}
        Activity Log
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1"
      >
        {log.length === 0 ? (
          <div className="text-[11px] text-[var(--color-text-dim)] px-1 py-2">
            No activity yet. Open <span className="text-[var(--color-text-muted)]">Chat</span> and send a query.
          </div>
        ) : (
          log.map((step, idx) => {
            const agent = agents.find((a) => a.id === step.agentId);
            const role = agent
              ? ROLES[agent.roleId]
              : step.roleId
                ? ROLES[step.roleId]
                : null;
            const isSystem = step.agentId.startsWith("_system");
            const isMissing = step.agentId.startsWith("_missing");

            if (isSystem) {
              return (
                <div
                  key={idx}
                  className="text-[11px] text-[var(--color-text-dim)] italic px-2 py-1"
                >
                  {step.message}
                </div>
              );
            }

            const name = isMissing
              ? `${role?.name ?? "Agent"} (not in room)`
              : (agent?.name ?? role?.name ?? "Agent");

            return (
              <div
                key={idx}
                className="panel px-2.5 py-1.5 text-[11px] leading-snug"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="status-dot shrink-0"
                    style={{
                      background: role?.color ?? "#888",
                      color: role?.color ?? "#888",
                    }}
                  />
                  <span className="font-medium truncate">{name}</span>
                  {step.verdict && (
                    <span
                      className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        color:
                          step.verdict === "pass"
                            ? "var(--color-neon-green)"
                            : "var(--color-neon-pink)",
                        background:
                          step.verdict === "pass"
                            ? "color-mix(in oklab, var(--color-neon-green) 15%, transparent)"
                            : "color-mix(in oklab, var(--color-neon-pink) 15%, transparent)",
                      }}
                    >
                      {step.verdict}
                    </span>
                  )}
                </div>
                <div className="text-[var(--color-text-muted)] mt-0.5 whitespace-pre-wrap break-words">
                  {step.message}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
