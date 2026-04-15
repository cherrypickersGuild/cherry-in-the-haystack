"use client"

import { useState, useEffect } from "react"
import {
  fetchModelUpdatesRank,
  fetchPatchNotes,
  ModelUpdatesRankItem,
  ModelUpdatesRisingstar,
  ModelUpdatesRankResponse,
  PatchNoteItem,
} from "@/lib/api"

/* ─────────────────────────────────────────────
   Category color map
───────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string; track: string }> = {
  "OpenAI Family":    { color: "#4B78F0", bg: "#F8F9FF", border: "#C8D5F8", track: "#EEF2FD" },
  "Anthropic Family": { color: "#C94B6E", bg: "#FDF7F8", border: "#F2C4CE", track: "#FDF0F3" },
  "Google Family":    { color: "#7B5EA7", bg: "#F9F7FD", border: "#C7B8E8", track: "#F3EFFA" },
  "xAI Family":       { color: "#E94057", bg: "#FFF8F8", border: "#FECDD3", track: "#FEF2F2" },
  "Meta Family":      { color: "#5A8DFF", bg: "#F8FAFF", border: "#C8D5F8", track: "#EEF2FD" },
  "DeepSeek Family":  { color: "#6AA8A0", bg: "#F5FAFA", border: "#B8D8D4", track: "#EEF7F6" },
  "Mistral Family":   { color: "#D4854A", bg: "#FFFAF5", border: "#F0D8B0", track: "#FEF3E2" },
}
const DEFAULT_STYLE = { color: "#9E97B3", bg: "#FFFFFF", border: "#E4E1EE", track: "#F2F0F7" }
const getCat = (name: string) => CATEGORY_COLORS[name] ?? DEFAULT_STYLE

const CATEGORY_LOGOS: Record<string, string> = {
  "OpenAI Family":    "/logos/openai.svg",
  "Anthropic Family": "/logos/anthropic.svg",
  "Google Family":    "/logos/google.svg",
  "xAI Family":       "/logos/xai.svg",
  "Meta Family":      "/logos/meta.svg",
  "DeepSeek Family":  "/logos/deepseek.svg",
  "Mistral Family":   "/logos/mistral.svg",
}

/* ─────────────────────────────────────────────
   Skeleton placeholder data
───────────────────────────────────────────── */
const SKELETON_RANKS: ModelUpdatesRankItem[] = [
  { rank: 1, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "OpenAI Family" },
  { rank: 2, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "Anthropic Family" },
  { rank: 3, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "Google Family" },
  { rank: 4, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "Meta Family" },
  { rank: 5, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "xAI Family" },
  { rank: 6, prev_rank: null, article_count: 0, prev_article_count: 0, change_pct: null, top_entities_json: [], category_name: "Mistral Family" },
]

const SKELETON_STAR: ModelUpdatesRisingstar = {
  categoryName: "OpenAI Family", isNew: false, changePct: null, articleCount: 0, topEntities: [],
}

