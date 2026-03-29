"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

/* ─────────────────────────────────────────────
   Types & Data
───────────────────────────────────────────── */
type PatchItem = {
  id: string
  date: string
  area: string
  title: string
  oneLiner: string
  dotColor: string
  badgeColor: "cherry" | "violet" | "green" | "amber" | "muted"
  stars?: number
  opacity?: number
}

const PATCHES: PatchItem[] = [
  {
    id: "1",
    date: "Feb 25",
    area: "Models",
    title: "Claude 3.7 Sonnet — Extended Thinking",
    oneLiner: "Opt-in extended thinking mode. API parameter only.",
    dotColor: "#C94B6E",
    badgeColor: "cherry",
    stars: 5,
  },
  {
    id: "2",
    date: "Feb 24",
    area: "Frameworks",
    title: "LangGraph 0.3 — Stateful agents",
    oneLiner: "Persistent state graphs, LangSmith integration.",
    dotColor: "#7B5EA7",
    badgeColor: "violet",
    stars: 5,
  },
  {
    id: "3",
    date: "Feb 24",
    area: "Case Study",
    title: "Baemin text-to-SQL — 85% production accuracy",
    oneLiner: "Schema-aware prompting, 3s p95 latency.",
    dotColor: "#2D7A5E",
    badgeColor: "green",
    stars: 4,
  },
  {
    id: "4",
    date: "Feb 23",
    area: "Frameworks",
    title: "LlamaIndex 0.12 — One-line MCP connections",
    oneLiner: "Upgrade recommended.",
    dotColor: "#D4854A",
    badgeColor: "amber",
    opacity: 0.85,
  },
  {
    id: "5",
    date: "Feb 23",
    area: "Regulations",
    title: "EU AI Act enforcement begins",
    oneLiner: "Review checklist if shipping EU products.",
    dotColor: "#9E97B3",
    badgeColor: "muted",
    opacity: 0.7,
  },
  {
    id: "6",
    date: "Feb 20",
    area: "Models",
    title: "Gemini 2.0 Flash — 1/10th cost of o1",
    oneLiner: "",
    dotColor: "#9E97B3",
    badgeColor: "muted",
    opacity: 0.5,
  },
  {
    id: "7",
    date: "Feb 20",
    area: "Tools",
    title: "CrewAI 0.9 — Production telemetry",
    oneLiner: "",
    dotColor: "#9E97B3",
    badgeColor: "muted",
    opacity: 0.4,
  },
]

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  cherry: { bg: "#FDF0F3", text: "#C94B6E", border: "#F2C4CE" },
  violet: { bg: "#F3EFFA", text: "#7B5EA7", border: "#C7B8E8" },
  green: { bg: "#EFF7F3", text: "#2D7A5E", border: "#A8D4C0" },
  amber: { bg: "#FDF6EE", text: "#D4854A", border: "#F0D8B0" },
  muted: { bg: "#F2F0F7", text: "#9E97B3", border: "#E4E1EE" },
}

const FILTERS = ["All", "Models", "Frameworks", "Case Studies", "Regulations"]

/* ─────────────────────────────────────────────
   Stars Component
───────────────────────────────────────────── */
function Stars({ count, color = "#C94B6E" }: { count: number; color?: string }) {
  return (
    <span className="flex items-center gap-[1px] text-[11px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.25 }}>
          ★
        </span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Timeline Item
───────────────────────────────────────────── */
function TimelineItem({ item }: { item: PatchItem }) {
  const badgeStyle = BADGE_STYLES[item.badgeColor]

  return (
    <div
      className="relative pl-6"
      style={{ opacity: item.opacity ?? 1 }}
    >
      {/* Dot */}
      <span
        className="absolute left-0 top-[7px] w-[10px] h-[10px] rounded-full border-2 border-card"
        style={{ backgroundColor: item.dotColor }}
      />

      {/* Content */}
      <div className="pb-5">
        <p className="text-[12px] text-text-muted mb-1">
          {item.date} · {item.area}
        </p>
        <p className="text-[15px] font-bold text-[#1A1626] mb-1 leading-snug">
          {item.title}
        </p>
        {item.oneLiner && (
          <p className="text-[13px] text-text-muted mb-2">{item.oneLiner}</p>
        )}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              borderColor: badgeStyle.border,
            }}
          >
            {item.area}
          </span>
          {item.stars && <Stars count={item.stars} />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function PatchNotesPage() {
  const [activeFilter, setActiveFilter] = useState("All")

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-extrabold text-[#1A1626] leading-none mb-2.5"
          style={{ fontSize: "30px", letterSpacing: "-0.5px" }}
        >
          Patch Notes
        </h1>
        <p className="text-[15px] text-text-muted leading-relaxed">
          Feb 17 → Feb 28, 2026 &nbsp;·&nbsp; Cumulative changelog
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* LEFT: Timeline */}
        <div className="flex-[0_0_65%] min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-4">
            14 UPDATES · 4 AREAS
          </p>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[4px] top-2 bottom-0 w-px"
              style={{ backgroundColor: "#E4E1EE" }}
            />

            {/* Items */}
            {PATCHES.map((item) => (
              <TimelineItem key={item.id} item={item} />
            ))}

            {/* End card */}
            <div className="relative pl-6 pt-2">
              <div
                className="bg-card border border-border rounded-[16px] p-7 text-center"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: "#FDF0F3" }}
                >
                  <Check className="w-6 h-6" style={{ color: "#C94B6E" }} />
                </div>
                <p
                  className="text-[18px] font-extrabold mb-1"
                  style={{ color: "#C94B6E" }}
                >
                  {"You're caught up"}
                </p>
                <p className="text-[13px] text-text-muted mb-4">
                  Feb 17 → Feb 28 · 11 days reviewed
                </p>
                <div className="flex items-center justify-center gap-6">
                  {[
                    { label: "14 updates", color: "#1A1626" },
                    { label: "4 areas", color: "#1A1626" },
                    { label: "Current", color: "#C94B6E" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="text-[12px] font-semibold"
                      style={{ color: stat.color }}
                    >
                      {stat.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Filter panel + Stats */}
        <div className="flex-[0_0_35%] min-w-0 space-y-3">
          {/* Filter card */}
          <div className="bg-card border border-border rounded-[12px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Filter by Area
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const isActive = activeFilter === f
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer",
                      isActive
                        ? "bg-cherry-soft text-cherry border-cherry-border"
                        : "bg-card text-text-muted border-border hover:border-text-muted"
                    )}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stats card */}
          <div className="bg-card border border-border rounded-[12px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              This Period
            </p>
            <div className="space-y-2">
              {[
                { label: "Total updates", value: "14", color: "#1A1626" },
                { label: "Score 5 items", value: "5", color: "#C94B6E" },
                { label: "New frameworks", value: "3", color: "#1A1626" },
                { label: "Regulatory", value: "2", color: "#1A1626" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-text-secondary">{stat.label}</span>
                  <span className="font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Viewing Guide card */}
          <div
            className="rounded-[12px] p-4 border"
            style={{
              backgroundColor: "#F3EFFA",
              borderColor: "#C7B8E8",
            }}
          >
            <p
              className="text-[13px] font-bold mb-2 flex items-center gap-1.5"
              style={{ color: "#7B5EA7" }}
            >
              <span>💡</span>
              How to read Patch Notes
            </p>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Items are sorted newest first. Cherry border = top-rated. Faded
              items = reviewed. Click any item to expand full context and source
              links.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
