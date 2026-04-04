"use client"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"

type BuzzItem = {
  label: string
  percent: number
  color: string
  bgColor: string
}

const BUZZ_DATA: BuzzItem[] = [
  { label: "MODEL_UPDATES",    percent: 18, color: "#7B5EA7", bgColor: "#F3EFFA" },
  { label: "PAPER_BENCHMARK",  percent: 15, color: "#C94B6E", bgColor: "#FDF0F3" },
  { label: "FRAMEWORKS",       percent: 14, color: "#2D7A5E", bgColor: "#EFF7F3" },
  { label: "TOOLS",            percent: 12, color: "#D4854A", bgColor: "#FDF6EE" },
  { label: "SHARED_RESOURCES", percent: 11, color: "#4A90D9", bgColor: "#EEF4FC" },
  { label: "CASE_STUDIES",     percent: 9,  color: "#1A1626", bgColor: "#F2F0F7" },
  { label: "REGULATIONS",      percent: 8,  color: "#9E97B3", bgColor: "#F7F6F9" },
  { label: "BIG_TECH_TRENDS",  percent: 7,  color: "#6B6480", bgColor: "#F7F6F9" },
  { label: "THIS_WEEKS_POSTS", percent: 6,  color: "#2E5C94", bgColor: "#EEF4FC" },
]

const TREEMAP_FONT_STACK =
  'var(--font-rounded), "Inter", "Segoe UI", system-ui, sans-serif'

// Scale font size between min/max based on percent (6%→18%)
function scaleFontSize(percent: number, min: number, max: number) {
  const lo = 6, hi = 18
  return min + ((percent - lo) / (hi - lo)) * (max - min)
}

export function CategoryTreemap() {
  const isMobile = useIsMobile()
  const rowH = isMobile ? 96 : 72

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
          9 sectors
        </span>
      </div>

      <div
        className="rounded-2xl border border-border/80 p-[6px] shadow-card"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(238,233,248,0.98))",
        }}
      >
        <div
          className="grid gap-[6px]"
          style={{
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gridTemplateRows: `repeat(4, ${rowH}px)`,
            gridTemplateAreas: `
              "a a a a a b b b b c c c"
              "a a a a a b b b b c c c"
              "d d d d e e e f f g g g"
              "d d d d h h h f f i i i"
            `,
          }}
        >
          <TreemapTile item={BUZZ_DATA[0]} gridArea="a" isLarge isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[1]} gridArea="b" isLarge isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[2]} gridArea="c" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[3]} gridArea="d" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[4]} gridArea="e" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[5]} gridArea="f" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[6]} gridArea="g" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[7]} gridArea="h" isMobile={isMobile} />
          <TreemapTile item={BUZZ_DATA[8]} gridArea="i" isMobile={isMobile} />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {BUZZ_DATA.map((item) => (
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
  gridArea,
  isLarge = false,
  isMobile = false,
}: {
  item: BuzzItem
  gridArea: string
  isLarge?: boolean
  isMobile?: boolean
}) {
  // percent font: scale label 11px→18px (mobile: 8px→13px)
  const labelSize  = scaleFontSize(item.percent, isMobile ? 8 : 11, isMobile ? 13 : 18)
  const pctSize    = scaleFontSize(item.percent, isMobile ? 9 : 12, isMobile ? 14 : 19)
  // weight: heavier as percent grows
  const fontWeight = item.percent >= 20 ? 900 : item.percent >= 14 ? 800 : item.percent >= 10 ? 700 : 600

  return (
    <button
      className={cn(
        "group relative flex h-full flex-col justify-between text-left",
        "rounded-[14px] border transition-all duration-200 cursor-pointer overflow-hidden",
        "border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_5px_18px_rgba(34,26,63,0.14)]",
        "hover:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isLarge ? "p-4" : "p-3"
      )}
      style={{
        gridArea,
        backgroundColor: item.bgColor,
        backgroundImage:
          "radial-gradient(circle at 16% 12%, rgba(255,255,255,0.42), transparent 56%)",
      }}
      aria-label={`${item.label}: ${item.percent}%`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.05))",
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
