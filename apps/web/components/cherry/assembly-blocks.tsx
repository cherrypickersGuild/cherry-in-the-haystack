"use client"

/**
 * AssemblyBlocks — refined isometric tower for the /start hero.
 * Gradient faces, top-edge highlight, dashed landing rhombus + centre
 * crosshair, floating cube with subtle glow + trail dots.
 */
export function AssemblyBlocks({ size = 220, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={className} style={{ width: size, height: size * 1.15 }}>
      <svg viewBox="0 0 220 250" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Cube 1 — terracotta */}
          <linearGradient id="c1t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EB9B85" />
            <stop offset="1" stopColor="#C7694F" />
          </linearGradient>
          <linearGradient id="c1l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8F3B28" />
            <stop offset="1" stopColor="#5D2112" />
          </linearGradient>
          <linearGradient id="c1r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B04F37" />
            <stop offset="1" stopColor="#82311E" />
          </linearGradient>

          {/* Cube 2 — ochre */}
          <linearGradient id="c2t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9CB84" />
            <stop offset="1" stopColor="#C59D51" />
          </linearGradient>
          <linearGradient id="c2l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8F6E2A" />
            <stop offset="1" stopColor="#624B19" />
          </linearGradient>
          <linearGradient id="c2r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B48F44" />
            <stop offset="1" stopColor="#846527" />
          </linearGradient>

          {/* Cube 3 — espresso */}
          <linearGradient id="c3t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5E4B36" />
            <stop offset="1" stopColor="#3B2C1D" />
          </linearGradient>
          <linearGradient id="c3l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22150A" />
            <stop offset="1" stopColor="#0F0703" />
          </linearGradient>
          <linearGradient id="c3r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3D2D1B" />
            <stop offset="1" stopColor="#1F1308" />
          </linearGradient>

          {/* Glow around the landing target */}
          <radialGradient id="landingGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#B12A17" stopOpacity="0.22" />
            <stop offset="1" stopColor="#B12A17" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="110" cy="230" rx="78" ry="7" fill="#3A2A1C" opacity="0.18" />

        {/* Base cube */}
        <IsoCube cx={110} cy={192} size={44}
          top="url(#c1t)" left="url(#c1l)" right="url(#c1r)" />

        {/* Middle cube */}
        <IsoCube cx={110} cy={148} size={44}
          top="url(#c2t)" left="url(#c2l)" right="url(#c2r)" />

        {/* Landing target glow */}
        <ellipse cx="110" cy="104" rx="50" ry="22" fill="url(#landingGlow)" />

        {/* Landing guide — thin dashed rhombus + crosshair */}
        <LandingGuide cx={110} cy={104} size={44} />

        {/* Trail dots — subtle arc from floating piece to landing */}
        <g fill="#B12A17">
          <circle cx="134" cy="82" r="1.4" opacity="0.55" />
          <circle cx="126" cy="90" r="1.2" opacity="0.4" />
          <circle cx="118" cy="98" r="1.1" opacity="0.28" />
        </g>

        {/* Floating cube (top, slightly right) */}
        <g className="assembly-float">
          <IsoCube cx={134} cy={76} size={44}
            top="url(#c3t)" left="url(#c3l)" right="url(#c3r)" />
          {/* Sparkle near top corner */}
          <g transform="translate(148 50)" opacity="0.9">
            <path d="M 0 -5 L 1 -1 L 5 0 L 1 1 L 0 5 L -1 1 L -5 0 L -1 -1 Z" fill="#FFE6DF" />
          </g>
        </g>
      </svg>

      <style jsx>{`
        .assembly-float {
          animation: assembly-bob 3.2s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes assembly-bob {
          0%, 100% { transform: translate(0, -6px); }
          50%      { transform: translate(0, 1px); }
        }
      `}</style>
    </div>
  )
}

/* ── helpers ── */

function IsoCube({
  cx, cy, size: s, top, left, right,
}: {
  cx: number; cy: number; size: number
  top: string; left: string; right: string
}) {
  const hx = s * 0.866
  const hy = s * 0.5
  const topPath = `M ${cx} ${cy - hy} L ${cx + hx} ${cy} L ${cx} ${cy + hy} L ${cx - hx} ${cy} Z`
  const leftPath = `M ${cx - hx} ${cy} L ${cx} ${cy + hy} L ${cx} ${cy + hy + s} L ${cx - hx} ${cy + s} Z`
  const rightPath = `M ${cx + hx} ${cy} L ${cx} ${cy + hy} L ${cx} ${cy + hy + s} L ${cx + hx} ${cy + s} Z`
  // Top edge highlight — the two edges facing the viewer's upper side
  const topEdge = `M ${cx - hx} ${cy} L ${cx} ${cy - hy} L ${cx + hx} ${cy}`

  return (
    <g>
      <path d={leftPath} fill={left} stroke="#0F0703" strokeWidth="0.5" strokeLinejoin="round" />
      <path d={rightPath} fill={right} stroke="#0F0703" strokeWidth="0.5" strokeLinejoin="round" />
      <path d={topPath} fill={top} stroke="#0F0703" strokeWidth="0.5" strokeLinejoin="round" />
      {/* subtle top edge highlight */}
      <path d={topEdge} stroke="white" strokeWidth="1" opacity="0.26" fill="none" strokeLinecap="round" />
    </g>
  )
}

function LandingGuide({ cx, cy, size: s }: { cx: number; cy: number; size: number }) {
  const hx = s * 0.866
  const hy = s * 0.5
  const rhombus = `M ${cx} ${cy - hy} L ${cx + hx} ${cy} L ${cx} ${cy + hy} L ${cx - hx} ${cy} Z`
  return (
    <g>
      <path d={rhombus} fill="none" stroke="#B12A17" strokeWidth="1" strokeDasharray="3.5 3" opacity="0.55" />
      {/* center crosshair */}
      <g stroke="#B12A17" strokeWidth="0.9" opacity="0.7" strokeLinecap="round">
        <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} />
        <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} />
      </g>
    </g>
  )
}
