"use client";

import { Building2, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { useUiStore, type LeftView } from "@/lib/store/ui";

interface RailIconProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function RailIcon({ active, label, onClick, children }: RailIconProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "relative w-10 h-10 rounded-lg flex items-center justify-center transition group",
        active
          ? "bg-[color-mix(in_oklab,var(--color-neon-violet)_22%,transparent)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-2)]",
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
          style={{
            background: "var(--color-neon-violet)",
            boxShadow: "0 0 8px var(--color-neon-violet)",
          }}
        />
      )}
      {children}
    </button>
  );
}

export function LeftRail() {
  const activeLeft = useUiStore((s) => s.activeLeft);
  const toggleLeft = useUiStore((s) => s.toggleLeft);

  const items: { view: NonNullable<LeftView>; label: string; icon: React.ReactNode }[] = [
    { view: "offices", label: "Offices", icon: <Building2 size={18} /> },
    { view: "chat", label: "Gemini Chat", icon: <MessageSquare size={18} /> },
  ];

  return (
    <div className="w-12 shrink-0 border-r border-[var(--color-stroke)] bg-[color-mix(in_oklab,var(--color-bg-1)_60%,transparent)] backdrop-blur-md flex flex-col items-center gap-1.5 py-3">
      {items.map((item) => (
        <RailIcon
          key={item.view}
          active={activeLeft === item.view}
          label={item.label}
          onClick={() => toggleLeft(item.view)}
        >
          {item.icon}
        </RailIcon>
      ))}
    </div>
  );
}
