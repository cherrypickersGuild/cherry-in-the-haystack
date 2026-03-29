"use client"

import { cn } from "@/lib/utils"

type BuzzItem = {
  label: string
  percent: number
  color: string
  bgColor: string
}

const BUZZ_DATA: BuzzItem[] = [
  { label: "LLM Architecture",    percent: 24, color: "#7B5EA7", bgColor: "#F3EFFA" }, // largest → purple
  { label: "RAG & Retrieval",     percent: 18, color: "#C94B6E", bgColor: "#FDF0F3" }, // second → cherry
  { label: "Agents & Tools",      percent: 16, color: "#2D7A5E", bgColor: "#EFF7F3" },
  { label: "Fine-tuning",         percent: 14, color: "#D4854A", bgColor: "#FDF6EE" },
  { label: "Inference & Serving", percent: 11, color: "#4A90D9", bgColor: "#EEF4FC" },
  { label: "Evaluation",          percent: 8,  color: "#1A1626", bgColor: "#F2F0F7" },
  { label: "Multi-modal",         percent: 5,  color: "#9E97B3", bgColor: "#F7F6F9" },
  { label: "Governance",          percent: 4,  color: "#6B6480", bgColor: "#F7F6F9" },
]

const TREEMAP_FONT_STACK =
  'var(--font-rounded), "Inter", "Segoe UI", system-ui, sans-serif'

// Scale font size between min/max based on percent (4%→24%)
function scaleFontSize(percent: number, min: number, max: number) {
  const lo = 4, hi = 24
  return min + ((percent - lo) / (hi - lo)) * (max - min)
}

export function CategoryTreemap() {
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
          8 sectors
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
            gridTemplateRows: "repeat(4, 72px)",
            gridTemplateAreas: `
              "a a a a a a b b b b c c"
              "a a a a a a b b b b c c"
              "d d d d e e e f f g g g"
              "d d d d h h h f f g g g"
            `,
          }}
        >
          <TreemapTile item={BUZZ_DATA[0]} gridArea="a" isLarge />
          <TreemapTile item={BUZZ_DATA[1]} gridArea="b" isLarge />
          <TreemapTile item={BUZZ_DATA[2]} gridArea="c" />
          <TreemapTile item={BUZZ_DATA[3]} gridArea="d" />
          <TreemapTile item={BUZZ_DATA[4]} gridArea="e" />
          <TreemapTile item={BUZZ_DATA[5]} gridArea="f" />
          <TreemapTile item={BUZZ_DATA[6]} gridArea="g" />
          <TreemapTile item={BUZZ_DATA[7]} gridArea="h" />
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
}: { 
  item: BuzzItem
  gridArea: string
  isLarge?: boolean
}) {
  // percent font: scale label 11px→20px, percent number 12px→22px
  const labelSize  = scaleFontSize(item.percent, 11, 18)
  const pctSize    = scaleFontSize(item.percent, 12, 19)
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
        className="relative max-w-[88%] leading-[1.12]"
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
