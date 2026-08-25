"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar, CherryIcon } from "@/components/cherry/sidebar"
import { MobileSidebar } from "@/components/cherry/mobile-sidebar"
import { PageHeader } from "@/components/cherry/page-header"
import { PatchNotesPage } from "@/components/cherry/patch-notes-page"
import { fetchLanding, fetchLandingArticles, LandingResponse, LandingTopArticle } from "@/lib/api"
import { useAuthTick, getAccessToken, decodeToken, clearAccessToken } from "@/lib/auth"
import { NDFrameworksPage } from "@/components/cherry/nd-frameworks-page"
import { NDPromptingPage } from "@/components/cherry/nd-prompting-page"
import { NDCasesPage } from "@/components/cherry/nd-cases-page"
import { NDCasesListPage } from "@/components/cherry/nd-cases-articles-page"
import { NDCasesBestPage } from "@/components/cherry/nd-cases-best-page"
import { NDResearchPage, NDPapersPage, NDResearchLandscapePage, NDDiscoursePage, NDDiscourseArticlePage } from "@/components/cherry/nd-research-page"
import { ConceptReaderPage } from "@/components/cherry/concept-reader-page"
import { NDSpecPage } from "@/components/cherry/nd-spec-page"
import { NDOverviewPage } from "@/components/cherry/nd-overview-page"
import { NDBuildingBlocksPage } from "@/components/cherry/nd-building-blocks-page"
import { isNDSpecPage } from "@/lib/nd-taxonomy"
import { KaasCatalogPage } from "@/components/cherry/kaas-catalog-page"
import { KaasArenaPage } from "@/components/cherry/kaas-arena-page"
import { KaasDashboardPage } from "@/components/cherry/kaas-dashboard-page"
// KaasAdminPage는 KaasDashboardPage 내부 탭으로 통합됨
import { KaasConsole, KaasConsoleRef } from "@/components/cherry/kaas-console"

const MOMENTUM_COLORS = ["#C94B6E", "#7B5EA7", "#2D7A5E", "#D4854A", "#0194E2"]

const STATIC_MOMENTUM = [
  { entityId: "s1", entityName: "GPT-4o", categoryName: "OpenAI Family", page: "MODEL_UPDATES", thisWeekCount: 12, prevWeekCount: 4, changePct: 200 },
  { entityId: "s2", entityName: "LangGraph", categoryName: "Agent", page: "FRAMEWORKS", thisWeekCount: 9, prevWeekCount: 3, changePct: 200 },
  { entityId: "s3", entityName: "Gemini 2.0", categoryName: "Google Family", page: "MODEL_UPDATES", thisWeekCount: 8, prevWeekCount: 3, changePct: 166 },
]

/* Learning: 사이드바 토픽 id → 온톨로지 개념 노드 (handbook.concept.ontology_node)
   API 가 노드명·slug·별칭 아무거나 받으므로 노드명으로 통일한다.
   근거: apps/docs/ontology-migration/2-implementation-guide.md §5 */
const CONCEPT_NODE_BY_TOPIC: Record<string, { node: string; section: "BASICS" | "ADVANCED" }> = {
  /* BASICS — PRD product-scope.md §1 */
  "prompting-reasoning": { node: "PromptEngineering", section: "BASICS" },
  "rag-systems":         { node: "RAG", section: "BASICS" },
  "fine-tuning":         { node: "Finetuning", section: "BASICS" },
  "agents-reasoning":    { node: "AgentArchitecture", section: "BASICS" },
  "embeddings":          { node: "Embedding", section: "BASICS" },
  "evaluation-systems":  { node: "EvaluationMetric", section: "BASICS" },
  /* ADVANCED — PRD product-scope.md §2 */
  "chain-of-thought":    { node: "AdvancedPrompting", section: "ADVANCED" },
  /* Advanced 6개는 전부 자기 개념을 갖는다. MultiHopRAG · CustomEmbedding ·
     MultiAgentOrchestration · AdversarialEvaluation 은 2026-08-25 에 신설했다.
     그 전에는 이름이 비슷한 HybridRetrieval · Embedding 을 가리키고 있었는데,
     HybridRetrieval 은 "한 번에 잘 찾기"라 multi-hop 과 다른 축이었고,
     Embedding 은 Basics 의 "Embeddings" 와 같은 개념이라 두 메뉴가 같은 페이지를 열었다.
     기획: apps/docs/advanced/1-work-guidelines.md §3 */
  "multi-hop-rag":       { node: "MultiHopRAG", section: "ADVANCED" },
  "peft-lora":           { node: "ParameterEfficientFinetuning", section: "ADVANCED" },
  "agent-topologies":    { node: "MultiAgentOrchestration", section: "ADVANCED" },
  "custom-embeddings":   { node: "CustomEmbedding", section: "ADVANCED" },
  "adversarial-eval":    { node: "AdversarialEvaluation", section: "ADVANCED" },
}
/* 역방향: 개념 slug → 사이드바 토픽 id. 하위 개념을 누르면 그 개념의 "자기 페이지"로 가야 하므로,
   메뉴 토픽인 개념은 해당 토픽 id 로 이동해 사이드바 하이라이트까지 맞춘다.
   메뉴에 없는 개념(Tier 2)은 전용 상태 "concept" 로 연다. */
