"use client"

import { useState } from "react"
import { Sidebar } from "@/components/cherry/sidebar"
import { PageHeader } from "@/components/cherry/page-header"
import { MetricsRow } from "@/components/cherry/metrics-row"
import { CategoryTreemap } from "@/components/cherry/buzz-treemap"
import { TopItemsList } from "@/components/cherry/top-items-list"
import { PatchNotesPage } from "@/components/cherry/patch-notes-page"
import { NDFrameworksPage } from "@/components/cherry/nd-frameworks-page"
import { NDModelUpdatesPage } from "@/components/cherry/nd-model-updates-page"
import { NDCaseStudiesPage } from "@/components/cherry/nd-case-studies-page"
import { ConceptReaderPage } from "@/components/cherry/concept-reader-page"
import { HandbookPlaceholder } from "@/components/cherry/handbook-placeholder"

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

            {/* Metrics row */}
            <div className="mb-5">
              <MetricsRow />
            </div>

            {/* Category treemap + Side panel row */}
            <div className="flex gap-4 mb-6">
              {/* Treemap - flex to fill remaining space */}
              <div className="flex-1">
                <CategoryTreemap />
              </div>
              
              {/* Side panel: Must-Reads + Trending */}
              <div className="w-[240px] flex-shrink-0">
                {/* Must-Reads */}
                <p className="text-[13px] uppercase font-bold tracking-[0.5px] text-text-secondary mb-3">
                  Must-Reads
                </p>
                <div 
                  className="rounded-[9px] overflow-hidden"
                  style={{ backgroundColor: "white", border: "1px solid #E4E1EE" }}
                >
                  {/* Item 1 */}
                  <div className="p-[10px_12px] cursor-pointer hover:bg-[#F7F6F9] transition-colors">
                    <h4 className="text-[12px] font-bold text-text-primary leading-[1.3] mb-1">
                      Claude 3.7 Sonnet with extended thinking
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="inline-flex px-[7px] py-[2px] rounded-[10px] text-[9px] font-bold uppercase"
                        style={{ backgroundColor: "#FDF0F3", color: "#C94B6E", border: "1px solid #F2C4CE" }}
                      >
                        Models
                      </span>
                      <span className="text-[10px] text-cherry">★★★★★</span>
                      <span className="text-[9px] text-text-muted">Feb 25</span>
                    </div>
                  </div>
                  {/* Item 2 */}
                  <div 
                    className="p-[10px_12px] cursor-pointer hover:bg-[#F7F6F9] transition-colors"
                    style={{ borderTop: "1px solid #E4E1EE" }}
                  >
                    <h4 className="text-[12px] font-bold text-text-primary leading-[1.3] mb-1">
                      DSPy 2.6 — native MCP tool support
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="inline-flex px-[7px] py-[2px] rounded-[10px] text-[9px] font-bold uppercase"
                        style={{ backgroundColor: "#F3EFFA", color: "#7B5EA7", border: "1px solid #C7B8E8" }}
                      >
                        Frameworks
                      </span>
                      <span className="text-[10px] text-cherry">★★★★★</span>
                      <span className="text-[9px] text-text-muted">Feb 24</span>
                    </div>
                  </div>
                  {/* Item 3 */}
                  <div 
                    className="p-[10px_12px] cursor-pointer hover:bg-[#F7F6F9] transition-colors opacity-85"
                    style={{ borderTop: "1px solid #E4E1EE" }}
                  >
                    <h4 className="text-[12px] font-semibold text-text-primary leading-[1.3] mb-1">
                      How Notion built their AI assistant
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="inline-flex px-[7px] py-[2px] rounded-[10px] text-[9px] font-bold uppercase"
                        style={{ backgroundColor: "#EFF7F3", color: "#2D7A5E", border: "1px solid #A8D4BF" }}
                      >
                        Case Study
                      </span>
                      <span className="text-[10px] text-cherry">★★★★★</span>
                      <span className="text-[9px] text-text-muted">Feb 23</span>
                    </div>
                  </div>
                </div>

                {/* Trending */}
                <p className="text-[13px] uppercase font-bold tracking-[0.5px] text-text-secondary mb-3 mt-4">
                  Trending
                </p>
                <div className="flex flex-wrap gap-[5px] mb-3">
                  <span 
                    className="px-2 py-[3px] rounded-[20px] text-[10px]"
                    style={{ backgroundColor: "#FDF0F3", color: "#C94B6E", border: "1px solid #F2C4CE" }}
                  >
                    MCP +245%
                  </span>
                  <span 
                    className="px-2 py-[3px] rounded-[20px] text-[10px]"
                    style={{ backgroundColor: "#FDF0F3", color: "#C94B6E", border: "1px solid #F2C4CE" }}
                  >
                    DSPy +189%
                  </span>
                  <span 
                    className="px-2 py-[3px] rounded-[20px] text-[10px]"
                    style={{ border: "1px solid #E4E1EE", color: "#9E97B3" }}
                  >
                    Reasoning <span style={{ color: "#2D7A5E" }}>+67%</span>
                  </span>
                </div>

                {/* Bottom link */}
                <p className="text-[10px] text-text-muted text-center pt-2">
                  Tap any item to read · See all 23 →
                </p>
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
      {/* Sidebar */}
      <Sidebar active={activeNav} onSelect={setActiveNav} />

      {/* Main scrollable content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          backgroundColor: "#FBFAF8",
          padding: "32px 40px",
        }}
        id="main-content"
      >
        {renderContent()}
      </main>
    </div>
  )
}
