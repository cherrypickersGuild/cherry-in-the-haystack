"use client"

type Sample = {
  emoji: string
  assistantName: string
  accent: string
  notif: { title: string; body: string; when: string }
}

/** Candlestick data — open/close/high/low in SVG y (lower y = higher price).
 *  Shape: choppy first half between 83–90, then sharp rally in last 6 candles from 78 → 18. */
const CANDLES: { o: number; c: number; h: number; l: number }[] = [
  { o: 88, c: 86, h: 84, l: 90 },
  { o: 86, c: 87, h: 85, l: 89 },
  { o: 87, c: 85, h: 83, l: 89 },
  { o: 85, c: 86, h: 83, l: 88 },
  { o: 86, c: 84, h: 82, l: 88 },
  { o: 84, c: 85, h: 82, l: 87 },
  { o: 85, c: 83, h: 81, l: 87 },
  { o: 83, c: 81, h: 79, l: 85 },
  { o: 81, c: 82, h: 79, l: 84 },
  { o: 82, c: 78, h: 76, l: 83 },
  { o: 78, c: 75, h: 72, l: 80 },
  { o: 75, c: 68, h: 65, l: 77 },
  { o: 68, c: 52, h: 48, l: 70 },
  { o: 52, c: 35, h: 30, l: 54 },
  { o: 35, c: 25, h: 22, l: 38 },
  { o: 25, c: 18, h: 16, l: 28 },
]

