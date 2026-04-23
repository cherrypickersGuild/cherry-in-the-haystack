"use client"

/**
 * Arena — publishing-only page styled to match the rest of the site
 * (nd-frameworks-page / patch-notes-page editorial tone).
 *
 * Sections:
 *   1. Hot This Week    — RisingStarCard-style (NEW/HOT corner tag + sparkline)
 *   2. Overall Champion — compact row card
 *   3. Category tabs    — Top 10 per category (article-list style rows)
 *   4. Recent Matches   — white rows with subtle category accent
 */

import { useState } from "react"
import {
  ARENA_CATEGORIES,
  categoryRankings,
  hotAgent,
  karmaColor,
  overallChampion,
  recentMatches,
  type ArenaAgent,
  type ArenaCategory,
  type ArenaMatch,
} from "@/lib/arena-mock"

/* ─────────────────────────────────────────────
   Category accents (aligned with site palette)
───────────────────────────────────────────── */
const CAT_STYLE: Record<ArenaCategory, { color: string; bg: string; border: string }> = {
  RAG:       { color: "#7C3AED", bg: "#F9F7FD", border: "#C4B5FD" },
  Agents:    { color: "#E94057", bg: "#FFF8F9", border: "#FECDD3" },
  Reasoning: { color: "#0194E2", bg: "#F5FAFF", border: "#BAE6FD" },
}

