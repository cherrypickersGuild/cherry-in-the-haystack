"use client"

import { Newspaper } from "lucide-react"

/* ─────────────────────────────────────────────
   Category metadata
───────────────────────────────────────────── */
const CATEGORY_META: Record<string, {
  title: string
  parentCategory: string
  description: string
  accent: string
  accentBg: string
  accentBorder: string
}> = {
  "research-papers": {
    title: "Research & Papers",
    parentCategory: "Research & Models",
    description: "Major conference papers, research breakthroughs, novel techniques from academia, and academic-industry collaboration results.",
    accent: "#7B5EA7",
    accentBg: "#F3EFFA",
    accentBorder: "#C7B8E8",
  },
  "benchmarks-datasets": {
    title: "Benchmarks & Datasets",
    parentCategory: "Research & Models",
    description: "Benchmark results and leaderboard changes, new public datasets, evaluation tools, and annotation services.",
    accent: "#7B5EA7",
    accentBg: "#F3EFFA",
    accentBorder: "#C7B8E8",
  },
  "developer-tools": {
    title: "Developer Tools & Services",
    parentCategory: "Engineering & Tooling",
    description: "Newly emerged developer tools, productivity enhancements, monitoring, debugging, and testing services for AI engineering.",
    accent: "#4B78F0",
    accentBg: "#F8F9FF",
    accentBorder: "#C8D5F8",
  },
  "patterns": {
    title: "Patterns & Implementations",
    parentCategory: "Engineering & Tooling",
    description: "Shared prompts, templates, agent architectures, MCP implementations, reference code, and orchestration patterns.",
    accent: "#4B78F0",
    accentBg: "#F8F9FF",
    accentBorder: "#C8D5F8",
  },
  "regulation": {
    title: "Regulation & Governance",
    parentCategory: "Policy & Community",
    description: "AI regulations, policy updates, compliance requirements, audit reports, and standardization publications.",
    accent: "#D4854A",
    accentBg: "#FEF3E2",
    accentBorder: "#F0D8B0",
  },
  "community": {
    title: "Community",
    parentCategory: "Discourse",
    description: "Community best practices, conference and meetup highlights, open-source milestones, and contributor spotlights.",
    accent: "#D4854A",
    accentBg: "#FEF3E2",
    accentBorder: "#F0D8B0",
  },
  "insights": {
    title: "Insights & Opinions",
    parentCategory: "Discourse",
    description: "Big tech strategic moves, thought leadership, emerging patterns, predictions, and forward-looking analysis in AI engineering.",
    accent: "#D4854A",
    accentBg: "#FEF3E2",
    accentBorder: "#F0D8B0",
  },
  "deep-dives": {
    title: "Technical Deep Dives",
    parentCategory: "Discourse",
    description: "Long-form technical analysis, architectural breakdowns, performance studies, and comparative evaluations.",
    accent: "#D4854A",
    accentBg: "#FEF3E2",
    accentBorder: "#F0D8B0",
  },
}

/* ─────────────────────────────────────────────
   Placeholder Page
───────────────────────────────────────────── */
export function NDPlaceholderPage({ categoryId }: { categoryId: string }) {
  const meta = CATEGORY_META[categoryId] ?? {
    title: "Coming Soon",
    parentCategory: "Newly Discovered",
    description: "This category is currently being curated.",
    accent: "#C94B6E",
    accentBg: "#FDF0F3",
    accentBorder: "#F2C4CE",
  }

  return (
    <div style={{ maxWidth: "700px" }}>
      {/* Parent category badge */}
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-3"
        style={{
          backgroundColor: meta.accentBg,
          color: meta.accent,
          border: `1px solid ${meta.accentBorder}`,
        }}
      >
        {meta.parentCategory}
      </span>

      {/* Title */}
      <h1
        className="font-extrabold text-text-primary leading-tight mb-3"
        style={{ fontSize: "26px", letterSpacing: "-0.3px" }}
      >
        {meta.title}
      </h1>

      {/* Description */}
      <p className="text-[14px] text-text-secondary leading-relaxed mb-8">
        {meta.description}
      </p>

      {/* Curation in progress card */}
      <div
        className="rounded-[12px] p-6"
        style={{
          backgroundColor: meta.accentBg,
          border: `1px solid ${meta.accentBorder}`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: meta.accent }}
          >
            <Newspaper size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-text-primary mb-1">
              Curation In Progress
            </h2>
            <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
              Our Knowledge Team is actively curating high-quality content for this category.
              Expect curated articles, scored insights, and structured summaries soon.
            </p>

            <div className="flex flex-wrap gap-3">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: "white", color: meta.accent, border: `1px solid ${meta.accentBorder}` }}
              >
                <Newspaper size={12} />
                Accepting submissions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What to expect */}
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-text-muted mb-3">
          What to Expect
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Scored Content", desc: "AI-scored articles (1-5 scale)" },
            { label: "Team-Reviewed", desc: "Knowledge Team validated" },
            { label: "Weekly Updates", desc: "Fresh batch every Wednesday" },
            { label: "Source Links", desc: "Direct links to originals" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[8px] p-3"
              style={{ backgroundColor: "white", border: "1px solid #E4E1EE" }}
            >
              <p className="text-[12px] font-semibold text-text-primary mb-0.5">{item.label}</p>
              <p className="text-[11px] text-text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
