
"use client"

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ count, color = "#C94B6E" }: { count: number; color?: string }) {
  return (
    <span className="flex items-center gap-[1px] text-[12px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Progress Bar
───────────────────────────────────────────── */
function ProgressBar({ value, color, trackColor = "#EEF2FD" }: { value: number; color: string; trackColor?: string }) {
  return (
    <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: trackColor }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sparkline SVG
───────────────────────────────────────────── */
function Sparkline() {
  const points = "10,70 40,62 70,54 100,44 130,32 160,20 190,12"
  return (
    <div
      className="rounded-[8px] border p-3"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">
        2-week momentum
      </p>
      <svg viewBox="0 0 200 80" className="w-full h-16">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C94B6E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#C94B6E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1="0" y1="78" x2="200" y2="78" stroke="#E4E1EE" strokeWidth="1" />
        {/* fill area */}
        <polygon
          points={`${points} 190,78 10,78`}
          fill="url(#sparkFill)"
        />
        {/* line */}
        <polyline
          points={points}
          fill="none"
          stroke="#C94B6E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* end dot */}
        <circle cx="190" cy="12" r="3.5" fill="#C94B6E" />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */
const LEADERBOARD = [
  {
    rank: 1, company: "OpenAI", score: 92.4,
    models: "GPT-5, GPT-5-Codex-Max, GPT-OSS",
    color: "#4B78F0", bgColor: "#F8F9FF", borderColor: "#C8D5F8",
    badgeLabel: "LEAD", badgeBg: "#EEF2FD", badgeText: "#4B78F0",
    trackColor: "#EEF2FD", isLead: true,
  },
  {
    rank: 2, company: "Anthropic", score: 91.0,
    models: "Claude 3.7 Sonnet",
    color: "#C94B6E", bgColor: "#FDF7F8", borderColor: "#F2C4CE",
    badgeLabel: "NEW ↑", badgeBg: "#C94B6E", badgeText: "#FFFFFF",
    trackColor: "#FDF0F3",
  },
  {
    rank: 3, company: "Google", score: 89.2,
    models: "Gemini 2.0 Pro, Flash Thinking",
    color: "#7B5EA7", bgColor: "#FFFFFF", borderColor: "#E4E1EE",
    trackColor: "#F3EFFA",
  },
  {
    rank: 4, company: "xAI", score: 87.5,
    models: "Grok 3, Grok 3-Mini",
    color: "#9E97B3", bgColor: "#FFFFFF", borderColor: "#E4E1EE",
    trackColor: "#F2F0F7",
  },
  {
    rank: 5, company: "Meta", score: 73.7,
    models: "Llama 4 Scout, Maverick",
    color: "#5A8DFF", bgColor: "#FFFFFF", borderColor: "#E4E1EE",
    trackColor: "#EEF2FD",
  },
  {
    rank: 6, company: "DeepSeek", score: 71.5,
    models: "DeepSeek R2, V3",
    color: "#6AA8A0", bgColor: "#FFFFFF", borderColor: "#E4E1EE",
    trackColor: "#EEF7F6",
  },
]

const MODEL_UPDATES = [
  {
    id: "1", initials: "AN", company: "Anthropic", date: "Feb 25", stars: 5,
    accentColor: "#C94B6E", avatarBg: "#FDF0F3", avatarBorder: "#F2C4CE",
    badgeBg: "#FDF0F3", badgeText: "#C94B6E",
    title: "Claude 3.7 Sonnet — extended thinking matches o1 on SWE-bench",
    desc: "Opt-in via API parameter. Cost parity with Claude 3.5. Significant uplift on multi-step reasoning.",
  },
  {
    id: "2", initials: "OA", company: "OpenAI", date: "Feb 24", stars: 4,
    accentColor: "#E94057", avatarBg: "#FEF2F2", avatarBorder: "#FECDD3",
    badgeBg: "#FEF2F2", badgeText: "#E94057",
    title: "GPT-5.2 multimodal reasoning — spreadsheets, slides, code, vision",
    desc: "Adds structured output generation across document types. 250k context. Replaces GPT-4o for complex tasks.",
  },
  {
    id: "3", initials: "GO", company: "Google", date: "Feb 24", stars: 4,
    accentColor: "#7B5EA7", avatarBg: "#F3EFFA", avatarBorder: "#C7B8E8",
    badgeBg: "#F3EFFA", badgeText: "#7B5EA7",
    title: "Gemini 2.0 Flash Thinking — 1/10th cost of o1 for reasoning",
    desc: "Cost-efficient reasoning model. Strong on code and math. Weaker on multi-step logic chains than o1.",
  },
  {
    id: "4", initials: "MI", company: "Mistral", date: "Feb 23", stars: 4,
    accentColor: "#D4854A", avatarBg: "#FEF3E2", avatarBorder: "#F0D8B0",
    badgeBg: "#FEF3E2", badgeText: "#D4854A",
    title: "Mistral Small 3.1 — best open-source at 24B params",
    desc: "Outperforms Llama 3.3 70B on MMLU. Apache 2.0 license. Runs on a single A100.",
  },
  {
    id: "5", initials: "ME", company: "Meta", date: "Feb 22", stars: 3,
    accentColor: "#5A8DFF", avatarBg: "#EEF2FD", avatarBorder: "#C8D5F8",
    badgeBg: "#EEF2FD", badgeText: "#5A8DFF",
    title: "Llama 4 Scout — Meta's 17B MoE with 10M context",
    desc: "Mixture-of-experts, 10M token context window. Beats Gemma 3 27B on most benchmarks.",
  },
]

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function NDModelUpdatesPage() {
  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <h1
        className="font-extrabold text-[#1A1626] mb-2 leading-tight"
        style={{ fontSize: "26px", letterSpacing: "-0.3px" }}
      >
        Model Updates
      </h1>
      <p className="text-[13px] text-[#9E97B3] mb-6">
        5 releases this week · Performance benchmarks and API changes
      </p>

      {/* ── Section 1: Leaderboard ── */}
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-3">
          Major Players — GPQA Benchmark
        </p>

        <div className="grid grid-cols-3 gap-[10px]">
          {LEADERBOARD.map((entry) => (
            <div
              key={entry.rank}
              className={`rounded-[10px] border p-4 transition-shadow hover:shadow-md ${entry.isLead ? "col-span-3" : ""}`}
              style={{
                backgroundColor: entry.bgColor,
                borderColor: entry.borderColor,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#9E97B3]">#{entry.rank}</span>
                {entry.badgeLabel && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                    style={{ backgroundColor: entry.badgeBg, color: entry.badgeText }}
                  >
                    {entry.badgeLabel}
                  </span>
                )}
              </div>
              <p className={`font-bold text-[#1A1626] mb-1 ${entry.isLead ? "text-[16px]" : "text-[14px]"}`}>
                {entry.company}
              </p>
              <p
                className={`font-bold mb-2 ${entry.isLead ? "text-[22px]" : "text-[18px]"}`}
                style={{ color: entry.color }}
              >
                {entry.score}% GPQA
              </p>
              <ProgressBar value={entry.score} color={entry.color} trackColor={entry.trackColor} />
              <p className="text-[11px] text-[#9E97B3] mt-2 leading-snug">{entry.models}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Rising Star ── */}
      <div className="mb-6">
        <div
          className="flex items-start gap-6 rounded-[10px] border p-5"
          style={{ backgroundColor: "#FFF8EF", borderColor: "#F0D8B0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          {/* Left */}
          <div className="flex-1 min-w-0">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border mb-2"
              style={{ backgroundColor: "#FEF3E2", color: "#D4854A", borderColor: "#F0D8B0" }}
            >
              Rising Star — This Week
            </span>
            <h3 className="text-[16px] font-bold text-[#1A1626] mb-1">
              Claude 3.7 Sonnet — Extended Thinking
            </h3>
            <Stars count={5} />
            <p className="text-[13px] leading-relaxed mt-2 mb-4" style={{ color: "#3D3652" }}>
              Higher SWE-bench performance with extended thinking, while keeping cost near Claude 3.5 Sonnet. Opt-in via API parameter.
            </p>
            <div className="flex items-center gap-4">
              {[
                { num: "250k+", label: "mentions" },
                { num: "+189%", label: "trend" },
                { num: "SOTA", label: "SWE-bench" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[16px] font-bold text-[#1A1626]">{s.num}</p>
                  <p className="text-[10px] text-[#9E97B3]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right sparkline */}
          <div className="flex-shrink-0 w-[200px]">
            <Sparkline />
          </div>
        </div>
      </div>

      {/* ── Section 3: All Model Updates ── */}
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-3">
          All Model Updates This Week
        </p>

        <div className="flex flex-col gap-[10px]">
          {MODEL_UPDATES.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-[10px] border border-[#E4E1EE] p-4 flex gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
              style={{ borderLeft: `3px solid ${u.accentColor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border"
                style={{ backgroundColor: u.avatarBg, color: u.accentColor, borderColor: u.avatarBorder }}
              >
                {u.initials}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#1A1626] mb-1 leading-snug">{u.title}</p>
                <p className="text-[13px] text-[#9E97B3] leading-relaxed mb-2">{u.desc}</p>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ backgroundColor: u.badgeBg, color: u.badgeText, borderColor: u.avatarBorder }}
                  >
                    Models
                  </span>
                  <Stars count={u.stars} />
                  <span className="text-[11px] text-[#9E97B3]">{u.company} · {u.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
