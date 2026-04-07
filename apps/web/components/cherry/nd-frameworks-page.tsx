
"use client"

import { useEffect, useState } from "react"
import {
  fetchFrameworks,
  FrameworkCategoryItem,
  FrameworksRisingstar,
} from "@/lib/api"

/* ─────────────────────────────────────────────
   Category color map (by code)
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

function getCategoryColor(code: string) {
  return CATEGORY_COLORS[code] ?? "#9E97B3"
}

/* ─────────────────────────────────────────────
   Entity Pill
───────────────────────────────────────────── */
function EntityPill({
  name,
  isSpotlight,
  color,
}: {
  name: string
  isSpotlight: boolean
  color: string
}) {
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
      <span
        className="text-[10px] font-medium"
        style={{ color: isSpotlight ? "#C94B6E" : "#1A1626" }}
      >
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
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">
        {cat.name}
      </p>
      <div className="flex flex-col gap-1.5">
        {cat.entities.map((e) => (
          <EntityPill key={e.id} name={e.name} isSpotlight={e.isSpotlight} color={color} />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sparkline (upward curve)
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
  return (
    <div
      className="flex flex-col lg:flex-row items-start gap-5 rounded-[10px] border p-5"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Left */}
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2"
          style={{ backgroundColor: "#F3EFFA", color: "#7B5EA7", borderColor: "#D4C9EE" }}
        >
          Rising Star — Framework to Watch
        </span>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[20px] font-bold text-[#1A1626]">{rs.entityName}</h3>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
            style={{ backgroundColor: "#7B5EA7" }}
          >
            HOT
          </span>
        </div>
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#3D3652" }}>
          {rs.oneLiner}
        </p>
        <p className="text-[12px]" style={{ color: "#9E97B3" }}>{rs.title}</p>
        <div className="flex items-center gap-4 mt-3">
          <div>
            <p className="text-[14px] font-bold text-[#1A1626]">{rs.score}/5</p>
            <p className="text-[11px] text-[#9E97B3]">AI Score</p>
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#1A1626]">{rs.date}</p>
            <p className="text-[11px] text-[#9E97B3]">Published</p>
          </div>
        </div>
      </div>

      {/* Right — Sparkline */}
      <div className="w-full lg:w-[180px] lg:flex-shrink-0">
        <div
          className="rounded-[10px] border p-3"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">
            Trend
          </p>
          <Sparkline />
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFrameworks()
      .then((data) => {
        setCategories(data.categories)
        setRisingstar(data.risingstar)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[900px]">
      {/* Header */}
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
          {/* ── Section 1: Framework Hierarchy ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">
                Framework Landscape
              </h2>
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
              <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">
                Rising Star
              </h2>
              <div className="flex-1 border-t border-[#E4E1EE]" />
            </div>

            {risingstar ? (
              <RisingStarCard rs={risingstar} />
            ) : (
              <p className="text-[13px] text-[#9E97B3]">No FRAMEWORKS articles in the last 14 days</p>
            )}
          </div>
        </>
      )}

      <div className="h-8" aria-hidden />
    </div>
  )
}