const TOPIC_BY_CONCEPT_NODE: Record<string, string> = Object.fromEntries(
  Object.entries(CONCEPT_NODE_BY_TOPIC).map(([topic, v]) => [v.node, topic]),
)

export default function CherryApp() {
  const [activeNav, setActiveNav] = useState("nd-overview")
  const [dashboardTab, setDashboardTab] = useState<"dashboard" | "curation" | "concept-page" | "template" | "overview-builder">("dashboard")
  const [marketConceptId, setMarketConceptId] = useState<string | null>(null)
  // Learning 개념 페이지: activeNav 와 별개로 "어느 개념인가"를 담는 파라미터 상태
  // (marketConceptId 와 동일한 패턴 — taxonomy/switch 를 늘리지 않고 개념 간 이동)
  const [conceptSlug, setConceptSlug] = useState<string | null>(null)

  /* 개념 페이지 열기 — 메뉴 토픽이면 그 토픽 페이지로, 아니면 전용 개념 페이지로. */
  const openConcept = (slug: string) => {
    const topic = TOPIC_BY_CONCEPT_NODE[slug]
    if (topic) {
      setConceptSlug(null)
      setActiveNav(topic)
    } else {
      setConceptSlug(slug)
      setActiveNav("concept")
    }
  }
  const [landing, setLanding] = useState<LandingResponse | null>(null)
  const [topArticles, setTopArticles] = useState<LandingTopArticle[]>([])
  const router = useRouter()
  const consoleRef = useRef<KaasConsoleRef>(null)
  const [showDashboard, setShowDashboard] = useState(false)

  // Subscribe to auth change events for re-render; read the token fresh below.
  useAuthTick()
  // Hydration mismatch 방지: 서버는 localStorage 못 보니 token=null 로 SSR 함.
  // 클라이언트도 hydration 끝날 때까진 token=null 로 동일하게 렌더해야 React 가
  // 트리 통째로 버리고 재렌더하는 사고(error #418) 안 남. mounted 후에 진짜 token 읽음.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const token = mounted ? getAccessToken() : null
  const isAdmin = decodeToken(token)?.role === "ADMIN"

  useEffect(() => {
    fetchLanding().then(setLanding).catch(() => {})
    fetchLandingArticles().then((r) => setTopArticles(r.items)).catch(() => {})
  }, [])

  const handleAuthClick = () => {
    // Re-check at click time — don't rely on stale render-time value.
    if (getAccessToken()) {
      clearAccessToken()
    } else {
      router.push("/login")
    }
  }

  /* ─────────────────────────────────────────────
     Route content based on active nav
  ───────────────────────────────────────────── */
  function renderContent() {
    /* 신규 메뉴(Newly Discovered 신규 카테고리 · Overview · Utility) → 기획페이지.
       ⚠️ switch의 `default:`가 홈으로 폴백하므로, 여기서 먼저 처리하지 않으면
          신규 메뉴를 눌러도 조용히 홈이 뜨는 무증상 버그가 된다.
       ※ 기존 진짜 페이지(model-updates/frameworks/case-studies)는 taxonomy에서
          existing:true 라서 여기 걸리지 않고 아래 switch의 기존 분기로 간다. */
    if (isNDSpecPage(activeNav)) return <NDSpecPage id={activeNav} />

    switch (activeNav) {
      case "nd-overview":
        return <NDOverviewPage />

      case "patch-notes":
        return <PatchNotesPage />

      case "frameworks":
        return <NDFrameworksPage />

      case "prompting":
        return <NDPromptingPage />

      case "model-updates":
        return <NDResearchLandscapePage page="model-updates" />

      case "papers":
        return <NDPapersPage />

      case "benchmarks-datasets":
        return <NDResearchLandscapePage page="benchmarks-datasets" />

      case "discourse-catalog":
        return <NDDiscoursePage />

      case "regulations-policy-compliance":
      case "community":
      case "big-tech-trends":
      case "market-investment":
      case "technical-deep-dives":
      case "insights-opinions":
        return <NDDiscourseArticlePage page={activeNav} />

      case "cases-catalog":
        return <NDCasesPage />

      case "research-catalog":
        return <NDResearchPage />

      case "case-studies":
        return <NDCasesListPage page="case-studies" />

      case "domain-applications":
        return <NDCasesBestPage category="domain-applications" />

      case "product-discovery":
        return <NDCasesBestPage category="product-discovery" />

      case "building-blocks":
        return <NDBuildingBlocksPage />

      case "kaas-catalog":
        return <KaasCatalogPage
          initialConceptId={marketConceptId}
          onInitialConceptConsumed={() => setMarketConceptId(null)}
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
            consoleRef.current?.notify(`📊 Compare (${result.source ?? "db"}) — ${result.agentName ?? "agent"}\n${topics}\n\nup-to-date: ${upToDate} | outdated: ${outdated} | gaps: ${gaps}`, !!result.privacy, result.provenance ?? null)
          }}
        />

      case "kaas-arena":
        return <KaasArenaPage />

      case "concept-reader":
        return <ConceptReaderPage
          slug={conceptSlug ?? "rag"}
          onOpenConcept={openConcept}
          onBuyOnMarket={(conceptId) => {
            setMarketConceptId(conceptId)
            setActiveNav("kaas-catalog")
          }} />

      /* 메뉴에 없는 개념(Tier 2)의 전용 페이지 상태 */
      case "concept":
        return <ConceptReaderPage slug={conceptSlug ?? "rag"} onOpenConcept={openConcept} />

      /* Learning 토픽 12개 — 전부 DB 구동 개념 페이지.
         비어 있는 섹션은 빈 채로 보인다(지어내지 않음). */
      case "prompting-reasoning":
      case "rag-systems":
      case "fine-tuning":
      case "agents-reasoning":
      case "embeddings":
      case "evaluation-systems":
      case "chain-of-thought":
      case "multi-hop-rag":
      case "peft-lora":
      case "agent-topologies":
      case "custom-embeddings":
      case "adversarial-eval":
        return <ConceptReaderPage
          slug={CONCEPT_NODE_BY_TOPIC[activeNav].node}
          sectionHint={CONCEPT_NODE_BY_TOPIC[activeNav].section}
          onOpenConcept={openConcept} />

      case "highlight":
      default:
        return (
          <>
            {/* Page header: title + toggle */}
            <PageHeader />

            {/* Trending Momentum — 전폭 3열 (Buzz Distribution은 Overview로 이관) */}
            <section aria-labelledby="momentum-heading" className="mb-6">
              <p
                id="momentum-heading"
                className="text-[13px] uppercase font-bold tracking-[0.5px] text-text-secondary mb-3"
              >
                Trending Momentum
              </p>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
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
            </section>

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
            {token && (
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
              {token ? "Logout" : "Login"}
            </button>
            <MobileSidebar active={activeNav} onSelect={setActiveNav} />
          </div>
        </header>

        {/* Desktop top bar */}
        <div
          className="hidden lg:flex items-center justify-end border-b border-[#E4E1EE] bg-white flex-shrink-0"
          style={{ gap: 8, paddingLeft: 40, paddingRight: 40, paddingTop: 16, paddingBottom: 16 }}
        >
          {token && (
            <button
              onClick={() => setShowDashboard(true)}
              className="text-[12px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "#C94B6E",
                paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                borderRadius: 8,
              }}
            >
              Dashboard
            </button>
          )}
          <button
            onClick={handleAuthClick}
            className="text-[12px] font-medium border border-[#E4E1EE] text-[#7B7599] bg-white hover:border-[#C94B6E] hover:text-[#C94B6E] transition-colors cursor-pointer"
            style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              borderRadius: 8,
            }}
          >
            {token ? "Logout" : "Login"}
          </button>
        </div>

        {/* Main scrollable content — constrain inner page to 1200px,
            left-aligned (no mx-auto) so content sits flush with the sidebar. */}
        <main
          className="flex-1 overflow-y-auto px-4 py-4 lg:px-10 lg:py-8"
          style={{ backgroundColor: "#FBFAF8" }}
          id="main-content"
        >
          {/* 가로 표준은 1000px. Landscape 페이지(Frameworks/Prompting/Cases Best/Research/Discourse 혼합)만 1160px. */}
          <div className={`w-full ${["frameworks", "prompting", "domain-applications", "product-discovery", "model-updates", "benchmarks-datasets", "papers", "regulations-policy-compliance", "community", "big-tech-trends", "market-investment", "technical-deep-dives", "insights-opinions"].includes(activeNav) ? "max-w-[1160px]" : "max-w-[1000px]"}`}>
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Floating Cherry Console — 로그인된 사용자에게만 노출.
          비로그인 시 콘솔이 보호된 엔드포인트를 호출해서 401 → /login 자동이동
          되는 부작용 방지. */}
      {token && (
        <KaasConsole
          ref={consoleRef}
          currentPage={
            showDashboard
              ? dashboardTab === "curation"
                ? "Dashboard › Knowledge Curation"
                : dashboardTab === "concept-page"
                ? "Dashboard › Concept Page"
                : dashboardTab === "template"
                ? "Dashboard › Prompt Templates"
                : "Dashboard"
              : activeNav
          }
        />
      )}

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
            <KaasDashboardPage isAdmin={isAdmin} onTabChange={setDashboardTab} />
          </div>
        </div>
      )}
    </div>
  )
}