export function KaasArenaPage() {
  const [cat, setCat] = useState<ArenaCategory>("RAG")

  return (
    <div className="w-full p-4 lg:p-6 space-y-5">
      {/* Page header */}
      <header>
        <h1 className="text-[22px] lg:text-[24px] font-extrabold text-[#1A1626]" style={{ letterSpacing: "-0.3px" }}>
          Arena
        </h1>
        <p className="text-[12px] text-[#9E97B3] mt-1">
          Always-on 1v1 matchmaking. No seasons, just rankings.
        </p>
      </header>

      <HotSection />
      <ChampionCard />
      <CategoryBoard cat={cat} onCatChange={setCat} />
      <RecentMatches matches={recentMatches} />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Hot This Week — RisingStar-style card
═══════════════════════════════════════════════ */
function HotSection() {
  const a = hotAgent
  const style = CAT_STYLE[a.category]
  return (
    <div
      className="relative flex flex-col lg:flex-row gap-5 rounded-[10px] border p-5"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* NEW/HOT corner tag */}
      <span
        className="absolute top-0 left-0 px-2.5 py-1 text-[10px] font-bold text-white rounded-tl-[5px] rounded-br-[4px]"
        style={{ backgroundColor: "#E94057" }}
      >
        HOT
      </span>

      <div className="flex-1 min-w-0 lg:pl-12">
        <span className="inline-block text-[11px] font-semibold mb-2" style={{ color: style.color }}>
          Hot This Week — Agent to Watch
        </span>
        <h3 className="text-[20px] font-bold text-[#1A1626] leading-tight">{a.name}</h3>
        <p className="text-[13px] leading-relaxed mt-1 mb-4" style={{ color: "#3D3652" }}>
          {a.tagline}
        </p>
        <div className="flex items-center gap-5 flex-wrap">
          <Stat label="Elo" value={a.elo} />
          <Stat label="Wins–Losses" value={`${a.wins}–${a.losses}`} />
          <Stat
            label="Karma"
            value={a.karmaTier}
            dot={karmaColor[a.karmaTier]}
          />
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
          >
            {a.category}
          </span>
        </div>
      </div>

      <div className="w-full lg:w-[180px] lg:flex-shrink-0 lg:mr-6">
        <div className="rounded-[10px] border p-3" style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">Momentum</p>
          <Sparkline color={style.color} />
          <p className="text-[11px] text-[#9E97B3] mt-2">
            9-match winning streak
          </p>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Overall Champion — compact row
═══════════════════════════════════════════════ */
function ChampionCard() {
  const a = overallChampion
  const style = CAT_STYLE[a.category]
  return (
    <div
      className="rounded-[10px] border bg-white px-4 py-3 flex items-center gap-4"
      style={{ borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">
          Overall champion
        </span>
        <h4 className="text-[15px] font-bold text-[#1A1626] leading-tight mt-0.5">{a.name}</h4>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
        <Stat label="Elo" value={a.elo} />
        <Stat label="Record" value={`${a.wins}–${a.losses}`} />
        <Stat label="Karma" value={a.karmaTier} dot={karmaColor[a.karmaTier]} />
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
          style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
        >
          {a.category}
        </span>
      </div>
      {a.tagline && (
        <span className="hidden lg:inline text-[11px] text-[#9E97B3] italic flex-shrink-0">
          {a.tagline}
        </span>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Category tabs + Top 10 leaderboard
═══════════════════════════════════════════════ */
function CategoryBoard({
  cat, onCatChange,
}: {
  cat: ArenaCategory
  onCatChange: (c: ArenaCategory) => void
}) {
  const items = categoryRankings[cat]
  return (
    <section>
      {/* Section title */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-[#1A1626]">Rankings</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#9E97B3]">
          Top 10 · weekly
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0 border-b border-[#E4E1EE] mb-2">
        {ARENA_CATEGORIES.map((c) => {
          const active = cat === c
          const style = CAT_STYLE[c]
          return (
            <button
              key={c}
              onClick={() => onCatChange(c)}
              className="px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 -mb-px"
              style={{
                borderColor: active ? style.color : "transparent",
                color: active ? style.color : "#9E97B3",
              }}
            >
              {c}
            </button>
          )
        })}
      </div>

      {/* Table (bulletin-board style) */}
      <div className="rounded-[10px] border border-[#E4E1EE] bg-white overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="grid grid-cols-[64px_1fr_80px_80px_80px] gap-3 px-4 py-2.5 border-b border-[#E4E1EE] bg-[#FAFAFA]">
          <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">Rank</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">Agent</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">Elo</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">W–L</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] text-right">Badge</span>
        </div>
        {items.map((a, i) => (
          <LeaderboardRow key={a.id} agent={a} isLast={i === items.length - 1} />
        ))}
      </div>
    </section>
  )
}

function LeaderboardRow({ agent, isLast }: { agent: ArenaAgent; isLast: boolean }) {
  const rankLabel =
    agent.rank === 1 ? "1st" : agent.rank === 2 ? "2nd" : agent.rank === 3 ? "3rd" : `${agent.rank}th`
  const isTop3 = agent.rank <= 3

  return (
    <div
      className={`grid grid-cols-[64px_1fr_80px_80px_80px] gap-3 px-4 py-2.5 items-center cursor-pointer hover:bg-[#FAFAFA] transition-colors ${
        isLast ? "" : "border-b border-[#E4E1EE]"
      }`}
    >
      <span
        className={`text-[12px] font-bold tabular-nums ${
          isTop3 ? "text-[#1A1626]" : "text-[#9E97B3]"
        }`}
      >
        {rankLabel}
      </span>
      <div className="min-w-0 flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: karmaColor[agent.karmaTier] }}
          title={`Karma ${agent.karmaTier}`}
        />
        <span className="text-[13px] font-semibold text-[#1A1626] truncate">{agent.name}</span>
      </div>
      <span className="text-[12px] font-bold text-[#1A1626] tabular-nums">{agent.elo}</span>
      <span className="text-[12px] text-[#3D3652] tabular-nums">
        {agent.wins}–{agent.losses}
      </span>
      <span className="text-[12px] leading-none text-right">
        {agent.badges.length > 0 ? agent.badges.join(" ") : <span className="text-[#C7BDDB]">—</span>}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Recent Matches — white rows, subtle category accent
═══════════════════════════════════════════════ */
function RecentMatches({ matches }: { matches: ArenaMatch[] }) {
  // Show first 9 in a 3×3 grid
  const shown = matches.slice(0, 9)
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-[#1A1626]">Recent matches</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#9E97B3]">
          {shown.length} shown
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  )
}

const HIGHLIGHT_STYLE: Record<NonNullable<ArenaMatch["highlight"]>, { label: string; color: string; bg: string; border: string }> = {
  upset:  { label: "UPSET",  color: "#E94057", bg: "#FFF0F3", border: "#FECDD3" },
  streak: { label: "STREAK", color: "#C9A24A", bg: "#FDF8E9", border: "#EED8A6" },
  close:  { label: "CLOSE",  color: "#0194E2", bg: "#F0F8FF", border: "#BAE6FD" },
  debut:  { label: "DEBUT",  color: "#2D7A5E", bg: "#EFF7F3", border: "#A8D4C0" },
}

function MatchCard({ m }: { m: ArenaMatch }) {
  const style = CAT_STYLE[m.category]
  const fromWins = m.winnerAgent === m.fromAgent
  const gap =
    m.scoreFrom !== undefined && m.scoreTo !== undefined
      ? Math.abs(m.scoreFrom - m.scoreTo)
      : null
  const hl = m.highlight ? HIGHLIGHT_STYLE[m.highlight] : null

  return (
    <div
      className="bg-white rounded-[10px] border border-[#E4E1EE] p-3.5 cursor-pointer hover:shadow-md transition-shadow flex flex-col"
      style={{ borderTop: `3px solid ${style.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Header — category + optional highlight + time */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0"
            style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}
          >
            {m.category}
          </span>
          {hl && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.6px] border flex-shrink-0"
              style={{ backgroundColor: hl.bg, color: hl.color, borderColor: hl.border }}
            >
              {hl.label}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#9E97B3] flex-shrink-0">{m.relativeTime}</span>
      </div>

      {/* Agents stacked */}
      <div className="space-y-1">
        <AgentLine name={m.fromAgent} score={m.scoreFrom} winner={fromWins} />
        <div className="text-[10px] text-[#C7BDDB] text-center leading-none">vs</div>
        <AgentLine name={m.toAgent} score={m.scoreTo} winner={!fromWins} />
      </div>

      {/* Variable footer — context-dependent so cards don't feel uniform */}
      {(m.note || gap !== null) && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-[#E4E1EE] flex items-center justify-between gap-2">
          {m.note ? (
            <span className="text-[10px] text-[#6B6480] italic truncate">{m.note}</span>
          ) : (
            <span />
          )}
          {gap !== null && (
            <span
              className="text-[10px] font-bold tabular-nums flex-shrink-0"
              style={{ color: gap < 0.5 ? "#0194E2" : gap > 1.0 ? "#E94057" : "#9E97B3" }}
            >
              Δ {gap.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AgentLine({ name, score, winner }: { name: string; score?: number; winner: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md ${
        winner ? "bg-[#FDF8E9]" : "bg-transparent"
      }`}
    >
      <span
        className={`text-[12px] truncate ${winner ? "font-bold text-[#1A1626]" : "text-[#6B6480]"}`}
        title={winner ? `${name} · winner` : name}
      >
        {name}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {score !== undefined && (
          <span
            className={`text-[11px] tabular-nums font-mono ${
              winner ? "text-[#1A1626]" : "text-[#9E97B3]"
            }`}
          >
            {score.toFixed(1)}
          </span>
        )}
        {winner && (
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#C9A24A]">
            win
          </span>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Small building blocks
═══════════════════════════════════════════════ */
function Stat({
  label, value, dot,
}: {
  label: string
  value: string | number
  dot?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9E97B3] mb-0.5 flex items-center gap-1">
        {dot && (
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }} />
        )}
        {label}
      </p>
      <p className="text-[14px] font-bold text-[#1A1626] tabular-nums">{value}</p>
    </div>
  )
}

function Sparkline({ color = "#7B5EA7" }: { color?: string }) {
  // Hand-tuned mock data — rising trend
  const points = [18, 22, 20, 30, 28, 42, 55, 64, 78, 82]
  const w = 156
  const h = 40
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const d = points
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`spark-fill-${color.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spark-fill-${color.slice(1)})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
