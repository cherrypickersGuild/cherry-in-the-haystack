"use client"

import { useState } from "react"
import { Sidebar, CherryIcon } from "@/components/cherry/sidebar"
import { MobileSidebar } from "@/components/cherry/mobile-sidebar"
import { PageHeader } from "@/components/cherry/page-header"
import { CategoryTreemap } from "@/components/cherry/buzz-treemap"
import { TopItemsList } from "@/components/cherry/top-items-list"
import { PatchNotesPage } from "@/components/cherry/patch-notes-page"
import { NDFrameworksPage } from "@/components/cherry/nd-frameworks-page"
import { NDModelUpdatesPage } from "@/components/cherry/nd-model-updates-page"
import { NDCaseStudiesPage } from "@/components/cherry/nd-case-studies-page"
import { ConceptReaderPage } from "@/components/cherry/concept-reader-page"
import { HandbookPlaceholder } from "@/components/cherry/handbook-placeholder"

const TREND_GAUGES = [
  { label: "MCP", growth: "+245%", value: 92, color: "#C94B6E" },
  { label: "DSPy", growth: "+189%", value: 81, color: "#7B5EA7" },
  { label: "Reasoning", growth: "+67%", value: 56, color: "#2D7A5E" },
]

export default function CherryApp() {
  const [activeNav, setActiveNav] = useState("highlight")

  /* ─────────────────────────────────────────────
     Route content based on active nav
  ───────────────────────────────────────────── */
  function renderContent() {
    switch (activeNav) {
      case "patch-notes":
        return <PatchNotesPage />

      case "frameworks":
        return <NDFrameworksPage />

      case "model-updates":
        return <NDModelUpdatesPage />

      case "case-studies":
        return <NDCaseStudiesPage />

      case "concept-reader":
        return <ConceptReaderPage />

      // BASICS
      case "prompting":
      case "rag":
      case "fine-tuning":
      case "agent-architectures":
      case "embeddings":
      case "evaluation":
      // ADVANCED
      case "chain-of-thought":
      case "multi-hop-rag":
      case "peft-lora":
      case "multi-agent":
      case "custom-embeddings":
      case "adversarial-eval":
        return <HandbookPlaceholder topicId={activeNav} />

      case "highlight":
      default:
        return (
          <>
            {/* Page header: title + toggle */}
            <PageHeader />

            {/* Category treemap + Side panel row */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              {/* Treemap - flex to fill remaining space */}
              <div className="flex-1">
                <CategoryTreemap />
              </div>
              
              {/* Side panel: Trending gauges */}
              <div className="w-full lg:w-[260px] lg:flex-shrink-0">
                <p className="text-[13px] uppercase font-bold tracking-[0.5px] text-text-secondary mb-3">
                  Trending Momentum
                </p>
                <div className="space-y-2.5">
                  {TREND_GAUGES.map((trend) => (
                    <div
                      key={trend.label}
                      className="rounded-[10px] p-3"
                      style={{ backgroundColor: "white", border: "1px solid #E4E1EE" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-semibold text-text-primary">
                          {trend.label}
                        </p>
                        <p className="text-[11px] font-bold" style={{ color: trend.color }}>
                          {trend.growth}
                        </p>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F2F0F7" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${trend.value}%`,
                            background: `linear-gradient(90deg, ${trend.color} 0%, ${trend.color}CC 100%)`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1.5">
                        Momentum score {trend.value}/100
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top picks list */}
            <TopItemsList />

            {/* Bottom breathing room */}
            <div className="h-12" aria-hidden />
          </>
        )
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar active={activeNav} onSelect={setActiveNav} className="hidden lg:flex" />

      {/* Content column: mobile header + main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header — hidden on desktop */}
        <header className="flex lg:hidden items-center gap-2.5 px-4 h-14 bg-white border-b border-sidebar-border flex-shrink-0">
          <CherryIcon />
          <div className="leading-tight">
            <span className="text-[16px] font-bold text-text-primary tracking-tight">Cherry</span>
            <p className="text-[10px] text-text-muted font-medium">for AI Engineers</p>
          </div>
          <div className="ml-auto">
            <MobileSidebar active={activeNav} onSelect={setActiveNav} />
          </div>
        </header>

        {/* Main scrollable content */}
        <main
          className="flex-1 overflow-y-auto px-4 py-4 lg:px-10 lg:py-8"
          style={{ backgroundColor: "#FBFAF8" }}
          id="main-content"
        >
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
