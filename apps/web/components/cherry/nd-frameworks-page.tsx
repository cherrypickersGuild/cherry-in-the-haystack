"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { fetchFrameworks, FrameworksArticleItem } from "@/lib/api"

/**
 * Frameworks & SDK 페이지
 *
 * 구성(목업: apps/docs/mockups/frameworks-mockup.html)
 *  ① Landscape       — 정적 JSON(/frameworks/landscape.json)로 구성. Building Blocks 방식.
 *                       카테고리 → 엔티티(이름·설명·링크·GitHub 스타 스냅샷·spotlight·이모지). 전부 링크 있음.
 *  ② Rising Star     — 정적 샘플(‘sample’ 표기). 추세 그래프 없음. 기획회의 전 임시 자리.
 *  ③ Recent Updates  — 실제 DB 기사(fetchFrameworks.articles). ai_score → ★ 별점.
 */

/* ── Landscape JSON 타입 (public/frameworks/landscape.json) ── */
type LandscapeEntity = {
  name: string
  desc: string
  /** 모달용 긴 설명 */
  detail?: string
  url: string | null
  stars: number | null
  spotlight: boolean
  emoji: string
}
type LandscapeCategory = { code: string; name: string; entities: LandscapeEntity[] }
type LandscapeData = { categories: LandscapeCategory[] }

/* ── 카테고리(code) → 색상 ── */
type CatColor = { c: string; bg: string }
const CAT_COLOR: Record<string, CatColor> = {
  "agent":         { c: "#E94057", bg: "#FDECEF" },
  "fine-tuning":   { c: "#8B5CF6", bg: "#F3EFFA" },
  "rag":           { c: "#7C3AED", bg: "#F3EFFA" },
  "prompt-eng":    { c: "#DC2626", bg: "#FDECEC" },
  "serving":       { c: "#10B981", bg: "#E7F4EF" },
  "data-storage":  { c: "#F97316", bg: "#FEF3E2" },
  "llmops":        { c: "#0194E2", bg: "#E6F4FD" },
  "observability": { c: "#7B5EA7", bg: "#F3EFFA" },
}
const catColor = (code: string): CatColor => CAT_COLOR[code] ?? { c: "#9E97B3", bg: "#F3F1F6" }

/* 기사 카테고리(표시명) → 점 색상 */
const ARTICLE_CAT_COLOR: Record<string, string> = {
  "Agent": "#E94057",
  "Fine-Tuning": "#8B5CF6",
  "RAG": "#7C3AED",
  "Prompt Engineering": "#DC2626",
  "Serving": "#10B981",
  "Data & Storage": "#F97316",
  "LLMOps": "#0194E2",
  "Observability": "#7B5EA7",
}
const articleDot = (name: string) => ARTICLE_CAT_COLOR[name] ?? "#9E97B3"

