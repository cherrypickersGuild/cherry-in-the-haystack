"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar, CherryIcon } from "@/components/cherry/sidebar"
import { MobileSidebar } from "@/components/cherry/mobile-sidebar"
import { PageHeader } from "@/components/cherry/page-header"
import { CategoryTreemap } from "@/components/cherry/buzz-treemap"
import { PatchNotesPage } from "@/components/cherry/patch-notes-page"
import { fetchLanding, fetchLandingArticles, LandingResponse, LandingTopArticle } from "@/lib/api"
import { NDFrameworksPage } from "@/components/cherry/nd-frameworks-page"
import { NDModelUpdatesPage } from "@/components/cherry/nd-model-updates-page"
import { NDCaseStudiesPage } from "@/components/cherry/nd-case-studies-page"
import { ConceptReaderPage } from "@/components/cherry/concept-reader-page"
import { HandbookPlaceholder } from "@/components/cherry/handbook-placeholder"
import { KaasCatalogPage } from "@/components/cherry/kaas-catalog-page"
import { KaasDashboardPage } from "@/components/cherry/kaas-dashboard-page"
// KaasAdminPage는 KaasDashboardPage 내부 탭으로 통합됨
import { KaasConsole, KaasConsoleRef } from "@/components/cherry/kaas-console"

const MOMENTUM_COLORS = ["#C94B6E", "#7B5EA7", "#2D7A5E", "#D4854A", "#0194E2"]

const STATIC_MOMENTUM = [
  { entityId: "s1", entityName: "GPT-4o", categoryName: "OpenAI Family", page: "MODEL_UPDATES", thisWeekCount: 12, prevWeekCount: 4, changePct: 200 },
  { entityId: "s2", entityName: "LangGraph", categoryName: "Agent", page: "FRAMEWORKS", thisWeekCount: 9, prevWeekCount: 3, changePct: 200 },
  { entityId: "s3", entityName: "Gemini 2.0", categoryName: "Google Family", page: "MODEL_UPDATES", thisWeekCount: 8, prevWeekCount: 3, changePct: 166 },
]

/** JWT payload에서 role 추출 (검증 없이 디코딩만) */
function parseJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

