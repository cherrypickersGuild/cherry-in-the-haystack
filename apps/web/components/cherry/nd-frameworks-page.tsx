
"use client"

import { useEffect, useState } from "react"
import {
  fetchFrameworks,
  FrameworkCategoryItem,
  FrameworksRisingstar,
  FrameworksArticleItem,
} from "@/lib/api"

/* ─────────────────────────────────────────────
   Category color map (by code — for hierarchy boxes)
───────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, string> = {
  "agent":        "#E94057",
  "fine-tuning":  "#8B5CF6",
  "rag":          "#7C3AED",
  "prompt-eng":   "#DC2626",
  "serving":      "#10B981",
  "data-storage": "#F97316",
  "llmops":       "#0194E2",
  "observability":"#7B5EA7",
}

const CATEGORY_ICONS: Record<string, string> = {
  "agent":        "🤖",
  "fine-tuning":  "🎯",
  "rag":          "🔍",
  "prompt-eng":   "✏️",
  "serving":      "📬",
  "data-storage": "🗄️",
  "llmops":       "⚙️",
  "observability":"📊",
}

/* Article color map (by categoryName display name — for article list) */
const ARTICLE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "Agent":              { color: "#E94057", bg: "#FFF8F9", border: "#FECDD3" },
  "Fine-Tuning":        { color: "#8B5CF6", bg: "#FAF8FF", border: "#DDD6FE" },
  "RAG":                { color: "#7C3AED", bg: "#F9F7FD", border: "#C4B5FD" },
  "Prompt Engineering": { color: "#DC2626", bg: "#FFF8F8", border: "#FECACA" },
  "Serving":            { color: "#10B981", bg: "#F5FAFA", border: "#A7F3D0" },
  "Data & Storage":     { color: "#F97316", bg: "#FFFAF5", border: "#FED7AA" },
  "LLMOps":             { color: "#0194E2", bg: "#F5FAFF", border: "#BAE6FD" },
  "Observability":      { color: "#7B5EA7", bg: "#F3EFFA", border: "#C7B8E8" },
}
const DEFAULT_ARTICLE_STYLE = { color: "#9E97B3", bg: "#FFFFFF", border: "#E4E1EE" }
const getArticleStyle = (name: string) => ARTICLE_COLORS[name] ?? DEFAULT_ARTICLE_STYLE

