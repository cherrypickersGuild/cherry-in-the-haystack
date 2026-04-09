"use client"

import { useEffect, useState } from "react"
import {
  fetchCaseStudies,
  CaseStudiesCategoryGroup,
  CaseStudyItem,
} from "@/lib/api"

/* ─────────────────────────────────────────────
   sideCategory 기준 그룹 스타일
───────────────────────────────────────────── */
const SIDE_CAT_STYLES: Record<string, { dot: string; bg: string; color: string; border: string }> = {
  "CASE_STUDY":       { dot: "#2D7A5E", bg: "#EFF7F3", color: "#2D7A5E", border: "#A8D4BF" },
  "APPLIED_RESEARCH": { dot: "#7B5EA7", bg: "#F3EFFA", color: "#7B5EA7", border: "#C7B8E8" },
}
const DEFAULT_SIDE_STYLE = { dot: "#9E97B3", bg: "#F2F0F7", color: "#9E97B3", border: "#E4E1EE" }

/* ─────────────────────────────────────────────
   카드 내 회사/카테고리 태그 색상
───────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "cs-openai":    { bg: "#EEF4FC", color: "#2E5C94", border: "#B8D0EE" },
  "cs-google":    { bg: "#F3EFFA", color: "#7B5EA7", border: "#C7B8E8" },
  "cs-anthropic": { bg: "#FDF0F3", color: "#C94B6E", border: "#F0B8C8" },
  "cs-microsoft": { bg: "#EEF4FC", color: "#0194E2", border: "#A8CFF5" },
}
const DEFAULT_CAT_STYLE = { bg: "#F2F0F7", color: "#9E97B3", border: "#E4E1EE" }

/* ─────────────────────────────────────────────
   sideCategory 기준으로 재그룹핑
───────────────────────────────────────────── */
type SideCatGroup = {
  code: string | null
  name: string | null
  items: CaseStudyItem[]
}

function regroupBySideCategory(groups: CaseStudiesCategoryGroup[]): SideCatGroup[] {
  const all = groups.flatMap((g) => g.items)
  const map = new Map<string, SideCatGroup>()

  for (const item of all) {
    const key = item.sideCategoryCode ?? "__none__"
    if (!map.has(key)) {
      map.set(key, { code: item.sideCategoryCode, name: item.sideCategory, items: [] })
    }
    map.get(key)!.items.push(item)
  }

  // CASE_STUDY → APPLIED_RESEARCH → 나머지 순 정렬
  const ORDER = ["CASE_STUDY", "APPLIED_RESEARCH"]
  return [...map.values()].sort((a, b) => {
    const ai = ORDER.indexOf(a.code ?? "")
    const bi = ORDER.indexOf(b.code ?? "")
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ count }: { count: number }) {
  return (
    <span className="text-[12px] tracking-tight" style={{ color: "#C94B6E" }}>
      {Array.from({ length: 5 }, (_, i) => (i < count ? "★" : "☆")).join("")}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Article Card — 회사/카테고리 태그를 카드 내부에 표시
───────────────────────────────────────────── */
function ArticleCard({ item }: { item: CaseStudyItem }) {
  const catStyle = CATEGORY_COLORS[item.categoryCode] ?? DEFAULT_CAT_STYLE
  return (
    <div
      className="bg-white rounded-[10px] p-4 mb-2.5 cursor-pointer transition-all duration-150 hover:bg-[#FAFAFA]"
      style={{ border: "1px solid #E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7B5EA7" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1EE" }}
    >
      <h3 className="text-[15px] font-semibold text-[#1A1626] leading-[1.4] mb-1.5">
        {item.title}
      </h3>
      <p className="text-[13px] text-[#9E97B3] leading-[1.55] mb-2.5 line-clamp-2">
        {item.oneLiner}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {/* 회사/카테고리 태그 (OPENAI, GOOGLE 등) */}
        <span
          className="inline-flex px-2 py-0.5 rounded-[8px] text-[10px] font-bold uppercase"
          style={{ backgroundColor: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}
        >
          {item.categoryName}
        </span>
        <Stars count={item.score} />
        <span
          className="px-2 py-0.5 rounded-[8px] text-[11px] text-[#9E97B3]"
          style={{ border: "1px solid #E4E1EE" }}
        >
          {item.entityName}
        </span>
        <span className="text-[10px] text-[#9E97B3]">{item.date}</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SideCategory Group (헤더)
───────────────────────────────────────────── */
function SideCatGroupSection({ group }: { group: SideCatGroup }) {
  const style = (group.code && SIDE_CAT_STYLES[group.code]) ?? DEFAULT_SIDE_STYLE
  const displayName = group.name ?? "기타"

  return (
    <div className="mb-8">
      <div
        className="flex items-center gap-2.5 pb-2 mb-3"
        style={{ borderBottom: "1px solid #E4E1EE" }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: style.dot }} />
        <span className="text-[13px] font-bold uppercase tracking-[0.5px] text-[#1A1626]">
          {displayName}
        </span>
        <span className="text-[11px] text-[#9E97B3] ml-auto">{group.items.length} items</span>
      </div>
      {group.items.map((item) => (
        <ArticleCard key={item.id} item={item} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function NDCaseStudiesPage() {
  const [groups, setGroups] = useState<CaseStudiesCategoryGroup[]>([])
  const [total, setTotal] = useState(0)
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCaseStudies()
      .then((data) => {
        setGroups(data.groups)
        setTotal(data.total)
        setPeriod(data.period)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const sideCatGroups = regroupBySideCategory(groups)
  const periodLabel = period?.from ? `${period.from} – ${period.to}` : ""

  return (
    <div className="flex h-full">
      <div style={{ padding: "28px 32px", maxWidth: 900, width: "100%" }}>
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1
              className="font-extrabold text-[#1A1626] leading-tight text-[22px] lg:text-[30px]"
              style={{ letterSpacing: "-0.5px" }}
            >
              Case Studies
            </h1>
            <p className="text-[13px] text-[#9E97B3] mt-1.5">
              {loading ? "Loading…" : `${total} items · ${sideCatGroups.length} types · ${periodLabel}`}
            </p>
          </div>
          <span
            className="px-4 py-1.5 rounded-[6px] text-[12px] font-semibold"
            style={{ backgroundColor: "#EFF7F3", color: "#2D7A5E", border: "1px solid #A8D4BF" }}
          >
            Case Studies
          </span>
        </div>

        {loading ? (
          <div className="text-[13px] text-[#9E97B3] py-12 text-center">Loading…</div>
        ) : sideCatGroups.length === 0 ? (
          <div className="text-[13px] text-[#9E97B3] py-12 text-center">No case studies found</div>
        ) : (
          sideCatGroups.map((g) => (
            <SideCatGroupSection key={g.code ?? "__none__"} group={g} />
          ))
        )}
      </div>
    </div>
  )
}
