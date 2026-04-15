"use client"

import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { LandingTreemapItem } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

type BuzzItem = {
  label: string
  percent: number
  color: string
  bgColor: string
}

type TileRect = BuzzItem & {
  x: number
  y: number
  w: number
  h: number
}

type NormItem = { item: BuzzItem; norm: number }

// ── Static data ───────────────────────────────────────────────────────────────

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

const GAP = 3

// ── Binary Recursive Treemap (Mondrian style) ─────────────────────────────────
//
// 아이템을 내림차순 정렬 후, 합이 최대한 균등해지는 지점에서 두 그룹으로 분할.
// 사각형의 긴 변 방향으로 분할 → 재귀.
// → 다양한 방향의 블록들이 생겨 몬드리안 느낌이 남.

function findSplitIndex(items: NormItem[]): number {
  const total = items.reduce((s, i) => s + i.norm, 0)
  const half = total / 2
  let cumSum = 0
  let bestIdx = 0
  let bestDiff = Infinity

  for (let k = 0; k < items.length - 1; k++) {
    cumSum += items[k].norm
    const diff = Math.abs(cumSum - half)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = k
    }
  }
  return bestIdx + 1
}

function binaryRec(
  items: NormItem[],
  x: number,
  y: number,
  W: number,
  H: number,
  out: TileRect[],
): void {
  if (items.length === 0 || W <= 0 || H <= 0) return

  if (items.length === 1) {
    out.push({ ...items[0].item, x, y, w: W, h: H })
    return
  }

  const splitAt = findSplitIndex(items)
  const g1 = items.slice(0, splitAt)
  const g2 = items.slice(splitAt)

  const total = items.reduce((s, i) => s + i.norm, 0)
  const sum1  = g1.reduce((s, i) => s + i.norm, 0)
  const ratio = sum1 / total

  if (W >= H) {
    // 가로가 길면 세로로 잘라서 좌/우 분할
    const w1 = ratio * W
    binaryRec(g1, x,      y, w1,     H, out)
    binaryRec(g2, x + w1, y, W - w1, H, out)
  } else {
    // 세로가 길면 가로로 잘라서 상/하 분할
    const h1 = ratio * H
    binaryRec(g1, x, y,      W, h1,     out)
    binaryRec(g2, x, y + h1, W, H - h1, out)
  }
}

function computeTiles(data: BuzzItem[], W: number, H: number): TileRect[] {
  if (W <= 0 || H <= 0) return []
  const sorted = [...data].sort((a, b) => b.percent - a.percent)
  const total  = sorted.reduce((s, i) => s + i.percent, 0)
  const items: NormItem[] = sorted.map((i) => ({ item: i, norm: i.percent / total }))
  const out: TileRect[] = []
  binaryRec(items, 0, 0, W, H, out)
  return out
}

// ── Components ────────────────────────────────────────────────────────────────

function toDisplayItems(items: LandingTreemapItem[]): BuzzItem[] {
  return items.map((item) => ({
    label: item.page,
    percent: item.percent,
    ...(PAGE_STYLE[item.page] ?? { color: "#9E97B3", bgColor: "#F7F6F9" }),
  }))
}

export function CategoryTreemap({ items }: { items?: LandingTreemapItem[] }) {
  const isMobile  = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const data       = items && items.length > 0 ? toDisplayItems(items) : STATIC_BUZZ_DATA
  const containerH = isMobile ? 420 : 310

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tiles = size ? computeTiles(data, size.w, size.h) : []

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
        <div
          ref={containerRef}
          className="relative w-full h-full"
          style={{ opacity: size ? 1 : 0 }}
        >
          {tiles.map((tile) => (
            <TreemapTile key={tile.label} tile={tile} />
          ))}
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

function TreemapTile({ tile }: { tile: TileRect }) {
  const x = tile.x + GAP
  const y = tile.y + GAP
  const w = tile.w - GAP * 2
  const h = tile.h - GAP * 2

  if (w <= 0 || h <= 0) return null

  const minDim    = Math.min(w, h)
  const labelSize = Math.max(9,  Math.min(17, minDim * 0.155))
  const pctSize   = Math.max(8,  Math.min(15, minDim * 0.13))
  const fontWeight =
    tile.percent >= 18 ? 900 : tile.percent >= 14 ? 800 : tile.percent >= 10 ? 700 : 600

  const showLabel = w > 42 && h > 32
  const showBadge = w > 52 && h > 44

  return (
    <button
      className={cn(
        "group absolute flex flex-col justify-between text-left",
        "rounded-[14px] border transition-all duration-200 cursor-pointer",
        "border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_5px_18px_rgba(34,26,63,0.14)]",
        "hover:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "p-3",
      )}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: tile.bgColor,
        backgroundImage:
          "radial-gradient(circle at 16% 12%, rgba(255,255,255,0.42), transparent 56%)",
      }}
      aria-label={`${tile.label}: ${tile.percent}%`}
    >
      {/* Hover gradient — self-clipped via own border-radius so parent can stay unclipped (overflow-visible) */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.05))",
          borderRadius: 14,
        }}
      />

      {showLabel && (
        <p
          className="relative max-w-[88%] leading-[1.12] break-all"
          style={{
            color: tile.color,
            fontSize: labelSize,
            fontWeight,
            fontFamily: TREEMAP_FONT_STACK,
            letterSpacing: "0.03em",
            textShadow: "0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          {tile.label}
        </p>
      )}

      {showBadge && (
        <span
          className="absolute rounded-full px-2 py-1"
          style={{
            // 레이블의 flex 흐름에서 빼서 고정 위치 — 글자가 커져도 배지를 밀어내지 않음
            right: 12,
            bottom: 12,
            color: tile.color,
            fontSize: pctSize * 0.68,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: TREEMAP_FONT_STACK,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            backgroundColor: "#ffffff",
            border: "1px solid #ffffff",
            boxShadow: "0 2px 8px rgba(22,16,42,0.14)",
            zIndex: 2,
          }}
        >
          {tile.percent}%
        </span>
      )}
    </button>
  )
}
