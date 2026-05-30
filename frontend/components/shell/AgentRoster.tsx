"use client";

import { useState } from "react";
import { Plus, X, Users } from "lucide-react";
import clsx from "clsx";
import { ROLES, ROLE_LIST, type RoleId, type OfficeType } from "@/lib/roles";
import { useAgentStore } from "@/lib/store/agents";

export function AgentRoster() {
  const agents = useAgentStore((s) => s.agents);
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const clear = useAgentStore((s) => s.clear);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [officeFilter, setOfficeFilter] = useState<OfficeType>("research");

  const handleAdd = (roleId: RoleId) => {
    addAgent(roleId);
    setPickerOpen(false);
  };

  const visibleRoles = ROLE_LIST.filter((r) => r.office === officeFilter);

  return (
    <aside className="w-72 shrink-0 p-3 border-l border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)] px-1">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          Agents · {agents.length}
        </span>
        {agents.length > 0 && (
          <button
            onClick={clear}
            className="text-[10px] hover:text-[var(--color-text-primary)] transition"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="btn-neon w-full justify-center"
        >
          <Plus size={14} />
          Add Agent
        </button>

        {pickerOpen && (
          <div className="absolute z-20 top-full mt-2 left-0 right-0 panel-raised p-2 shadow-xl">
            <div className="flex gap-1 mb-2 p-1 bg-[var(--color-bg-0)] rounded-lg border border-[var(--color-stroke)]">
              {(["research", "developer"] as OfficeType[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOfficeFilter(o)}
                  className={clsx(
                    "flex-1 px-2 py-1 text-xs rounded-md capitalize transition",
                    officeFilter === o
                      ? "bg-[var(--color-bg-2)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              {visibleRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleAdd(role.id)}
                  className="flex items-start gap-2 p-2 rounded-md text-left hover:bg-[var(--color-bg-2)] transition group"
                >
                  <span
                    className="status-dot mt-1.5 shrink-0"
                    style={{
                      background: role.color,
                      color: role.color,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{role.name}</div>
                    <div className="text-[11px] text-[var(--color-text-dim)] leading-snug">
                      {role.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto pr-1">
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
            return (
              <div
                key={a.id}
                className="panel flex items-center gap-2 px-3 py-2 group"
              >
                <span
                  className="status-dot shrink-0"
                  style={{ background: role.color, color: role.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {role.name}{" "}
                    <span className="text-[var(--color-text-dim)] text-xs">
                      #{i + 1}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-dim)] truncate">
                    {role.description}
                  </div>
                </div>
                <button
                  onClick={() => removeAgent(a.id)}
                  aria-label="Remove agent"
                  className="opacity-0 group-hover:opacity-100 transition text-[var(--color-text-dim)] hover:text-[var(--color-neon-pink)]"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