function getCategoryColor(code: string) {
  return CATEGORY_COLORS[code] ?? "#9E97B3"
}

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ count, color = "#7B5EA7" }: { count: number; color?: string }) {
  return (
    <span className="flex items-center gap-[1px] text-[12px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Entity Pill
───────────────────────────────────────────── */
function EntityPill({ name, isSpotlight, color }: { name: string; isSpotlight: boolean; color: string }) {
  const abbr = name.slice(0, 2).toUpperCase()
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] border transition-colors"
      style={{
        backgroundColor: isSpotlight ? "#FDF0F3" : "#F2F0F7",
        borderColor: isSpotlight ? "#F2C4CE" : "#E4E1EE",
      }}
    >
      <div
        className="w-5 h-5 rounded-[4px] flex items-center justify-center flex-shrink-0 text-white"
        style={{ backgroundColor: color, fontSize: "7px", fontWeight: 700 }}
      >
        {abbr}
      </div>
      <span className="text-[10px] font-medium" style={{ color: isSpotlight ? "#C94B6E" : "#1A1626" }}>
        {name}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Category Card
───────────────────────────────────────────── */
function CategoryCard({ cat }: { cat: FrameworkCategoryItem }) {
  const color = getCategoryColor(cat.code)
  const icon = CATEGORY_ICONS[cat.code] ?? "📦"
  return (
    <div
      className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="text-[18px] mb-1">{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">{cat.name}</p>
      <div className="flex flex-col gap-1.5">
        {cat.entities.map((e) => (
          <EntityPill key={e.id} name={e.name} isSpotlight={e.isSpotlight} color={color} />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sparkline
───────────────────────────────────────────── */
function Sparkline() {
  const pts = [55, 50, 48, 45, 42, 38, 32, 28, 22, 18, 12, 8]
  const w = 180
  const h = 50
  const step = w / (pts.length - 1)
  const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[50px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fw-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7B5EA7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#7B5EA7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#fw-spark-fill)" />
      <path d={d} fill="none" stroke="#7B5EA7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Rising Star Card
───────────────────────────────────────────── */
function RisingStarCard({ rs }: { rs: FrameworksRisingstar }) {
  const pct = rs.changePct !== null ? Number(rs.changePct) : null
  const topEntity = rs.topEntities?.[0]
  const summary = topEntity
    ? `${topEntity.article_count} articles this week featuring ${topEntity.name}.${rs.isNew ? " First time in rankings." : pct && pct > 0 ? ` Up ${pct}% from last week.` : ""}`
    : `${rs.articleCount} articles this week in ${rs.categoryName}.`

  return (
    <div
      className="flex flex-col lg:flex-row items-start gap-5 rounded-[10px] border p-5"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2"
          style={{ backgroundColor: "#F3EFFA", color: "#7B5EA7", borderColor: "#D4C9EE" }}
        >
          Rising Star — Framework to Watch
        </span>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[20px] font-bold text-[#1A1626]">{rs.categoryName}</h3>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: rs.isNew ? "#E94057" : "#7B5EA7" }}>
            {rs.isNew ? "NEW" : "HOT"}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#3D3652" }}>{summary}</p>
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[14px] font-bold text-[#1A1626]">{rs.articleCount}</p>
            <p className="text-[11px] text-[#9E97B3]">articles this week</p>
          </div>
          {pct !== null && (
            <div>
              <p className="text-[14px] font-bold" style={{ color: pct >= 0 ? "#10B981" : "#E94057" }}>
                {pct >= 0 ? "+" : ""}{pct}%
              </p>
              <p className="text-[11px] text-[#9E97B3]">vs last week</p>
            </div>
          )}
          {rs.isNew && (
            <div>
              <p className="text-[14px] font-bold text-[#E94057]">NEW</p>
              <p className="text-[11px] text-[#9E97B3]">first appearance</p>
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-[180px] lg:flex-shrink-0">
        <div className="rounded-[10px] border p-3" style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">Trend</p>
          <Sparkline />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Article Item
───────────────────────────────────────────── */
function ArticleItem({ item }: { item: FrameworksArticleItem }) {
  const style = getArticleStyle(item.categoryName)
  const initials = item.categoryName
    ? item.categoryName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : item.entityName.slice(0, 2).toUpperCase()

  return (
    <div
      className="bg-white rounded-[10px] border border-[#E4E1EE] p-4 flex gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${style.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border"
        style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[#1A1626] mb-1 leading-snug">{item.title}</p>
        <p className="text-[13px] text-[#9E97B3] leading-relaxed mb-2 line-clamp-2">{item.oneLiner}</p>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
          >
            {item.categoryName || item.entityName}
          </span>
          <Stars count={item.score} color={style.color} />
          <span className="text-[11px] text-[#9E97B3]">{item.entityName} · {item.date}</span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function NDFrameworksPage() {
  const [categories, setCategories] = useState<FrameworkCategoryItem[]>([])
  const [risingstar, setRisingstar] = useState<FrameworksRisingstar | null>(null)
  const [articles, setArticles] = useState<FrameworksArticleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFrameworks()
      .then((fw) => {
        setCategories(fw.categories)
        setRisingstar(fw.risingstar)
        setArticles(fw.articles)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[900px]">
      <h1
        className="font-extrabold text-[#1A1626] mb-2 leading-tight text-[20px] lg:text-[26px]"
        style={{ letterSpacing: "-0.3px" }}
      >
        Frameworks
      </h1>
      <p className="text-[13px] text-[#9E97B3] mb-7">
        Browse the AI framework landscape by category and discover the rising star of the week.
      </p>

      {loading ? (
        <div className="text-[13px] text-[#9E97B3] py-12 text-center">Loading…</div>
      ) : (
        <>
          {/* ── Section 1: Framework Landscape ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">Framework Landscape</h2>
              <div className="flex-1 border-t border-[#E4E1EE]" />
            </div>
            {categories.length === 0 ? (
              <p className="text-[13px] text-[#9E97B3]">No data available</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
                {categories.map((cat) => (
                  <CategoryCard key={cat.id} cat={cat} />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 2: Rising Star ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">Rising Star</h2>
              <div className="flex-1 border-t border-[#E4E1EE]" />
            </div>
            {risingstar ? (
              <RisingStarCard rs={risingstar} />
            ) : (
              <p className="text-[13px] text-[#9E97B3]">No FRAMEWORKS articles in the last 14 days</p>
            )}
          </div>

          {/* ── Section 3: All Framework Updates ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">All Framework Updates</h2>
              <div className="flex-1 border-t border-[#E4E1EE]" />
            </div>
            {articles.length === 0 ? (
              <div className="text-[13px] text-[#9E97B3] py-6 text-center">No articles found</div>
            ) : (
              <div className="flex flex-col gap-3">
                {articles.map((item) => (
                  <ArticleItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="h-8" aria-hidden />
    </div>
  )
}
