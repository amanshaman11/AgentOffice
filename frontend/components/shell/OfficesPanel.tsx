"use client";

import { useState } from "react";
import {
  Plus,
  Building2,
  FlaskConical,
  Code2,
  X,
  Check,
} from "lucide-react";
import clsx from "clsx";
import { useAgentStore } from "@/lib/store/agents";
import type { OfficeType } from "@/lib/roles";

export function OfficesPanel() {
  const offices = useAgentStore((s) => s.offices);
  const agents = useAgentStore((s) => s.agents);
  const activeOfficeId = useAgentStore((s) => s.activeOfficeId);
  const setActiveOffice = useAgentStore((s) => s.setActiveOffice);
  const addOffice = useAgentStore((s) => s.addOffice);
  const removeOffice = useAgentStore((s) => s.removeOffice);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<OfficeType>("research");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    addOffice(name, newType);
    setNewName("");
    setNewType("research");
    setCreating(false);
  };

  return (
    <aside className="w-64 shrink-0 p-3 border-r border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)] px-1">
        <Building2 size={12} />
        Offices
      </div>

      {creating ? (
        <div className="panel-raised p-2 flex flex-col gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Office name"
            className="bg-[var(--color-bg-0)] border border-[var(--color-stroke)] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--color-neon-violet)]"
          />
          <div className="flex gap-1 p-1 bg-[var(--color-bg-0)] rounded-lg border border-[var(--color-stroke)]">
            {(["research", "developer"] as OfficeType[]).map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={clsx(
                  "flex-1 px-2 py-1 text-xs rounded-md capitalize transition",
                  newType === t
                    ? "bg-[var(--color-bg-2)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="btn-neon flex-1 justify-center"
            >
              <Check size={14} />
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="btn-ghost"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="btn-neon w-full justify-center"
        >
          <Plus size={14} />
          New Office
        </button>
      )}

      <div className="flex flex-col gap-2 mt-1">
        {offices.map((office) => {
          const Icon =
            office.type === "research" ? FlaskConical : Code2;
          const isActive = office.id === activeOfficeId;
          const count = agents.filter((a) => a.officeId === office.id).length;
          return (
            <div
              key={office.id}
              className={clsx(
                "panel px-3 py-3 group relative transition",
                isActive
                  ? "border-[color-mix(in_oklab,var(--color-neon-violet)_60%,transparent)] shadow-[var(--shadow-glow-violet)]"
                  : "hover:border-[var(--color-stroke-bright)]",
              )}
            >
              <button
                onClick={() => setActiveOffice(office.id)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    size={14}
                    className={
                      isActive
                        ? "text-[var(--color-neon-violet)]"
                        : "text-[var(--color-neon-cyan)]"
                    }
                  />
                  <span className="text-sm font-medium flex-1 truncate">
                    {office.name}
                  </span>
                  <span
                    className="status-dot"
                    style={{
                      background: isActive
                        ? "var(--color-neon-green)"
                        : "var(--color-text-dim)",
                      color: isActive
                        ? "var(--color-neon-green)"
                        : "var(--color-text-dim)",
                    }}
                  />
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] mt-1 ml-6">
                  {isActive ? "Active" : "Standby"} · {count} agents
                </div>
              </button>
              {offices.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Delete "${office.name}" and its ${count} agent(s)?`,
                      )
                    ) {
                      removeOffice(office.id);
                    }
                  }}
                  aria-label="Delete office"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[var(--color-text-dim)] hover:text-[var(--color-neon-pink)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
