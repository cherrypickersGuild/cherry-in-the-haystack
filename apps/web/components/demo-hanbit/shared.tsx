"use client"

/**
 * /demo 공용 조각 — 섹션 헤더, 프레임, MCP 터미널 블록.
 * 체리 디자인 토큰(globals.css)을 그대로 사용.
 */

import { useState } from "react"

export const FONT_ROUNDED = 'var(--font-rounded), "Inter", system-ui, sans-serif'
export const FONT_MONO = '"Geist Mono", Consolas, monospace'

export function SectionHeader({
  step,
  kicker,
  title,
  desc,
}: {
  step: number
  kicker: string
  title: string
  desc: string
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="flex items-center justify-center rounded-[8px] text-white font-extrabold"
          style={{ backgroundColor: "var(--cherry)", width: 26, height: 26, fontSize: 13 }}
        >
          {step}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--cherry)" }}>
          {kicker}
        </span>
      </div>
      <h2
        className="text-[22px] lg:text-[28px] font-extrabold text-text-primary tracking-[-0.5px] leading-[1.15] mb-2.5"
        style={{ fontFamily: FONT_ROUNDED }}
      >
        {title}
      </h2>
      <p className="text-[13.5px] lg:text-[14.5px] text-text-secondary leading-relaxed max-w-[680px]">
        {desc}
      </p>
    </div>
  )
}

/** "무대 뒤" 비주얼을 감싸는 카드 */
export function DemoFrame({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode
  label?: string
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border bg-card shadow-card overflow-hidden ${className}`}
      style={{ borderColor: "#E4E1EE" }}
    >
      {label && (
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2"
          style={{ borderColor: "#E4E1EE", backgroundColor: "#FBFAF8" }}
        >
          <span className="flex gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F2C4CE" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#C7B8E8" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#A8D4C0" }} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted ml-1">
            {label}
          </span>
        </div>
      )}
      <div className="p-4 lg:p-5">{children}</div>
    </div>
  )
}

/**
 * McpTerminal — `mcp add cherry-mcp` 터미널 블록.
 * 4·6·7섹션에 붙여 "Cherry가 에이전트에 직접 연결된다"는 사실을 한눈에.
 */
export function McpTerminal({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText("mcp add cherry-mcp")
    } catch { /* noop */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div
      className="rounded-[12px] overflow-hidden border"
      style={{ backgroundColor: "#1A1626", borderColor: "#3D3652" }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2 border-b"
        style={{ borderColor: "#3D3652" }}
      >
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C94B6E" }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#D4854A" }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#2D7A5E" }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] ml-1" style={{ color: "#9E97B3", fontFamily: FONT_MONO }}>
          terminal — 연결하기
        </span>
        <button
          onClick={copy}
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-[6px] border cursor-pointer transition-colors"
          style={{
            color: copied ? "#2D7A5E" : "#9E97B3",
            borderColor: copied ? "#2D7A5E" : "#3D3652",
            backgroundColor: copied ? "rgba(45,122,94,0.15)" : "transparent",
          }}
        >
          {copied ? "✓ 복사됨" : "복사"}
        </button>
      </div>
      <div className="px-4 py-3.5" style={{ fontFamily: FONT_MONO }}>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "#CDD6F4" }}>
          <span style={{ color: "#2D7A5E" }}>$</span>{" "}
          <span style={{ color: "#F5F0FA" }}>mcp add cherry-mcp</span>
          <span
            className="inline-block w-[7px] h-[14px] align-middle ml-0.5"
            style={{ backgroundColor: "var(--cherry)", animation: "demo-blink 1.1s step-end infinite" }}
          />
        </p>
        {!compact && (
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#9E97B3" }}>
            <span style={{ color: "#2D7A5E" }}>✓</span> cherry-mcp 연결됨 — 이제 에이전트가 Cherry 지식을
            검색·구매·설치할 수 있습니다
          </p>
        )}
      </div>
      <style>{`
        @keyframes demo-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}

/** 별점 (마켓/카탈로그 공용 스타일) */
export function Stars({ score }: { score: number }) {
  const full = Math.floor(score)
  const half = score - full >= 0.5
  return (
    <span className="flex items-center gap-[1px] text-[11px]" style={{ color: "#C94B6E" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < full ? 1 : i === full && half ? 0.6 : 0.2 }}>
          ★
        </span>
      ))}
      <span className="ml-1 text-[10px] font-semibold" style={{ color: "#3D3652" }}>
        {score.toFixed(1)}
      </span>
    </span>
  )
}