/* 스타 수 축약 표기 — 8900 → "8.9k", 22000 → "22k" */
const fmtStars = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`

/* 카테고리(code) → 이모지. JSON에 이모지가 비었을 때의 폴백. */
const CAT_EMOJI: Record<string, string> = {
  "agent": "🤖", "fine-tuning": "🎯", "rag": "🔍", "prompt-eng": "✏️",
  "serving": "📬", "data-storage": "🗄️", "llmops": "⚙️", "observability": "📈",
}

/* ── 엔티티 행 (카드 안 미리보기 — 표시 전용, 카드 전체가 클릭 대상) ── */
function EntityRow({ e, code }: { e: LandscapeEntity; code: string }) {
  const col = catColor(code)
  return (
    <span className="flex items-center gap-3 border-t border-[#F1EFF5] py-[11px] first:border-t-0">
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-[9px] border text-[18px] leading-none"
        style={{ width: 36, height: 36, background: col.bg, borderColor: "#E4E1EE" }}
      >
        {e.emoji || CAT_EMOJI[code] || "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-[10px]">
          <span
            className="min-w-0 truncate text-[14px] font-bold"
            style={{ color: e.spotlight ? "#C94B6E" : "#1A1626" }}
          >
            {e.name}
          </span>
          {e.stars != null && (
            <span className="flex-shrink-0 text-[11.5px] font-extrabold text-[#C7791B]">
              ★ {fmtStars(e.stars)}
            </span>
          )}
        </span>
        {e.desc && (
          <span className="mt-[2px] block truncate text-[11.5px] leading-[1.4] text-[#6E6A78]">
            {e.desc}
          </span>
        )}
      </span>
    </span>
  )
}

/* ── 카테고리 상세 모달 — 카드 안 3~5개를 전부 상세히 + 각각 링크 ── */
function CategoryModal({ cat, onClose }: { cat: LandscapeCategory; onClose: () => void }) {
  const col = catColor(cat.code)

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[600px] flex-col rounded-[20px] bg-white"
        style={{ border: "1px solid #E4E1EE", boxShadow: "0 20px 48px rgba(26,22,38,.22)" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-[10px] border-b border-[#EEECF4] px-6 py-[18px]">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-[15px]"
            style={{ background: col.bg, color: col.c }}
          >
            {CAT_EMOJI[cat.code] ?? "•"}
          </span>
          <h3 className="flex-1 text-[18px] font-extrabold tracking-[-0.3px] text-[#1A1626]">
            {cat.name}
          </h3>
          <span className="text-[12px] font-extrabold text-[#9E97B3]">
            {cat.entities.length}
          </span>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-md px-1.5 text-[18px] text-[#9E97B3] hover:text-[#1A1626]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* 엔티티 목록 — 각 항목이 사이트로 가는 링크 */}
        <div className="overflow-y-auto px-6 py-2">
          {cat.entities.map((e) => {
            const inner = (
              <>
                <span
                  className="flex flex-shrink-0 items-center justify-center rounded-[12px] border text-[26px] leading-none"
                  style={{ width: 52, height: 52, background: col.bg, borderColor: "#E4E1EE" }}
                >
                  {e.emoji || CAT_EMOJI[cat.code] || "•"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className="text-[15px] font-extrabold tracking-[-0.2px]"
                      style={{ color: e.spotlight ? "#C94B6E" : "#1A1626" }}
                    >
                      {e.name}
                    </span>
                    {e.spotlight && (
                      <span
                        className="rounded-[5px] px-[6px] py-[1px] text-[9.5px] font-extrabold"
                        style={{ background: "#FDF0F3", color: "#C94B6E" }}
                      >
                        SPOTLIGHT
                      </span>
                    )}
                    {e.stars != null && (
                      <span className="text-[11.5px] font-extrabold text-[#C7791B]">
                        ★ {fmtStars(e.stars)}
                      </span>
                    )}
                    {e.url && (
                      <span className="ml-auto flex-shrink-0 text-[12px] font-bold text-[#7B5EA7] opacity-0 transition-opacity group-hover:opacity-100">
                        Visit ↗
                      </span>
                    )}
                  </span>
                  <span className="mt-[4px] block text-[12.5px] leading-[1.6] text-[#3D3652]">
                    {e.detail || e.desc}
                  </span>
                </span>
              </>
            )
            const cls =
              "group flex items-start gap-[14px] border-b border-[#F1EFF5] py-[15px] no-underline last:border-b-0"
            return e.url ? (
              <a
                key={e.name}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cls + " -mx-3 rounded-[12px] px-3 transition-colors hover:bg-[#F8F5FE]"}
              >
                {inner}
              </a>
            ) : (
              <span key={e.name} className={cls}>
                {inner}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null
}

/* ── 카테고리 카드 (카드 전체 클릭 → 상세 모달) ── */
function CategoryCard({
  cat,
  onOpen,
}: {
  cat: LandscapeCategory
  onOpen: (cat: LandscapeCategory) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(cat)}
      className="flex w-full cursor-pointer flex-col rounded-[14px] border bg-white px-[18px] pb-[10px] pt-4 text-left"
      style={{ borderColor: "#E4E1EE", transition: "border-color .15s, box-shadow .15s, transform .15s" }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.borderColor = "#C7B8E8"
        ev.currentTarget.style.boxShadow = "0 8px 24px rgba(91,61,135,.14)"
        ev.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.borderColor = "#E4E1EE"
        ev.currentTarget.style.boxShadow = "none"
        ev.currentTarget.style.transform = "none"
      }}
    >
      <div className="mb-2 flex items-center gap-[10px]">
        <span className="flex-1 text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1626]">
          {cat.name}
        </span>
        <span className="text-[11px] font-extrabold text-[#9E97B3]">{cat.entities.length}</span>
      </div>
      <div className="flex flex-col">
        {cat.entities.map((e) => (
          <EntityRow key={e.name} e={e} code={cat.code} />
        ))}
      </div>
    </button>
  )
}

/* ── ② Rising Star — 정적 샘플 ── */
function RisingStarSample() {
  return (
    <div
      className="relative rounded-[14px] border bg-white px-6 py-[22px]"
      style={{ borderColor: "#E4E1EE" }}
    >
      <span
        className="absolute left-0 top-0 rounded-br-[4px] rounded-tl-[5px] px-[10px] py-[5px] text-[10px] font-extrabold tracking-[0.3px] text-white"
        style={{ background: "#7B5EA7" }}
      >
        HOT
      </span>
      <span
        className="absolute right-[14px] top-[12px] rounded-[6px] border px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.5px] text-[#9E97B3]"
        style={{ background: "#F3F1F6", borderColor: "#E4E1EE" }}
      >
        sample
      </span>
      <span className="mb-[6px] mt-[6px] block text-[11px] font-bold text-[#7B5EA7]">
        Framework to Watch
      </span>
      <h3 className="mb-[6px] text-[22px] font-extrabold tracking-[-0.4px] text-[#1A1626]">Agent</h3>
      <p className="mb-4 max-w-[560px] text-[13px] leading-[1.6] text-[#5A5568]">
        Agent frameworks are drawing the most activity this cycle, concentrated around multi-agent
        orchestration. This card is a placeholder — the ranking model is still being defined.
      </p>
      <div className="flex gap-7">
        <div>
          <b className="block text-[18px] font-extrabold leading-[1.2] text-[#1A1626]">24</b>
          <span className="text-[11px] text-[#9E97B3]">recent updates</span>
        </div>
        <div>
          <b className="block text-[18px] font-extrabold leading-[1.2] text-[#2E8B6F]">+38%</b>
          <span className="text-[11px] text-[#9E97B3]">vs prior period</span>
        </div>
        <div>
          <b className="block text-[18px] font-extrabold leading-[1.2] text-[#1A1626]">4</b>
          <span className="text-[11px] text-[#9E97B3]">frameworks tracked</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-[7px]">
        {[
          ["LangGraph", "9"],
          ["CrewAI", "6"],
          ["AutoGen", "5"],
          ["Swarm", "4"],
        ].map(([n, c]) => (
          <span
            key={n}
            className="inline-flex items-center gap-[6px] rounded-[8px] border px-[10px] py-[5px] text-[11.5px] font-semibold text-[#7B5EA7]"
            style={{ background: "#F3EFFA", borderColor: "#C7B8E8" }}
          >
            {n} <span className="font-bold text-[#9E97B3]">{c}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── ③ Recent Updates 행 (실제 기사) ── */
function ArticleRow({ item }: { item: FrameworksArticleItem }) {
  const dot = articleDot(item.categoryName)
  const score = Math.max(0, Math.min(5, item.score))
  return (
    <div className="flex items-start gap-[14px] border-b py-[15px] last:border-b-0" style={{ borderColor: "#E4E1EE" }}>
      <span className="mt-[6px] block h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <p className="mb-[3px] text-[15px] font-bold leading-[1.35] text-[#1A1626]">{item.title}</p>
        {item.oneLiner && (
          <p
            className="mb-[7px] text-[12.5px] leading-[1.5] text-[#6E6A78]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {item.oneLiner}
          </p>
        )}
        <div className="flex items-center gap-[9px] text-[11px] text-[#9E97B3]">
          {item.categoryName && (
            <span className="font-bold" style={{ color: dot }}>
              {item.categoryName}
            </span>
          )}
          <span className="text-[11px] tracking-[1px] text-[#C7791B]">
            {"★".repeat(score)}
            <span className="text-[#D8D3E2]">{"★".repeat(5 - score)}</span>
          </span>
          <span>
            {item.entityName ? `${item.entityName} · ` : ""}
            {item.date}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── 섹션 헤더 ── */
function SectionHead({ title, desc, first }: { title: string; desc: string; first?: boolean }) {
  return (
    <div
      className="mb-4 flex items-baseline gap-[10px]"
      style={{ marginTop: first ? 36 : 52 }}
    >
      <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{title}</h2>
      <span className="text-[12.5px] text-[#9E97B3]">{desc}</span>
    </div>
  )
}

/* ── 페이지 ── */
export function NDFrameworksPage() {
  const [categories, setCategories] = useState<LandscapeCategory[]>([])
  const [articles, setArticles] = useState<FrameworksArticleItem[]>([])
  const [loading, setLoading] = useState(true)
  // 상세 모달 — 선택된 카테고리(그 안 3~5개를 전부 상세히 표시)
  const [selected, setSelected] = useState<LandscapeCategory | null>(null)

  useEffect(() => {
    // ① Landscape — 정적 JSON (Building Blocks 방식)
    fetch("/frameworks/landscape.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d: LandscapeData) => setCategories(d.categories))
      .catch(console.error)

    // ③ Recent Updates — 실제 DB 기사 (categories/risingstar는 사용 안 함)
    fetchFrameworks()
      .then((fw) => setArticles(fw.articles))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    // Landscape는 최대 1160px까지 넓혀 화면 폭에 따라 1~4단. 나머지는 940px 읽기 폭.
    <div className="max-w-[1160px]">
      <div className="max-w-[940px]">
        <h1 className="m-0 mb-[4px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">
          Frameworks &amp; SDK
        </h1>
        <p className="mb-[30px] text-[13.5px] text-[#9E97B3]">
          The AI framework and SDK landscape by category — plus what&apos;s gaining momentum this cycle.
        </p>
      </div>

      {/* ① Landscape — 카드 크기 유지, 개수는 화면 폭에 맞춰 auto-fill(최대 4단) */}
      <SectionHead first title="Landscape" desc="Frameworks and SDKs across the ecosystem" />
      {categories.length === 0 ? (
        <p className="text-[13px] text-[#9E97B3]">Loading…</p>
      ) : (
        <div
          className="grid gap-[12px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {categories.map((cat) => (
            <CategoryCard key={cat.code} cat={cat} onOpen={setSelected} />
          ))}
        </div>
      )}

      <div className="max-w-[940px]">
        {/* ② Rising Star (sample) */}
        <SectionHead title="Rising Star" desc="The category drawing the most attention" />
        <RisingStarSample />

        {/* ③ Recent Updates (real) */}
        <SectionHead title="Recent Updates" desc="Latest releases and articles" />
        {articles.length === 0 ? (
          <p className="text-[13px] text-[#9E97B3]">
            {loading ? "Loading…" : "No updates yet."}
          </p>
        ) : (
          <div className="flex flex-col">
            {articles.map((item) => (
              <ArticleRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <div className="h-8" aria-hidden />

      {selected && (
        <CategoryModal cat={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
