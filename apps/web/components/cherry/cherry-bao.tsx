"use client"

/**
 * Cherry Bao — the consumer-site mascot.
 *
 * A cherry-topped steamed bun / dumpling character. Cream body with sesame
 * flecks, small cherry with stem on top, simple face.
 *
 * Variants:
 *   - default        : neutral smile (hero / general use)
 *   - celebrate      : wink + sparkle (all 7 slots equipped)
 *   - confused       : dot eyes (error states)
 *   - sleeping       : closed eyes (empty / loading)
 *
 * Designed to be used at 48-160 px. Scales cleanly via viewBox.
 */

import type { CSSProperties } from "react"

export type BaoVariant = "default" | "celebrate" | "confused" | "sleeping"

interface CherryBaoProps {
  size?: number
  variant?: BaoVariant
  className?: string
  style?: CSSProperties
  animate?: boolean
}

export function CherryBao({
  size = 96,
  variant = "default",
  className,
  style,
  animate = false,
}: CherryBaoProps) {
  const w = size
  return (
    <svg
      width={w}
      height={w}
      viewBox="0 0 160 140"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Cherry Bao"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="baoBody" x1="20%" y1="15%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FBEFD8" />
          <stop offset="60%" stopColor="#F5E4C2" />
          <stop offset="100%" stopColor="#E9D1A6" />
        </linearGradient>
        <radialGradient id="cherryBody" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#E85A48" />
          <stop offset="60%" stopColor="#C8301E" />
          <stop offset="100%" stopColor="#8F1D12" />
        </radialGradient>
        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4FA07D" />
          <stop offset="100%" stopColor="#2A5C3E" />
        </linearGradient>
        <style>
          {`
            @keyframes baoBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            @keyframes baoWink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
            .bao-bob { animation: baoBob 3s ease-in-out infinite; transform-origin: center; }
            .bao-wink { animation: baoWink 4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
          `}
        </style>
      </defs>

      <g className={animate ? "bao-bob" : ""}>
        {/* ── Cherry on top ── */}
        {/* Leaf */}
        <path
          d="M 84 20 Q 96 10 108 14 Q 104 26 92 26 Q 87 26 84 23 Z"
          fill="url(#leafGrad)"
          stroke="#1A5A3F"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M 90 17 Q 96 20 104 18"
          stroke="#1A5A3F"
          strokeWidth="0.7"
          fill="none"
          opacity="0.5"
        />
        {/* Stem */}
        <path
          d="M 80 38 Q 80 26 90 19"
          stroke="#6B4F2A"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* Cherry body */}
        <circle cx="80" cy="44" r="14" fill="url(#cherryBody)" stroke="#6B3A20" strokeWidth="1.8" />
        <ellipse cx="75" cy="38" rx="3.5" ry="2.4" fill="#F7B0A2" opacity="0.8" />

        {/* ── Bao body ── */}
        {/* Main blob (subtle asymmetry for charm) */}
        <path
          d="M 20 96
             Q 14 70 38 58
             Q 52 52 80 54
             Q 112 52 126 60
             Q 146 72 140 96
             Q 138 118 122 124
             Q 98 132 80 130
             Q 58 132 38 124
             Q 22 118 20 96 Z"
          fill="url(#baoBody)"
          stroke="#6B4F2A"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Sesame flecks */}
        {SESAME.map((s, i) => (
          <ellipse
            key={i}
            cx={s.x}
            cy={s.y}
            rx={s.r * 0.4}
            ry={s.r}
            fill="#E8D3A5"
            transform={`rotate(${s.rot} ${s.x} ${s.y})`}
            opacity="0.85"
          />
        ))}

        {/* ── Face ── */}
        {variant === "sleeping" ? (
          <>
            {/* Closed eyes — gentle arcs */}
            <path d="M 56 90 Q 62 94 68 90" stroke="#3A2A1C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M 92 90 Q 98 94 104 90" stroke="#3A2A1C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : variant === "confused" ? (
          <>
            {/* X/dot eyes */}
            <line x1="54" y1="86" x2="60" y2="92" stroke="#3A2A1C" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="60" y1="86" x2="54" y2="92" stroke="#3A2A1C" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="100" y1="86" x2="106" y2="92" stroke="#3A2A1C" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="106" y1="86" x2="100" y2="92" stroke="#3A2A1C" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Normal dot eyes */}
            <circle cx={57} cy={90} r={3.2} fill="#3A2A1C" className={animate && variant === "celebrate" ? "bao-wink" : undefined} />
            <circle cx={103} cy={90} r={3.2} fill="#3A2A1C" />
            <circle cx={57.8} cy={88.8} r={0.9} fill="#FDFBF5" />
            <circle cx={103.8} cy={88.8} r={0.9} fill="#FDFBF5" />
          </>
        )}

        {/* Mouth — small smile (default/celebrate) */}
        {(variant === "default" || variant === "celebrate") && (
          <path
            d="M 74 100 Q 80 105 86 100"
            stroke="#3A2A1C"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Celebrate sparkles */}
        {variant === "celebrate" && (
          <>
            <text x="32" y="64" fontSize="12" fill="#C9A24A" opacity="0.9">✦</text>
            <text x="122" y="70" fontSize="10" fill="#C9A24A" opacity="0.8">✦</text>
            <text x="38" y="112" fontSize="9" fill="#C9A24A" opacity="0.7">✦</text>
          </>
        )}
      </g>
    </svg>
  )
}

/** Sesame fleck positions on the bao body — fixed seed for determinism */
const SESAME = [
  { x: 40, y: 82,  r: 3.2, rot: -25 },
  { x: 52, y: 108, r: 3.0, rot: 20 },
  { x: 70, y: 118, r: 3.2, rot: -10 },
  { x: 90, y: 112, r: 3.0, rot: 18 },
  { x: 110, y: 118, r: 3.2, rot: -22 },
  { x: 120, y: 92, r: 3.1, rot: 15 },
  { x: 132, y: 104, r: 3.0, rot: -18 },
  { x: 32, y: 104, r: 3.1, rot: 22 },
  { x: 100, y: 78, r: 2.8, rot: -15 },
  { x: 62, y: 74,  r: 2.8, rot: 12 },
]
