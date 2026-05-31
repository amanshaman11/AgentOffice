"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Shield,
  FileText,
  Send,
  Lightbulb,
  Code2,
  CloudUpload,
  Megaphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingUp,
  Headphones,
  Truck,
  DollarSign,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useSectionScroll } from "./useSectionScroll";

const ParticleWave = dynamic(
  () => import("./ParticleWave").then((m) => m.ParticleWave),
  { ssr: false },
);

const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "why", label: "Why" },
  { id: "research", label: "Research" },
  { id: "developer", label: "Developer" },
  { id: "intervention", label: "Intervention" },
  { id: "future", label: "Future" },
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-neon-violet)] mb-3 font-medium">
      {children}
    </p>
  );
}

function SectionShell({
  opacity,
  children,
  className,
}: {
  opacity: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "absolute inset-0 flex items-center justify-center px-6 md:px-12 pointer-events-none transition-none",
        className,
      )}
      style={{
        opacity,
        transform: `translateY(${(1 - opacity) * 18}px)`,
        transition: opacity === 0 || opacity === 1 ? "none" : undefined,
      }}
    >
      <div
        className="max-w-5xl w-full pointer-events-auto"
        style={{ pointerEvents: opacity > 0.4 ? "auto" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}

function FlowStep({
  n,
  icon,
  title,
  color,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  color: string;
}) {
  return (
    <div className="landing-panel flex flex-col items-center text-center gap-3 p-4 min-w-[120px]">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
        style={{
          background: `color-mix(in oklab, ${color} 18%, transparent)`,
          color,
          border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
          boxShadow: `0 0 20px color-mix(in oklab, ${color} 35%, transparent)`,
        }}
      >
        {n}
      </div>
      <div style={{ color }}>{icon}</div>
      <div className="text-sm font-medium">{title}</div>
    </div>
  );
}

export function LandingPage() {
  const { index, goTo, opacityFor } = useSectionScroll(SECTIONS.length);

  return (
    <div className="landing-page fixed inset-0 overflow-hidden bg-[#050510] text-[var(--color-text-primary)]">
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: index === 0 ? 1 : 0.25 }}
      >
        <ParticleWave />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(138_123_255_/_0.14),transparent_55%)]" />

      <nav className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4">
        <Image src="/agent_office.png" alt="AgentOffice" width={130} height={34} priority />
        <Link href="/" className="btn-neon text-sm">
          Open App
          <ArrowRight size={14} />
        </Link>
      </nav>

      <div className="absolute inset-0 z-10">
        <SectionShell opacity={opacityFor(0)}>
          <div className="text-center pt-16">
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <Image
                  src="/agent_office.png"
                  alt="AgentOffice"
                  width={280}
                  height={72}
                  priority
                  className="relative z-10"
                />
                <div className="absolute inset-0 blur-2xl bg-[var(--color-neon-violet)] opacity-30 scale-110" />
              </div>
            </div>
            <Eyebrow>Build your</Eyebrow>
            <h1
              className="text-3xl md:text-5xl font-semibold tracking-[0.2em] uppercase mb-6"
              style={{
                color: "var(--color-neon-violet)",
                textShadow: "0 0 30px rgb(138 123 255 / 0.7)",
              }}
            >
              AI Workforce
            </h1>
       
            <p className="text-zinc-200 max-w-lg mx-auto mb-10 leading-relaxed hero-body-shadow">
              Create AI-powered offices in minutes. Add agents, run workflows, and
              receive validated results — no complex automation required.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/" className="btn-hero-primary">
                Launch AgentOffice
                <ArrowRight size={16} />
              </Link>
              <button onClick={() => goTo(1)} className="btn-hero-secondary">
                Learn more
              </button>
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(1)}>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Eyebrow>The Problem</Eyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">
                Small businesses do too much with too little.
              </h2>
              <ul className="space-y-4">
                {[
                  "Hiring is expensive and slow",
                  "Too many disconnected tools",
                  "No time to build complex workflows",
                  "High barrier for non-technical users",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[var(--color-text-muted)]">
                    <span className="mt-1.5 status-dot shrink-0 bg-[var(--color-neon-violet)] text-[var(--color-neon-violet)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="landing-panel p-8 text-center">
              <div className="text-6xl mb-4 opacity-80">😰</div>
              <p className="text-[var(--color-text-dim)] text-sm leading-relaxed">
                Students, researchers, and entrepreneurs need powerful AI — but
                current tools demand technical expertise most people don&apos;t have.
              </p>
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(2)}>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Eyebrow>Our Solution</Eyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">
                AgentOffice lets you build AI offices, not workflows.
              </h2>
              <ol className="space-y-4">
                {[
                  "Choose an office type",
                  "Add AI agents in order",
                  "Run your office with a query",
                  "Receive validated, final results",
                ].map((step, i) => (
                  <li key={step} className="flex items-center gap-4">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: "color-mix(in oklab, var(--color-neon-violet) 18%, transparent)",
                        color: "var(--color-neon-violet)",
                        border: "1px solid color-mix(in oklab, var(--color-neon-violet) 40%, transparent)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[var(--color-text-muted)]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="landing-panel p-8 flex flex-col items-center gap-4">
              <Sparkles size={40} className="text-[var(--color-neon-violet)]" style={{ filter: "drop-shadow(0 0 12px var(--color-neon-violet))" }} />
              <p className="text-center text-[var(--color-text-muted)] leading-relaxed">
                Your roster <em>is</em> the workflow. Each agent you add becomes
                the next step — just like n8n, but visual and intuitive.
              </p>
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(3)}>
          <div className="text-center">
            <Eyebrow>Why It Matters</Eyebrow>
            <h2 className="text-3xl md:text-5xl font-semibold mb-4">
              AI workforce that works for you,{" "}
              <span
                className="text-[var(--color-neon-cyan)]"
                style={{ textShadow: "0 0 24px rgb(74 214 255 / 0.6)" }}
              >
                24/7
              </span>
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-2xl mx-auto mb-12 leading-relaxed">
              Agents collaborate, review each other&apos;s work, and intervene when
              errors are detected — delivering higher quality results without
              manual oversight.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { label: "Always on", desc: "Run research pipelines anytime" },
                { label: "Self-correcting", desc: "Agents retry and re-route on failure" },
                { label: "Visual", desc: "Watch your team work in 3D" },
              ].map(({ label, desc }) => (
                <div key={label} className="landing-panel p-5">
                  <div className="text-lg font-semibold text-[var(--color-neon-violet)] mb-1">{label}</div>
                  <div className="text-sm text-[var(--color-text-dim)]">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(4)}>
          <div className="text-center">
            <Eyebrow>Research Office</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-semibold mb-3">
              From search to summary.
            </h2>
            <p className="text-[var(--color-text-muted)] mb-10">
              Research made simple — perfect for researchers, students, and entrepreneurs.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <FlowStep n={1} icon={<Search size={20} />} title="Searcher" color="#4ad6ff" />
              <FlowStep n={2} icon={<Shield size={20} />} title="Analyzer" color="#8a7bff" />
              <FlowStep n={3} icon={<FileText size={20} />} title="Summarizer" color="#43e3a4" />
              <FlowStep n={4} icon={<Send size={20} />} title="Sender" color="#ffb547" />
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(5)}>
          <div className="text-center">
            <Eyebrow>SaaS Developer Office</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-semibold mb-3">
              Turn ideas into products with your AI team.
            </h2>
            <p className="text-[var(--color-text-muted)] mb-10">
              From concept to launch — a full development pipeline in one office.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <FlowStep n={1} icon={<Lightbulb size={20} />} title="Planner" color="#4ad6ff" />
              <FlowStep n={2} icon={<Code2 size={20} />} title="Executor" color="#8a7bff" />
              <FlowStep n={3} icon={<Shield size={20} />} title="QA Engineer" color="#ff5bd1" />
              <FlowStep n={4} icon={<CloudUpload size={20} />} title="Deployer" color="#43e3a4" />
              <FlowStep n={5} icon={<Megaphone size={20} />} title="Marketing" color="#ffb547" />
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(6)}>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Eyebrow>Intervention System</Eyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">
                AI agents review each other so you get better results.
              </h2>
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                When the Analyzer finds weak sources, the workflow automatically
                re-routes back to the Searcher with feedback — up to 2 retries —
                before moving forward.
              </p>
            </div>
            <div className="landing-panel p-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="landing-chip">Searcher</div>
                <ArrowRight size={16} className="text-[var(--color-text-dim)]" />
                <div className="landing-chip">Analyzer</div>
              </div>
              <div className="flex gap-6 w-full justify-center">
                <div className="flex items-center gap-2 text-[var(--color-neon-green)]">
                  <CheckCircle2 size={18} />
                  <span className="text-sm">Approve → Next</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--color-neon-pink)]">
                  <XCircle size={18} />
                  <span className="text-sm">Reject → Retry</span>
                </div>
              </div>
              <RefreshCw size={28} className="text-[var(--color-neon-violet)] opacity-60 mt-2" />
            </div>
          </div>
        </SectionShell>

        <SectionShell opacity={opacityFor(7)}>
          <div className="text-center">
            <Eyebrow>Future Vision</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-semibold mb-3">
              More offices. More power. Endless possibilities.
            </h2>
            <p className="text-[var(--color-text-muted)] mb-10 max-w-xl mx-auto">
              The future of work is AI. Build your workforce today.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 max-w-2xl mx-auto mb-12">
              {[
                { icon: <TrendingUp size={22} />, label: "Sales" },
                { icon: <Megaphone size={22} />, label: "Marketing" },
                { icon: <Headphones size={22} />, label: "Support" },
                { icon: <Truck size={22} />, label: "Logistics" },
                { icon: <DollarSign size={22} />, label: "Finance" },
                { icon: <Sparkles size={22} />, label: "More…" },
              ].map(({ icon, label }) => (
                <div key={label} className="landing-panel p-4 flex flex-col items-center gap-2">
                  <span className="text-[var(--color-neon-violet)]">{icon}</span>
                  <span className="text-xs text-[var(--color-text-dim)]">{label}</span>
                </div>
              ))}
            </div>
            <Link href="/" className="btn-neon inline-flex">
              Build your workforce today
              <ArrowRight size={16} />
            </Link>
          </div>
        </SectionShell>
      </div>

      <div className="absolute right-5 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            aria-label={`Go to ${s.label}`}
            className={clsx(
              "w-2 h-2 rounded-full transition-all duration-300",
              i === index
                ? "bg-[var(--color-neon-violet)] scale-125 shadow-[0_0_8px_var(--color-neon-violet)]"
                : "bg-[var(--color-stroke)] hover:bg-[var(--color-text-dim)]",
            )}
          />
        ))}
      </div>

      <div className="absolute bottom-5 inset-x-0 z-30 flex flex-col items-center gap-1 text-[10px] text-[var(--color-text-dim)] pointer-events-none">
        <span>Scroll to explore</span>
        {index < SECTIONS.length - 1 && (
          <span className="animate-bounce opacity-60">↓</span>
        )}
      </div>
    </div>
  );
}
