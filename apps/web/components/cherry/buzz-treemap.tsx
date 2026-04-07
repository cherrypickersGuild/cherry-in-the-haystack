"use client"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { LandingTreemapItem } from "@/lib/api"

type BuzzItem = {
  label: string
  percent: number
  color: string
  bgColor: string
}

const PAGE_STYLE: Record<string, { color: string; bgColor: string }> = {
  "MODEL_UPDATES":    { color: "#7B5EA7", bgColor: "#F3EFFA" },
  "PAPER_BENCHMARK":  { color: "#C94B6E", bgColor: "#FDF0F3" },
  "FRAMEWORKS":       { color: "#2D7A5E", bgColor: "#EFF7F3" },
  "TOOLS":            { color: "#D4854A", bgColor: "#FDF6EE" },
  "SHARED_RESOURCES": { color: "#4A90D9", bgColor: "#EEF4FC" },
  "CASE_STUDIES":     { color: "#1A1626", bgColor: "#F2F0F7" },
  "REGULATIONS":      { color: "#9E97B3", bgColor: "#F7F6F9" },
  "BIG_TECH_TRENDS":  { color: "#6B6480", bgColor: "#F7F6F9" },
  "THIS_WEEKS_POSTS": { color: "#2E5C94", bgColor: "#EEF4FC" },
}

const STATIC_BUZZ_DATA: BuzzItem[] = [
  { label: "MODEL_UPDATES",    percent: 18, ...PAGE_STYLE["MODEL_UPDATES"] },
  { label: "PAPER_BENCHMARK",  percent: 15, ...PAGE_STYLE["PAPER_BENCHMARK"] },
  { label: "FRAMEWORKS",       percent: 14, ...PAGE_STYLE["FRAMEWORKS"] },
  { label: "TOOLS",            percent: 12, ...PAGE_STYLE["TOOLS"] },
  { label: "SHARED_RESOURCES", percent: 11, ...PAGE_STYLE["SHARED_RESOURCES"] },
  { label: "CASE_STUDIES",     percent: 9,  ...PAGE_STYLE["CASE_STUDIES"] },
  { label: "REGULATIONS",      percent: 8,  ...PAGE_STYLE["REGULATIONS"] },
  { label: "BIG_TECH_TRENDS",  percent: 7,  ...PAGE_STYLE["BIG_TECH_TRENDS"] },
  { label: "THIS_WEEKS_POSTS", percent: 6,  ...PAGE_STYLE["THIS_WEEKS_POSTS"] },
]

const TREEMAP_FONT_STACK =
  'var(--font-rounded), "Inter", "Segoe UI", system-ui, sans-serif'

function scaleFontSize(percent: number, min: number, max: number) {
  const lo = 6, hi = 18
  return min + ((percent - lo) / (hi - lo)) * (max - min)
}

function toDisplayItems(items: LandingTreemapItem[]): BuzzItem[] {
  return items.map((item) => ({
    label: item.page,
    percent: item.percent,
    ...(PAGE_STYLE[item.page] ?? { color: "#9E97B3", bgColor: "#F7F6F9" }),
  }))
}

/**
 * % 합이 target(≈ total/numRows)에 가까워지면 행 마감
 * → row height ∝ row sum, item width ∝ item/rowSum → area ∝ item.percent
 */
function buildRows(items: BuzzItem[], numRows = 3): BuzzItem[][] {
  const sorted = [...items].sort((a, b) => b.percent - a.percent)
  const total = sorted.reduce((s, i) => s + i.percent, 0)
  const target = total / numRows

  const rows: BuzzItem[][] = []
  let cur: BuzzItem[] = []
  let curSum = 0

  for (const item of sorted) {
    if (rows.length === numRows - 1) { cur.push(item); continue }
    cur.push(item)
    curSum += item.percent
    if (curSum >= target) { rows.push(cur); cur = []; curSum = 0 }
  }
  if (cur.length > 0) rows.push(cur)
  return rows
}

export function CategoryTreemap({ items }: { items?: LandingTreemapItem[] }) {
  const isMobile = useIsMobile()

  const data = items && items.length > 0 ? toDisplayItems(items) : STATIC_BUZZ_DATA
  const numRows = data.length <= 4 ? 2 : 3
  const rows = buildRows(data, numRows)
  const totalPct = data.reduce((s, i) => s + i.percent, 0)

  const containerH = isMobile ? 420 : 288

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          style={{ fontFamily: TREEMAP_FONT_STACK }}
        >
          Buzz Distribution
        </p>
        <span
          className="text-[11px] text-text-muted"
          style={{ fontFamily: TREEMAP_FONT_STACK, letterSpacing: "0.02em" }}
        >
          {data.length} sectors
        </span>
      </div>

      <div
        className="rounded-2xl border border-border/80 p-[6px] shadow-card"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(238,233,248,0.98))",
          height: containerH,
        }}
      >
        <div className="flex flex-col gap-[6px] h-full">
          {rows.map((row, ri) => {
            const rowSum = row.reduce((s, i) => s + i.percent, 0)
            return (
              <div key={ri} className="flex gap-[6px]" style={{ flex: rowSum / totalPct }}>
                {row.map((item) => (
                  <TreemapTile
                    key={item.label}
                    item={item}
                    flexRatio={item.percent / rowSum}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: item.bgColor }}
            />
            <span
              className="text-[10px] text-text-muted"
              style={{ fontFamily: TREEMAP_FONT_STACK }}
            >
              {item.label} {item.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TreemapTile({
  item,
  flexRatio,
  isMobile,
}: {
  item: BuzzItem
  flexRatio: number
  isMobile: boolean
}) {
  const labelSize  = scaleFontSize(item.percent, isMobile ? 8 : 11, isMobile ? 13 : 18)
  const pctSize    = scaleFontSize(item.percent, isMobile ? 9 : 12, isMobile ? 14 : 19)
  const fontWeight = item.percent >= 20 ? 900 : item.percent >= 14 ? 800 : item.percent >= 10 ? 700 : 600

  return (
    <button
      className={cn(
        "group relative flex h-full flex-col justify-between text-left",
        "rounded-[14px] border transition-all duration-200 cursor-pointer overflow-hidden",
        "border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_5px_18px_rgba(34,26,63,0.14)]",
        "hover:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "p-3"
      )}
      style={{
        flex: flexRatio,
        backgroundColor: item.bgColor,
        backgroundImage: "radial-gradient(circle at 16% 12%, rgba(255,255,255,0.42), transparent 56%)",
      }}
      aria-label={`${item.label}: ${item.percent}%`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.05))",
        }}
      />

      <p
        className="relative max-w-[88%] leading-[1.12] break-all"
        style={{
          color: item.color,
          fontSize: labelSize,
          fontWeight,
          fontFamily: TREEMAP_FONT_STACK,
          letterSpacing: "0.03em",
          textShadow: "0 1px 0 rgba(255,255,255,0.22)",
        }}
      >
        {item.label}
      </p>

      <span
        className="relative ml-auto rounded-full px-2 py-1"
        style={{
          color: item.color,
          fontSize: pctSize * 0.68,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: TREEMAP_FONT_STACK,
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
          backgroundColor: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(255,255,255,0.92)",
          boxShadow: "0 2px 8px rgba(22,16,42,0.12)",
        }}
      >
        {item.percent}%
      </span>
    </button>
  )
}
