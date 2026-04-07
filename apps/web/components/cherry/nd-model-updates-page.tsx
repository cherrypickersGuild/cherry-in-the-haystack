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

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ count, color = "#C94B6E" }: { count: number; color?: string }) {
  return (
    <span className="flex items-center gap-[1px] text-[12px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Progress Bar
───────────────────────────────────────────── */
function ProgressBar({ value, color, trackColor = "#EEF2FD" }: { value: number; color: string; trackColor?: string }) {
  return (
    <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: trackColor }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sparkline SVG (상승 곡선)
───────────────────────────────────────────── */
function Sparkline({ color = "#C94B6E" }: { color?: string }) {
  const points = "10,70 40,62 70,54 100,44 130,32 160,20 190,12"
  return (
    <div className="rounded-[8px] border p-3" style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">
        2-week momentum
      </p>
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
function RankCard({ item, maxCount, isLead }: { item: ModelUpdatesRankItem; maxCount: number; isLead: boolean }) {
  const style = getCat(item.category_name)
  const barWidth = maxCount > 0 ? Math.round((item.article_count / maxCount) * 100) : 0
  const topEntity = item.top_entities_json[0]
  const pct = item.change_pct !== null ? Number(item.change_pct) : null

  return (
    <div
      className={`rounded-[10px] border p-4 transition-shadow hover:shadow-md ${isLead ? "lg:col-span-3" : ""}`}
      style={{ backgroundColor: style.bg, borderColor: style.border, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-bold text-[#9E97B3]">#{item.rank}</span>
        {item.prev_rank === null ? (
          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ backgroundColor: "#C94B6E", color: "#FFF" }}>NEW</span>
        ) : pct !== null && pct !== 0 ? (
          <span
            className="px-1.5 py-0.5 rounded-full text-[8px] font-bold"
            style={{ backgroundColor: pct > 0 ? "#EFF7F3" : "#FDF0F3", color: pct > 0 ? "#2D7A5E" : "#C94B6E" }}
          >
            {pct > 0 ? "↑" : "↓"} {Math.abs(pct)}%
          </span>
        ) : null}
      </div>

      <p className={`font-bold text-[#1A1626] mb-1 ${isLead ? "text-[16px]" : "text-[14px]"}`}>
        {item.category_name.replace(" Family", "")}
      </p>

      <p className={`font-bold mb-2 ${isLead ? "text-[22px]" : "text-[18px]"}`} style={{ color: style.color }}>
        {item.article_count} articles
      </p>

      <ProgressBar value={barWidth} color={style.color} trackColor={style.track} />

      <div className="flex items-center justify-between mt-2">
        {topEntity && (
          <p className="text-[11px] text-[#9E97B3] truncate">{topEntity.name}</p>
        )}
        {item.prev_article_count > 0 && (
          <p className="text-[10px] text-[#9E97B3] flex-shrink-0 ml-2">prev {item.prev_article_count}</p>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Rising Star Card (원본 디자인 유지)
───────────────────────────────────────────── */
function RisingStarCard({ star }: { star: ModelUpdatesRisingstar }) {
  const style = getCat(star.categoryName)
  const topEntity = star.topEntities[0]
  const pct = star.changePct !== null ? Number(star.changePct) : null

  return (
    <div
      className="flex flex-col lg:flex-row items-start gap-6 rounded-[10px] border p-5"
      style={{ backgroundColor: "#FFF8EF", borderColor: "#F0D8B0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Left */}
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border mb-2"
          style={{ backgroundColor: "#FEF3E2", color: "#D4854A", borderColor: "#F0D8B0" }}
        >
          {star.isNew ? "New Entry" : "Rising Star"} — This Week
        </span>

        <h3 className="text-[16px] font-bold text-[#1A1626] mb-1">
          {topEntity?.name ?? star.categoryName}
        </h3>

        <p className="text-[13px] text-[#9E97B3] mb-1">{star.categoryName}</p>

        <p className="text-[13px] leading-relaxed mt-2 mb-4" style={{ color: "#3D3652" }}>
          {topEntity
            ? `${topEntity.article_count} articles this week featuring ${topEntity.name}. ${star.isNew ? "First time in rankings." : pct && pct > 0 ? `Up ${pct}% from last week.` : ""}`
            : `${star.articleCount} articles this week in ${star.categoryName}.`
          }
        </p>

        <div className="flex items-center gap-4">
          {[
            { num: String(star.articleCount), label: "articles" },
            pct !== null ? { num: `${pct > 0 ? "+" : ""}${pct}%`, label: "vs prev week" } : null,
            { num: star.isNew ? "NEW" : `#1`, label: star.isNew ? "entry" : "rank" },
          ].filter(Boolean).map((s) => s && (
            <div key={s.label}>
              <p className="text-[16px] font-bold text-[#1A1626]">{s.num}</p>
              <p className="text-[10px] text-[#9E97B3]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right sparkline */}
      <div className="w-full lg:w-[200px] lg:flex-shrink-0">
        <Sparkline color={style.color} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Article Item (patch notes 스타일)
───────────────────────────────────────────── */
function ArticleItem({ item }: { item: PatchNoteItem }) {
  const style = getCat(item.categoryName)
  const initials = item.categoryName
    ? item.categoryName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : item.entityName.slice(0, 2).toUpperCase()

  return (
    <div
      className="bg-white rounded-[10px] border border-[#E4E1EE] p-4 flex gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${style.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border"
        style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
      >
        {initials}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[#1A1626] mb-1 leading-snug">{item.title}</p>
        <p className="text-[13px] text-[#9E97B3] leading-relaxed mb-2 line-clamp-2">{item.oneLiner}</p>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
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

  const maxCount = rankData ? Math.max(...rankData.ranks.map((r) => r.article_count)) : 1
  const topStar = rankData?.risingStars[0] ?? null

  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <h1
        className="font-extrabold text-[#1A1626] mb-2 leading-tight text-[20px] lg:text-[26px]"
        style={{ letterSpacing: "-0.3px" }}
      >
        Model Updates
      </h1>
      <p className="text-[13px] text-[#9E97B3] mb-6">
        {loading ? "Loading..." : rankData
          ? `${rankData.ranks.reduce((s, r) => s + r.article_count, 0)} releases this week · ${rankData.weekStart} – ${rankData.weekEnd}`
          : "—"
        }
      </p>

      {loading && (
        <div className="text-[13px] text-[#9E97B3] py-12 text-center">Loading…</div>
      )}

      {!loading && rankData && (
        <>
          {/* ── Section 1: Leaderboard ── */}
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-3">
              Major Players — Article Count This Week
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
              {rankData.ranks.map((item, i) => (
                <RankCard key={item.category_name} item={item} maxCount={maxCount} isLead={i === 0} />
              ))}
            </div>
          </div>

          {/* ── Section 2: Rising Star (1개만) ── */}
          {topStar && (
            <div className="mb-6">
              <RisingStarCard star={topStar} />
            </div>
          )}

          {/* ── Section 3: All Model Updates ── */}
          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-3">
              All Model Updates This Week
            </p>

            {articles.length === 0 ? (
              <div className="text-[13px] text-[#9E97B3] py-6 text-center">No articles found</div>
            ) : (
              <div className="flex flex-col gap-[10px]">
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
