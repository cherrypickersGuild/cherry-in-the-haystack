"use client"

import { useState } from "react"
import { Treemap, ResponsiveContainer } from "recharts"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { LandingTreemapItem } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

type BuzzItem = {
  label: string
  percent: number
  color: string    // accent color for text
  bgLight: string  // light pastel for bg gradient start
  bgMid: string    // mid pastel for bg gradient end
}

// ── Soft pastel palette with gentle depth ─────────────────────────────────────

const PAGE_STYLE: Record<string, { color: string; bgLight: string; bgMid: string }> = {
  "MODEL_UPDATES":    { color: "#7B5EA7", bgLight: "#F7F2FC", bgMid: "#E4D7F0" },
  "PAPER_BENCHMARK":  { color: "#C94B6E", bgLight: "#FDF3F6", bgMid: "#F5D3DD" },
  "FRAMEWORKS":       { color: "#2D7A5E", bgLight: "#F0FAF5", bgMid: "#CFE9DC" },
  "TOOLS":            { color: "#D4854A", bgLight: "#FDF7EF", bgMid: "#F5DBB9" },
  "SHARED_RESOURCES": { color: "#4A90D9", bgLight: "#EEF5FD", bgMid: "#C9DEF4" },
  "CASE_STUDIES":     { color: "#3D3652", bgLight: "#F5F3F9", bgMid: "#D9D3E5" },
  "REGULATIONS":      { color: "#6B6480", bgLight: "#F7F6F9", bgMid: "#D9D5E2" },
  "BIG_TECH_TRENDS":  { color: "#4A4358", bgLight: "#F5F3F7", bgMid: "#D0CBD9" },
  "THIS_WEEKS_POSTS": { color: "#2E5C94", bgLight: "#EEF3FA", bgMid: "#C6D4E7" },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayItems(items: LandingTreemapItem[]): BuzzItem[] {
  return items.map((item) => ({
    label: item.page,
    percent: item.percent,
    ...(PAGE_STYLE[item.page] ?? { color: "#6B6480", bgLight: "#F7F6F9", bgMid: "#D9D5E2" }),
  }))
}

// Pretty label (MODEL_UPDATES → Model Updates)
function prettyLabel(raw?: string | null): string {
  if (!raw) return ""
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// ── Custom tile ──────────────────────────────────────────────────────────────

function CustomizedContent(props: any) {
  const { x, y, width, height, label, percent, color, bgLight, bgMid, hoveredLabel, setHoveredLabel, rank } = props
  if (!width || !height || !label) return null

  const isHovered = hoveredLabel === label
  const minDim = Math.min(width, height)
  // 1위만 크게, 나머지는 순위에 따라 점점 작게
  const isTop = rank === 0
  const labelSize = isTop
    ? Math.max(13, Math.min(20, minDim * 0.13))
    : Math.max(11, Math.min(17, minDim * 0.13))
  const pctSize = isTop
    ? Math.max(13, Math.min(17, minDim * 0.12))
    : Math.max(11, Math.min(15, minDim * 0.12))

  const showLabel = width > 36 && height > 30
  const showPct = width > 30 && height > 26

  const gradId = `grad-${label}`

  return (
    <g
      onMouseEnter={() => setHoveredLabel?.(label)}
      onMouseLeave={() => setHoveredLabel?.(null)}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgLight} />
          <stop offset="100%" stopColor={bgMid} />
        </linearGradient>
      </defs>
      <rect
        x={x + 3}
        y={y + 3}
        width={Math.max(0, width - 6)}
        height={Math.max(0, height - 6)}
        rx={10}
        ry={10}
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1}
        style={{
          transition: "filter 180ms ease",
          filter: isHovered ? "brightness(0.96)" : "brightness(1)",
        }}
      />
      {/* foreignObject로 HTML 텍스트 → word-break / 자동 줄바꿈 */}
      {(showLabel || showPct) && (() => {
        // 패딩: 타일 크기 + 순위 기반. 1위는 큰 타일이라 픽셀 패딩 상한을 2위급으로 캡
        const rankBoost = rank <= 4 ? 1.0 - rank * 0.05 : 0.75
        const maxPad = rank === 0 ? 20 : 28
        const padX = Math.max(12, Math.min(maxPad, width * 0.1 * rankBoost))
        const padY = Math.max(14, Math.min(maxPad, height * 0.12 * rankBoost))
        return (
        <foreignObject
          x={x + padX}
          y={y + padY}
          width={Math.max(0, width - padX * 2)}
          height={Math.max(0, height - padY * 2)}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color,
              fontFamily: TREEMAP_FONT_STACK,
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              lineHeight: 1.15,
            }}
          >
            {showLabel && (
              <div
                style={{
                  fontSize: labelSize,
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                }}
              >
                {prettyLabel(label)}
              </div>
            )}
            {showPct && (
              <div
                style={{
                  fontSize: pctSize,
                  fontWeight: isTop ? 900 : 700,
                  opacity: isTop ? 1 : 0.8,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "left",
                }}
              >
                {percent}%
              </div>
            )}
          </div>
        </foreignObject>
        )
      })()}
    </g>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategoryTreemap({ items }: { items?: LandingTreemapItem[] }) {
  const isMobile = useIsMobile()
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  const data = items && items.length > 0 ? toDisplayItems(items) : STATIC_BUZZ_DATA
  const containerH = isMobile ? 420 : 310

  // percent 내림차순 정렬된 순서로 rank 부여 (1위=0, 나머지=1+)
  const sortedByPct = [...data].sort((a, b) => b.percent - a.percent)
  const rankMap = new Map(sortedByPct.map((d, i) => [d.label, i]))
  const treemapData = data.map((d) => ({
    name: d.label,
    size: d.percent,
    label: d.label,
    percent: d.percent,
    color: d.color,
    bgLight: d.bgLight,
    bgMid: d.bgMid,
    rank: rankMap.get(d.label) ?? 99,
  }))

  return (
    <div className="flex flex-col">
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
        className="rounded-2xl border border-border/80 overflow-hidden p-[6px] shadow-card"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(238,233,248,0.98))",
          height: containerH,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="transparent"
            fill="transparent"
            // @ts-expect-error — recharts types don't expose content extra props
            content={<CustomizedContent hoveredLabel={hoveredLabel} setHoveredLabel={setHoveredLabel} />}
            isAnimationActive={false}
          />
        </ResponsiveContainer>
      </div>

    </div>
  )
}