export default function CherryApp() {
  const [activeNav, setActiveNav] = useState("highlight")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [landing, setLanding] = useState<LandingResponse | null>(null)
  const [topArticles, setTopArticles] = useState<LandingTopArticle[]>([])
  const router = useRouter()
  const consoleRef = useRef<KaasConsoleRef>(null)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    setIsLoggedIn(!!token)
    if (token) setUserRole(parseJwtRole(token))
    // 통계(treemap+momentum)와 기사 목록 동시에 fetch
    fetchLanding().then(setLanding).catch(() => {})
    fetchLandingArticles().then((r) => setTopArticles(r.items)).catch(() => {})
  }, [])

  const handleAuthClick = () => {
    if (isLoggedIn) {
      localStorage.removeItem("accessToken")
      setIsLoggedIn(false)
      setUserRole(null)
    } else {
      router.push("/login")
    }
  }

  const isAdmin = userRole === "ADMIN"

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

      case "kaas-catalog":
        return <KaasCatalogPage
          onQuery={(title, depth, conceptId) => consoleRef.current?.query(title, depth, conceptId)}
          onCompareResult={(result) => {
            const upToDate = result.upToDate?.length ?? 0
            const outdated = result.outdated?.length ?? 0
            const gaps = result.gaps?.length ?? 0
            const topics = [
              ...result.upToDate?.map((c: any) => `  ✅ ${c.title}`) ?? [],
              ...result.outdated?.map((c: any) => `  🔄 ${c.title} (outdated)`) ?? [],
              ...result.gaps?.slice(0, 3).map((c: any) => `  ⬜ ${c.title} (gap)`) ?? [],
              gaps > 3 ? `  ... +${gaps - 3} more gaps` : null,
            ].filter(Boolean).join("\n")
            consoleRef.current?.notify(`📊 Compare (${result.source ?? "db"}) — ${result.agentName ?? "agent"}\n${topics}\n\nup-to-date: ${upToDate} | outdated: ${outdated} | gaps: ${gaps}`)
          }}
        />

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
              {/* Treemap */}
              <div className="flex-1">
                <CategoryTreemap items={landing?.treemap} />
              </div>

              {/* Side panel: Trending Momentum */}
              <div className="w-full lg:w-[260px] lg:flex-shrink-0">
                <p className="text-[13px] uppercase font-bold tracking-[0.5px] text-text-secondary mb-3">
                  Trending Momentum
                </p>
                <div className="space-y-2.5">
                  {(() => {
                    const entities = landing && landing.topMomentumEntities.length > 0
                      ? landing.topMomentumEntities
                      : STATIC_MOMENTUM
                    const maxPct = Math.max(...entities.map((x) => x.changePct))
                    return entities.map((e, idx) => {
                      const color = MOMENTUM_COLORS[idx % MOMENTUM_COLORS.length]
                      const barWidth = Math.round((e.changePct / maxPct) * 100)
                      return (
                        <div
                          key={e.entityId}
                          className="rounded-[10px] p-3"
                          style={{ backgroundColor: "white", border: "1px solid #E4E1EE" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-text-primary truncate">{e.entityName}</p>
                              <p className="text-[10px] text-text-muted">{e.categoryName}</p>
                            </div>
                            <p className="text-[11px] font-bold ml-2 flex-shrink-0" style={{ color }}>
                              +{e.changePct}%
                            </p>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F2F0F7" }}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${barWidth}%`,
                                background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-text-muted mt-1.5">
                            {e.thisWeekCount} articles this week · {e.page}
                          </p>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>

            {/* Top picks this week */}
            <section aria-labelledby="top-picks-heading">
              <p
                id="top-picks-heading"
                className="text-[13px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-3"
              >
                Top Picks This Week
              </p>
              {topArticles.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {topArticles.map((article) => (
                    <article
                      key={article.id}
                      className="bg-white border border-[#E4E1EE] rounded-[12px] px-5 py-[18px] cursor-pointer hover:shadow-md transition-shadow"
                      style={{ borderLeft: "3px solid #C94B6E" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.6px] px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "#FDF0F3", color: "#C94B6E" }}
                        >
                          {article.categoryName}
                        </span>
                        <span className="text-[12px]" style={{ color: "#C94B6E" }}>
                          {"★".repeat(article.score)}{"☆".repeat(5 - article.score)}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-bold text-[#1A1626] leading-snug mb-2">{article.title}</h3>
                      <p className="text-[13px] text-[#9E97B3] leading-relaxed mb-2 line-clamp-2">{article.oneLiner}</p>
                      <p className="text-[11px] text-text-muted">{article.entityName} · {article.date} · {article.page}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted py-6 text-center">
                  {landing ? "No articles found" : "Loading…"}
                </p>
              )}
            </section>

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
          <div className="ml-auto flex items-center gap-2">
            {isLoggedIn && (
              <button
                onClick={() => setShowDashboard(true)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#C94B6E" }}
              >
                Dashboard
              </button>
            )}
            <button
              onClick={handleAuthClick}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[#E4E1EE] text-[#7B7599] bg-white hover:border-[#C94B6E] hover:text-[#C94B6E] transition-colors"
            >
              {isLoggedIn ? "Logout" : "Login"}
            </button>
            <MobileSidebar active={activeNav} onSelect={setActiveNav} />
          </div>
        </header>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-end gap-2 px-10 py-4 border-b border-[#E4E1EE] bg-white flex-shrink-0">
          {isLoggedIn && (
            <button
              onClick={() => setShowDashboard(true)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "#C94B6E" }}
            >
              Dashboard
            </button>
          )}
          <button
            onClick={handleAuthClick}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[#E4E1EE] text-[#7B7599] bg-white hover:border-[#C94B6E] hover:text-[#C94B6E] transition-colors cursor-pointer"
          >
            {isLoggedIn ? "Logout" : "Login"}
          </button>
        </div>

        {/* Main scrollable content */}
        <main
          className="flex-1 overflow-y-auto px-4 py-4 lg:px-10 lg:py-8"
          style={{ backgroundColor: "#FBFAF8" }}
          id="main-content"
        >
          {renderContent()}
        </main>
      </div>

      {/* Floating Agent Console — visible on KaaS pages */}
      {activeNav.startsWith("kaas") && <KaasConsole ref={consoleRef} />}

      {/* Dashboard modal (통합: Dashboard + 지식 큐레이팅 + 프롬프트 템플릿) */}
      {showDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDashboard(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-[1200px] h-[95vh] lg:h-[90vh] animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDashboard(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-gray-200 cursor-pointer z-10"
            >
              <span className="text-text-muted text-[16px]">✕</span>
            </button>
            <KaasDashboardPage isAdmin={isAdmin} />
          </div>
        </div>
      )}
    </div>
  )
}
