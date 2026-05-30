"use client"

/**
 * JigsawConnector — per-type shape indicator shared by inventory cards
 * and equipment slots.
 *
 *   prompt        → ● circle
 *   mcp           → ■ rounded square
 *   skill         → ▲ triangle
 *   orchestration → ◆ diamond
 *   memory        → ⬢ hexagon
 *
 * Two render modes:
 *   - "tab"    — solid filled shape (on an inventory card)
 *   - "socket" — dashed outline + cream fill (on an empty slot)
 *
 * Users read the card and slot together the way they read a jigsaw piece:
 * matching shape + matching colour = this card fits this slot.
 */

import type { CSSProperties } from "react"

export type JigsawType =
  | "prompt"
  | "mcp"
  | "skill"
  | "orchestration"
  | "memory"

export type JigsawPosition = "top" | "bottom" | "left" | "right"
export type JigsawMode = "tab" | "socket"

interface ShapeTheme {
  /** Solid fill (used in tab mode). */
  fill: string
  /** Outline stroke. */
  stroke: string
  /** Short label used when rendered with caption. */
  label: string
}

const SHAPE_THEME: Record<JigsawType, ShapeTheme> = {
  prompt:        { fill: "#C9A24A", stroke: "#8B6C2A", label: "PROMPT" },
  mcp:           { fill: "#2A5C3E", stroke: "#1F4430", label: "MCP" },
  skill:         { fill: "#C8301E", stroke: "#8F1D12", label: "SKILL" },
  orchestration: { fill: "#4A5FA0", stroke: "#2D3B66", label: "ORCH" },
  memory:        { fill: "#7B5EA7", stroke: "#5E3A8A", label: "MEM" },
}

/** Path data centred in a 20×20 viewBox. */
function ShapePath({ type }: { type: JigsawType }) {
  switch (type) {
    case "prompt":
      return <circle cx="10" cy="10" r="8" />
    case "mcp":
      return <rect x="2" y="2" width="16" height="16" rx="2.5" ry="2.5" />
    case "skill":
      return <polygon points="10,1.5 18.5,17.5 1.5,17.5" />
    case "orchestration":
      return <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" />
    case "memory":
      return <polygon points="5.5,2.5 14.5,2.5 18.5,10 14.5,17.5 5.5,17.5 1.5,10" />
  }
}

interface JigsawConnectorProps {
  type: JigsawType
  mode: JigsawMode
  position?: JigsawPosition
  size?: number
  className?: string
  style?: CSSProperties
}

/** Positions the connector so HALF of the shape sticks past the parent edge —
 *  giving the illusion that the tab protrudes (or the socket is cut in). */
function posStyle(position: JigsawPosition, size: number): CSSProperties {
  const half = size / 2
  switch (position) {
    case "top":
      return { top: -half, left: "50%", transform: "translateX(-50%)" }
    case "bottom":
      return { bottom: -half, left: "50%", transform: "translateX(-50%)" }
    case "left":
      return { left: -half, top: "50%", transform: "translateY(-50%)" }
    case "right":
      return { right: -half, top: "50%", transform: "translateY(-50%)" }
  }
}

export function JigsawConnector({
  type,
  mode,
  position = "top",
  size = 16,
  className,
  style,
}: JigsawConnectorProps) {
  const theme = SHAPE_THEME[type]

  return (
    <div
      className={`absolute pointer-events-none select-none ${className ?? ""}`}
      style={{
        ...posStyle(position, size),
        width: size,
        height: size,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        style={{ display: "block", overflow: "visible" }}
      >
        {mode === "tab" ? (
          <g
            fill={theme.fill}
            stroke={theme.stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            <ShapePath type={type} />
          </g>
        ) : (
          <g
            fill="#FDFBF5"
            stroke={theme.stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
            strokeDasharray="2.2 1.6"
            opacity={0.75}
          >
            <ShapePath type={type} />
          </g>
        )}
      </svg>
    </div>
  )
}

/** Type-to-shape legend — handy if we want to show users the mapping explicitly. */
export function JigsawLegend({ types }: { types: JigsawType[] }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {types.map((t) => {
        const theme = SHAPE_THEME[t]
        return (
          <div key={t} className="flex items-center gap-1.5">
            <div className="relative w-4 h-4 flex-shrink-0">
              <svg viewBox="0 0 20 20" width="16" height="16" style={{ display: "block" }}>
                <g fill={theme.fill} stroke={theme.stroke} strokeWidth="1.2">
                  <ShapePath type={t} />
                </g>
              </svg>
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{ color: theme.stroke }}
            >
              {theme.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
