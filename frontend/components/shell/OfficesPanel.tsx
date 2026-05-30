"use client";

import { Plus, Building2, FlaskConical, Code2 } from "lucide-react";

interface OfficeCardProps {
  name: string;
  type: "research" | "developer";
  status: "active" | "standby";
  active?: boolean;
}

function OfficeCard({ name, type, status, active }: OfficeCardProps) {
  const Icon = type === "research" ? FlaskConical : Code2;
  const dotColor =
    status === "active" ? "var(--color-neon-green)" : "var(--color-text-dim)";

  return (
    <button
      className={`w-full text-left panel px-3 py-3 transition hover:border-[var(--color-stroke-bright)] ${
        active
          ? "border-[color-mix(in_oklab,var(--color-neon-violet)_60%,transparent)] shadow-[var(--shadow-glow-violet)]"
          : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-[var(--color-neon-cyan)]" />
        <span className="text-sm font-medium flex-1">{name}</span>
        <span
          className="status-dot"
          style={{ background: dotColor, color: dotColor }}
        />
      </div>
      <div className="text-[11px] text-[var(--color-text-dim)] mt-1 capitalize ml-6">
        {status}
      </div>
    </button>
  );
}

export function OfficesPanel() {
  return (
    <aside className="w-64 shrink-0 p-3 border-r border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)] px-1">
        <Building2 size={12} />
        Offices
      </div>

      <button className="btn-neon w-full justify-center">
        <Plus size={14} />
        New Office
      </button>

      <div className="flex flex-col gap-2 mt-1">
        <OfficeCard
          name="Research Office"
          type="research"
          status="active"
          active
        />
        <OfficeCard name="Dev Office" type="developer" status="standby" />
      </div>
    </aside>
  );
}