const SKELETON_ARTICLES: PatchNoteItem[] = Array.from({ length: 5 }, (_, i) => ({
  id: `sk-${i}`, articleStateId: `sk-${i}`, date: "Apr 7", page: "MODEL_UPDATES",
  area: "Models", categoryName: "OpenAI Family", dotColor: "#4B78F0",
  entityName: "GPT-5", title: "Placeholder title for skeleton", oneLiner: "One liner placeholder text",
  score: 4, isRead: false, sideCategory: null,
}))

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ count, color = "#D4854A" }: { count: number; color?: string }) {
  return (
    <span className="flex items-center gap-[1px] text-[12px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Sparkline SVG
───────────────────────────────────────────── */
function Sparkline({ color = "#D4854A" }: { color?: string }) {
  const points = "10,70 40,62 70,54 100,44 130,32 160,20 190,12"
  return (
    <div className="rounded-[8px] border p-3" style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">2-week momentum</p>
      <svg viewBox="0 0 200 80" className="w-full h-16">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="78" x2="200" y2="78" stroke="#E4E1EE" strokeWidth="1" />
        <polygon points={`${points} 190,78 10,78`} fill="url(#sparkFill)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="190" cy="12" r="3.5" fill={color} />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Rank Card
───────────────────────────────────────────── */
function RankCard({ item, size = "sm", loading }: { item: ModelUpdatesRankItem; size?: "lg" | "md" | "sm"; loading?: boolean }) {
  const style = getCat(item.category_name)
  const logo = CATEGORY_LOGOS[item.category_name]
  const topEntities = [...item.top_entities_json].sort((a, b) => b.article_count - a.article_count).slice(0, 3)
  const pct = item.change_pct !== null ? Number(item.change_pct) : null
  const txt = loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"

  const logoSize = size === "lg" ? "w-12 h-12" : size === "md" ? "w-6 h-6" : "w-5 h-5"
  const entityIndent = size === "lg" ? "" : size === "md" ? "pl-8" : "pl-7"
  const titleSize = size === "lg" ? "text-[24px]" : size === "md" ? "text-[15px]" : "text-[13px]"
  const entitySize = size === "lg" ? "text-[13px]" : "text-[10px]"
  const entityWeight = size === "lg"
  const entityCountSize = size === "lg" ? "text-[12px]" : "text-[10px]"
  const entityGap = size === "lg" ? "gap-2.5" : "gap-1.5"
  const padding = size === "lg" ? "pt-6 px-6 pb-3" : "pt-4 px-4 pb-2"

  const badge = !loading && item.prev_rank === null ? (
    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ backgroundColor: "#C94B6E", color: "#FFF" }}>NEW</span>
  ) : !loading && pct !== null && pct !== 0 ? (
    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${txt}`}
      style={{ backgroundColor: pct > 0 ? "#EFF7F3" : "#FDF0F3", color: pct > 0 ? "#2D7A5E" : "#C94B6E" }}
    >
      {pct > 0 ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  ) : null

  return (
    <div
      className={`rounded-[10px] border ${padding} transition-colors hover:!border-[#7B5EA7] h-full flex flex-col relative`}
      style={{ backgroundColor: size === "lg" ? style.bg : "#FFFFFF", borderColor: size === "lg" ? style.border : "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {badge && <div className="absolute top-3 right-3 flex flex-col items-end gap-1">{badge}</div>}
      <span className={`absolute bottom-3 right-3 ${size === "sm" ? "text-[9px]" : "text-[11px]"} font-bold text-[#9E97B3] ${txt}`}>#{item.rank}</span>
      {size === "lg" ? (
        <>
          <div className="flex flex-col items-center justify-center gap-1.5 flex-1">
            {logo && (
              <img src={logo} alt="" className={`${logoSize} flex-shrink-0`} style={{ color: style.color }} />
            )}
            <p className={`font-bold text-[#1A1626] ${titleSize} ${txt}`}>
              {item.category_name.replace(" Family", "")}
            </p>
          </div>
          <div className={`flex flex-col ${entityGap} ${txt}`}>
            {!loading && topEntities.length > 0 ? (
              topEntities.map((entity, idx) => (
                <div key={entity.id}>
                  <span className={`truncate ${idx === 0 ? "font-bold" : "font-medium"} ${entitySize}`} style={{ color: idx === 0 ? style.color : "#3D3652" }}>
                    {entity.name}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[13px] text-[#9E97B3]">—</span>
            )}
          </div>
        </>
      ) : size === "md" ? (
        <>
          <div className="flex flex-col items-center justify-end gap-1.5 flex-1">
            {logo && (
              <img src={logo} alt="" className={`${logoSize} flex-shrink-0`} style={{ color: style.color }} />
            )}
            <p className={`font-bold text-[#1A1626] ${titleSize} ${txt}`}>
              {item.category_name.replace(" Family", "")}
            </p>
          </div>
          <div className={`flex flex-col ${entityGap} ${txt}`}>
            {!loading && topEntities.length > 0 ? (
              topEntities.map((entity, idx) => (
                <div key={entity.id}>
                  <span className={`truncate ${idx === 0 ? "font-medium" : "font-normal"} ${entitySize}`} style={{ color: idx === 0 ? style.color : "#9E97B3" }}>
                    {entity.name}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[13px] text-[#9E97B3]">—</span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1">
            {logo && (
              <img src={logo} alt="" className={`${logoSize} flex-shrink-0`} style={{ color: style.color }} />
            )}
            <p className={`font-bold text-[#1A1626] truncate ${titleSize} ${txt}`}>
              {item.category_name.replace(" Family", "")}
            </p>
          </div>
          <div className={`flex flex-col gap-1 flex-1 ${txt}`}>
            {!loading && topEntities.length > 0 ? (
              topEntities.map((entity, idx) => (
                <div key={entity.id}>
                  <span className={`truncate ${idx === 0 ? "font-medium" : "font-normal"} ${entitySize}`} style={{ color: idx === 0 ? style.color : "#9E97B3" }}>
                    {entity.name}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[13px] text-[#9E97B3]">—</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Rising Star Card
───────────────────────────────────────────── */
function RisingStarCard({ star, loading }: { star: ModelUpdatesRisingstar; loading?: boolean }) {
  const style = getCat(star.categoryName)
  const topEntity = star.topEntities[0]
  const pct = star.changePct !== null ? Number(star.changePct) : null
  const summary = topEntity
    ? `${topEntity.article_count} articles this week featuring ${topEntity.name}.${star.isNew ? " First time in rankings." : pct && pct > 0 ? ` Up ${pct}% from last week.` : ""}`
    : `${star.articleCount} articles this week in ${star.categoryName}.`
  const txt = loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"

  return (
    <div
      className="flex flex-col lg:flex-row items-center gap-5 rounded-[10px] border p-5"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex-1 min-w-0">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2 ${txt}`}
          style={{ backgroundColor: "#FEF3E2", color: "#D4854A", borderColor: "#F0D8B0" }}
        >
          Rising Star — Model to Watch
        </span>
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`text-[20px] font-bold text-[#1A1626] ${txt}`}>{topEntity?.name ?? star.categoryName}</h3>
          {!loading && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: "#D4854A" }}
            >
              {star.isNew ? "NEW" : "HOT"}
            </span>
          )}
        </div>
        <p className={`text-[13px] leading-relaxed mb-4 ${txt}`} style={{ color: "#3D3652" }}>{summary}</p>
        <div className={`flex items-center gap-5 ${txt}`}>
          <div>
            <p className="text-[14px] font-bold text-[#1A1626]">{star.articleCount}</p>
            <p className="text-[11px] text-[#9E97B3]">articles this week</p>
          </div>
          {pct !== null && (
            <div>
              <p className="text-[14px] font-bold" style={{ color: pct >= 0 ? "#10B981" : "#D4854A" }}>
                {pct >= 0 ? "+" : ""}{pct}%
              </p>
              <p className="text-[11px] text-[#9E97B3]">vs last week</p>
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-[180px] lg:flex-shrink-0">
        <Sparkline color="#D4854A" />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Article Item
───────────────────────────────────────────── */
function ArticleItem({ item, loading }: { item: PatchNoteItem; loading?: boolean }) {
  const style = getCat(item.categoryName)
  const initials = item.categoryName
    ? item.categoryName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : item.entityName.slice(0, 2).toUpperCase()
  const txt = loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"

  return (
    <div
      className="bg-white rounded-[10px] border border-[#E4E1EE] p-4 flex gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${style.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border"
        style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
      >
        <span className={txt}>{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-bold text-[#1A1626] mb-1 leading-snug ${txt}`}>{item.title}</p>
        <p className={`text-[13px] text-[#9E97B3] leading-relaxed mb-2 line-clamp-2 ${txt}`}>{item.oneLiner}</p>
        <div className={`flex items-center gap-2 ${txt}`}>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
          >
            {(item.categoryName || item.area).replace(" Family", "")}
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
export function NDModelUpdatesPage() {
  const [rankData, setRankData] = useState<ModelUpdatesRankResponse | null>(null)
  const [articles, setArticles] = useState<PatchNoteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchModelUpdatesRank(), fetchPatchNotes()])
      .then(([rank, notes]) => {
        setRankData(rank)
        setArticles(notes.items.filter((item) => item.page === "MODEL_UPDATES"))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const displayRanks = loading ? SKELETON_RANKS : (rankData?.ranks ?? SKELETON_RANKS)
  const displayStar  = loading ? SKELETON_STAR  : (rankData?.risingStars[0] ?? null)
  const displayArticles = loading ? SKELETON_ARTICLES : articles


  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <h1 className="font-extrabold text-[#1A1626] mb-2 leading-tight text-[22px] lg:text-[30px]" style={{ letterSpacing: "-0.5px" }}>
        Model Updates
      </h1>
      <p className={`text-[13px] text-[#9E97B3] mb-6 transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}>
        {rankData
          ? `${rankData.ranks.reduce((s, r) => s + r.article_count, 0)} releases this week · ${rankData.weekStart} – ${rankData.weekEnd}`
          : "—"}
      </p>

      {/* ── Section 1: Major Players ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">Major Players</h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto] gap-[10px]">
          {displayRanks.map((item, i) => {
            const size = i === 0 ? "lg" : i <= 2 ? "md" : "sm"
            const gridClass =
              i === 0 ? "lg:col-span-2 lg:row-span-2" :
              i === 1 ? "lg:col-span-2" :
              i === 2 ? "lg:col-span-2" :
              ""
            return (
              <div key={item.category_name} className={gridClass}>
                <RankCard item={item} size={size} loading={loading} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 2: Rising Star ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">Rising Star</h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>
        <RisingStarCard star={displayStar ?? SKELETON_STAR} loading={loading || !displayStar} />
      </div>

      {/* ── Section 3: All Model Updates ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">All Model Updates</h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>
        <div className="flex flex-col gap-3">
          {displayArticles.map((item, i) => (
            <ArticleItem key={loading ? `sk-${i}` : item.id} item={item} loading={loading} />
          ))}
        </div>
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