/* ══════════ 1. Crypto — cream finance card with candlestick chart on dark inset ══════════ */
export function CryptoChart({ sample }: { sample: Sample }) {
  return (
    <div className="max-w-[440px] mx-auto">
      <div
        className="rounded-[20px] overflow-hidden bg-[#FDFBF5]"
        style={{
          border: "1px solid #E9D1A6",
          boxShadow: "0 24px 60px rgba(107,79,42,0.14)",
        }}
      >
        {/* Header: price + change */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#9A7C55]">
              BTC · 24H
            </p>
            <p className="text-[28px] font-mono font-black tabular-nums text-[#2A1E15] mt-1 leading-none">
              $80,734
            </p>
            <p className="text-[10px] text-[#9A7C55] mt-1.5 font-mono tabular-nums">
              ＋ $12,331 (24h)
            </p>
          </div>
          <div
            className="px-2.5 py-1 rounded-md text-[11px] font-black tabular-nums"
            style={{ backgroundColor: "#F8DCD6", color: "#C8301E" }}
          >
            ↑ 18.04%
          </div>
        </div>

        {/* Inset DARK panel with Korean-convention candlesticks (red up / blue down) */}
        <div className="px-4 pb-4">
          <div
            className="rounded-xl p-3"
            style={{ background: "linear-gradient(160deg, #1A120A 0%, #241609 100%)" }}
          >
            <svg viewBox="0 0 320 120" className="w-full h-28">
              <g stroke="#5D4630" strokeWidth="0.4" opacity="0.5">
                <line x1="0" y1="30" x2="320" y2="30" />
                <line x1="0" y1="60" x2="320" y2="60" />
                <line x1="0" y1="90" x2="320" y2="90" />
              </g>

              {CANDLES.map((c, i) => {
                const x = 10 + i * 20
                const bull = c.c < c.o
                const color = bull ? "#E85846" : "#4A90E2"
                const bodyTop = Math.min(c.o, c.c)
                const bodyBottom = Math.max(c.o, c.c)
                const bodyHeight = Math.max(bodyBottom - bodyTop, 1)
                return (
                  <g key={i}>
                    <line x1={x} y1={c.h} x2={x} y2={c.l} stroke={color} strokeWidth="1.2" />
                    <rect x={x - 4} y={bodyTop} width="8" height={bodyHeight} fill={color} rx="0.5" />
                  </g>
                )
              })}

              <g transform="translate(206 2)">
                <rect x="0" y="0" rx="3" ry="3" width="70" height="14" fill="#E85846" />
                <text
                  x="35" y="10"
                  fontSize="9"
                  fontWeight="800"
                  fill="#FDFBF5"
                  textAnchor="middle"
                  style={{ fontFamily: "ui-monospace, monospace" }}
                >
                  +18% · 23min
                </text>
              </g>
            </svg>
            <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-[#9A8662] tabular-nums">
              <span>12:00</span>
              <span>18:00</span>
              <span>00:00</span>
              <span>06:00</span>
              <span className="text-white font-bold">NOW</span>
            </div>
          </div>
        </div>

        {/* Alert strip — warm cream */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: "#F5E4C2", borderTop: "1px solid #E9D1A6" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B4F2A]">
              Cherry · {sample.assistantName}
            </p>
            <p className="text-[12px] font-extrabold text-[#2A1E15] leading-tight truncate">
              {sample.notif.title}
            </p>
          </div>
          <span className="text-[10px] font-bold text-[#9A7C55] flex-shrink-0">{sample.notif.when}</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 2. Auction — ticket stub with countdown & bid ladder ══════════ */
export function AuctionTicket({ sample }: { sample: Sample }) {
  return (
    <div className="max-w-[400px] mx-auto">
      <div
        className="rounded-[20px] overflow-hidden bg-[#FDFBF5]"
        style={{
          border: "1px solid #E9D1A6",
          boxShadow: "0 24px 60px rgba(107,79,42,0.22)",
        }}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center gap-3 relative"
          style={{ background: "linear-gradient(135deg, #F5E4C2 0%, #EFD5A6 100%)" }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-[28px] flex-shrink-0"
            style={{ backgroundColor: "#3A2A1C" }}
          >
            🎬
          </div>
          <div className="flex-1 min-w-0 pr-10">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6B4F2A]">
              LOT #2391
            </p>
            <p className="text-[14px] font-extrabold text-[#2A1E15] leading-tight truncate">
              Signed Hitchcock Poster
            </p>
            <p className="text-[10px] text-[#9A7C55] mt-0.5">A3 · Mint condition</p>
          </div>
          {/* LIVE badge */}
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#B12A17" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: "auction-pulse 1.2s ease-in-out infinite" }} />
            <span className="text-[9px] font-black tracking-wider text-white">LIVE</span>
          </div>
        </div>

        {/* Perforation */}
        <div className="relative h-0">
          <div className="w-3 h-3 rounded-full absolute -left-1.5 top-1/2 -translate-y-1/2" style={{ backgroundColor: "#F7F1E0" }} />
          <div className="w-3 h-3 rounded-full absolute -right-1.5 top-1/2 -translate-y-1/2" style={{ backgroundColor: "#F7F1E0" }} />
          <div className="absolute left-3 right-3 top-0 border-t border-dashed" style={{ borderColor: "#E9D1A6" }} />
        </div>

        {/* Countdown + bids */}
        <div className="p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#9A7C55] mb-1 text-center">
            Time to close
          </p>
          <p
            className="text-[42px] font-black tracking-tighter tabular-nums leading-none text-center"
            style={{ color: "#B12A17", fontFamily: "ui-monospace, monospace" }}
          >
            03 : 42
          </p>

          <div className="mt-5 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between text-[#9A7C55] tabular-nums">
              <span>3 min · wjd***</span>
              <span>$ 225</span>
            </div>
            <div className="flex justify-between text-[#6B4F2A] tabular-nums">
              <span>1 min · kim***</span>
              <span>$ 240</span>
            </div>
            <div className="flex justify-between font-bold tabular-nums" style={{ color: sample.accent }}>
              <span>▶ now · parky***</span>
              <span>$ 245</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes auction-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

/* ══════════ 3. Used Market — phone frame with KakaoTalk chat ══════════ */
export function PhoneChat({ sample }: { sample: Sample }) {
  return (
    <div className="max-w-[280px] mx-auto">
      <div
        className="rounded-[38px] p-2.5"
        style={{
          background: "linear-gradient(180deg, #2A1E15 0%, #1A120A 100%)",
          boxShadow: "0 28px 70px rgba(42,30,21,0.38), inset 0 0 0 1.5px #5D4630",
        }}
      >
        {/* Notch */}
        <div className="relative h-5 flex items-start justify-center pt-1">
          <div className="w-16 h-4 rounded-b-xl" style={{ backgroundColor: "#1A120A" }} />
        </div>
        {/* Screen */}
        <div className="rounded-[26px] overflow-hidden" style={{ backgroundColor: "#FBF6ED" }}>
          {/* Status bar */}
          <div className="px-4 pt-2 pb-1 flex items-center justify-between text-[9px] font-bold text-[#3A2A1C] tabular-nums">
            <span>02:15</span>
            <span>● ● ●</span>
          </div>
          {/* Chat header */}
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid #E9D1A6" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] flex-shrink-0"
              style={{ backgroundColor: sample.accent, color: "white" }}
            >
              {sample.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-[#2A1E15] leading-tight">
                Cherry · {sample.assistantName}
              </p>
              <p className="text-[9px] text-[#2D7A5E] leading-tight flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D7A5E]" />
                Online
              </p>
            </div>
          </div>
          {/* Messages */}
          <div className="px-3 py-3 space-y-2.5">
            <p className="text-center text-[8px] text-[#9A7C55]">— 02:14 AM —</p>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-3 py-1.5 max-w-[80%]" style={{ backgroundColor: "#FEE500" }}>
                <p className="text-[10px] text-[#2A1E15]">Ping me if an LG Gram 16" goes under $600</p>
              </div>
            </div>
            <div className="flex">
              <div
                className="rounded-2xl rounded-bl-sm px-2.5 py-2 bg-white max-w-[85%]"
                style={{ border: "1px solid #E9D1A6" }}
              >
                <p className="text-[10px] font-extrabold text-[#2A1E15] mb-1">🔔 Just listed</p>
                <div className="rounded-lg p-2" style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6" }}>
                  <div
                    className="w-full h-16 rounded-md mb-1.5 flex items-center justify-center text-[26px]"
                    style={{ backgroundColor: "#E9D1A6" }}
                  >
                    💻
                  </div>
                  <p className="text-[9px] font-bold text-[#2A1E15]">LG Gram 16" · Sealed</p>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <p className="text-[12px] font-extrabold" style={{ color: sample.accent }}>$ 590</p>
                    <p className="text-[8px] text-[#2D7A5E] font-bold">−$90 vs market</p>
                  </div>
                  <p className="text-[7px] text-[#9A7C55] mt-0.5">3s ago · Marketplace</p>
                </div>
                <p className="text-[9px] text-[#6B4F2A] mt-1.5">Open seller contact?</p>
              </div>
            </div>
            <p className="text-right text-[8px] text-[#9A7C55] pr-1">02:15</p>
          </div>
        </div>
      </div>
    </div>
  )
}
