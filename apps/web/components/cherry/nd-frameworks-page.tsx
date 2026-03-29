
"use client"

import { useState } from "react"

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
   Logo Pill
───────────────────────────────────────────── */
function LogoPill({ abbr, bg, label, isHighlighted, abbrColor }: {
  abbr: string
  bg: string
  label: string
  isHighlighted?: boolean
  abbrColor?: string
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] border transition-colors"
      style={{
        backgroundColor: isHighlighted ? "#FDF0F3" : "#F2F0F7",
        borderColor: isHighlighted ? "#F2C4CE" : "#E4E1EE",
      }}
    >
      <div
        className="w-5 h-5 rounded-[4px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bg, fontSize: "7px", fontWeight: 700, color: abbrColor ?? "#ffffff" }}
      >
        {abbr}
      </div>
      <span
        className="text-[10px] font-medium"
        style={{ color: isHighlighted ? "#C94B6E" : "#1A1626" }}
      >
        {label}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Bar Chart SVG
───────────────────────────────────────────── */
function BarChart() {
  const bars = [
    { h: 18, dim: true }, { h: 22, dim: true }, { h: 20, dim: true },
    { h: 25, dim: true }, { h: 28, dim: true }, { h: 24, dim: true }, { h: 30, dim: true },
    { h: 35, dim: false }, { h: 40, dim: false }, { h: 45, dim: false },
    { h: 52, dim: false }, { h: 58, dim: false }, { h: 62, dim: false }, { h: 70, dim: false },
  ]
  const barW = 10
  const gap = 5
  const chartH = 70

  return (
    <div
      className="rounded-[10px] border p-3"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE" }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#9E97B3] mb-2">
        2주 언급량 추이 · Daily mentions
      </p>
      <svg viewBox={`0 0 ${bars.length * (barW + gap) - gap} ${chartH}`} className="w-full h-[70px]">
        <defs>
          {/* dashed grid lines */}
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0} y1={chartH * (1 - f)}
            x2={bars.length * (barW + gap) - gap} y2={chartH * (1 - f)}
            stroke="#E4E1EE" strokeDasharray="3,3" strokeWidth="0.5"
          />
        ))}
        {/* divider between week 1 & 2 */}
        <line
          x1={7 * (barW + gap) - gap / 2} y1={0}
          x2={7 * (barW + gap) - gap / 2} y2={chartH}
          stroke="#E4E1EE" strokeDasharray="3,3" strokeWidth="1"
        />
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={chartH - bar.h}
            width={barW}
            height={bar.h}
            rx={2}
            fill={bar.dim ? "#C94B6E" : "#E94057"}
            opacity={bar.dim ? (0.3 + i * 0.03) : 1}
          />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-[#9E97B3]">Feb 10</span>
        <span className="text-[11px] font-bold" style={{ color: "#C94B6E" }}>+312% ↑</span>
        <span className="text-[9px] text-[#9E97B3]">Feb 24</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function NDFrameworksPage() {
  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <h1
        className="font-extrabold text-[#1A1626] mb-2 leading-tight"
        style={{ fontSize: "26px", letterSpacing: "-0.3px" }}
      >
        Frameworks
      </h1>
      <p className="text-[13px] text-[#9E97B3] mb-7">
        주요 프레임워크의 벤치마크 성능과 최신 릴리즈 소식을 한눈에 확인하세요
      </p>

      {/* ── Section 1: Major Framework ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">
            Major Framework
          </h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>

        <div className="grid grid-cols-4 gap-[10px]">
          {/* Card 1 — Agent */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">🤖</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Agent</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="AG" bg="#E94057" label="AutoGPT" isHighlighted />
              <LogoPill abbr="LC" bg="#8B5CF6" label="LangChain" />
              <LogoPill abbr="LG" bg="#0891B2" label="LangGraph" />
              <LogoPill abbr="CR" bg="#EA580C" label="CrewAI" />
            </div>
          </div>

          {/* Card 2 — Fine-tuning */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">🎯</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Fine-Tuning</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="LF" bg="#3B82F6" label="LLaMA-Factory" isHighlighted />
              <LogoPill abbr="UN" bg="#EF4444" label="Unsloth" />
              <LogoPill abbr="AX" bg="#6366F1" label="Axolotl" />
            </div>
          </div>

          {/* Card 3 — RAG */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">🔍</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">RAG</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="RF" bg="#7C3AED" label="RAGFlow" isHighlighted />
              <LogoPill abbr="HS" bg="#059669" label="Haystack" />
              <LogoPill abbr="RG" bg="#D97706" label="RAGAS" />
            </div>
          </div>

          {/* Card 4 — Prompt Engineering */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">✏️</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Prompt Eng.</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="DS" bg="#DC2626" label="DSPy" isHighlighted />
              <LogoPill abbr="GD" bg="#0891B2" label="Guidance" />
            </div>
          </div>

          {/* Card 5 — Serving */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">📬</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Serving</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="OL" bg="#10B981" label="Ollama" isHighlighted />
              <LogoPill abbr="vL" bg="#8B5CF6" label="vLLM" />
              <LogoPill abbr="TR" bg="#76B900" label="TensorRT-LLM" />
            </div>
          </div>

          {/* Card 6 — Data / Search & Storage */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">🗄️</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Data / Storage</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="LI" bg="#F97316" label="LlamaIndex" isHighlighted />
              <LogoPill abbr="CB" bg="#E91E8C" label="ChromaDB" />
              <LogoPill abbr="WV" bg="#00C7B7" label="Weaviate" />
            </div>
          </div>

          {/* Card 7 — LLMOps */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">⚙️</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">LLMOps</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="ML" bg="#0194E2" label="MLflow" isHighlighted />
              <LogoPill abbr="WB" bg="#FFBE00" label="W&B" abbrColor="#1A1A1A" />
              <LogoPill abbr="LS" bg="#16A34A" label="LangSmith" />
            </div>
          </div>

          {/* Card 8 — Observability / Evaluation */}
          <div className="bg-white border border-[#E4E1EE] rounded-[10px] p-3.5 hover:border-[#7B5EA7] transition-colors cursor-pointer" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="text-[18px] mb-1">📊</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#1A1626] mb-2">Observability</p>
            <div className="flex flex-col gap-1.5">
              <LogoPill abbr="LF" bg="#7B5EA7" label="Langfuse" isHighlighted />
              <LogoPill abbr="PX" bg="#EA580C" label="Phoenix" />
              <LogoPill abbr="TL" bg="#0D9488" label="TruLens" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Rising Star ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">
            Rising Star
          </h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>

        <div
          className="flex items-center gap-5 rounded-[10px] border p-5"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          {/* Left */}
          <div className="flex-1 min-w-0">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border mb-2"
              style={{ backgroundColor: "#FDF0F3", color: "#C94B6E", borderColor: "#F2C4CE" }}
            >
              Rising Star — 이번 주 주목할 프레임워크
            </span>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[20px] font-bold text-[#1A1626]">AutoGPT</h3>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: "#C94B6E" }}
              >
                HOT
              </span>
            </div>
            <p className="text-[13px] text-[#9E97B3] mb-2">
              에이전트 빌더, 워크플로 관리, 배포 제어, 즉시 사용 가능한 에이전트
            </p>
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#3D3652" }}>
              AutoGPT는 자율 AI 에이전트 구축을 위한 오픈소스 플랫폼으로, 워크플로 자동화부터 멀티 에이전트 오케스트레이션까지 지원합니다. 이번 주 커뮤니티에서 가장 활발히 언급된 프레임워크입니다.
            </p>
            <div className="flex items-center gap-5">
              {[
                { num: "180k+", label: "Mentions (2 weeks)" },
                { num: "+312%", label: "Trend" },
                { num: "168.4k", label: "GitHub Stars" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[14px] font-bold text-[#1A1626]">{s.num}</p>
                  <p className="text-[11px] text-[#9E97B3]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Bar Chart */}
          <div className="flex-shrink-0 w-[210px]">
            <BarChart />
          </div>
        </div>
      </div>

      {/* ── Section 3: Latest Updates ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[15px] font-bold text-[#1A1626] whitespace-nowrap">
            Latest Updates
          </h2>
          <div className="flex-1 border-t border-[#E4E1EE]" />
        </div>

        <div className="flex flex-col gap-2">
          {[
            { name: "vLLM", version: "v0.8.2", vColor: "#C94B6E", vBg: "#FDF0F3", date: "Feb 25", border: "#C94B6E", desc: "Speculative decoding & chunked prefill 성능 개선. 추론 처리량 최대 2.4배 향상.", link: "#C94B6E" },
            { name: "unsloth", version: "v2026.2.1", vColor: "#7B5EA7", vBg: "#F3EFFA", date: "Feb 24", border: "#7B5EA7", desc: "2배 빠른 파인튜닝과 VRAM 사용량 60% 감소. Llama 4 Scout 지원 추가.", link: "#7B5EA7" },
            { name: "ollama", version: "v0.6.2", vColor: "#2D7A5E", vBg: "#EFF7F3", date: "Feb 23", border: "#2D7A5E", desc: "모델 컨텍스트 캐싱 추가 및 멀티모달 스트리밍 안정성 개선.", link: "#2D7A5E" },
            { name: "Langfuse", version: "v3.14.0", vColor: "#D4854A", vBg: "#FEF3E2", date: "Feb 22", border: "#D4854A", desc: "실시간 LLM 관찰 기능 강화. 토큰 비용 추적 대시보드 추가.", link: "#D4854A" },
            { name: "LlamaIndex", version: "v0.12.3", vColor: "#5A8DFF", vBg: "#EEF2FD", date: "Feb 21", border: "#5A8DFF", desc: "하이브리드 검색 파이프라인 개선 및 새로운 LLM 공급자 커넥터 추가.", link: "#5A8DFF" },
          ].map((item) => (
            <div
              key={item.name}
              className="bg-white rounded-[10px] border border-[#E4E1EE] p-3.5 hover:translate-x-0.5 transition-transform cursor-pointer"
              style={{ borderLeft: `3px solid ${item.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1A1626]">{item.name}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                    style={{ backgroundColor: item.vBg, color: item.vColor, borderColor: item.vColor + "44" }}
                  >
                    {item.version}
                  </span>
                </div>
                <span className="text-[10px] text-[#9E97B3]">Feb {item.date.replace("Feb ", "")}</span>
              </div>
              <p className="text-[12px] text-[#9E97B3] leading-relaxed mb-2">{item.desc}</p>
              <a
                href="#"
                className="text-[11px] font-semibold"
                style={{ color: item.link }}
              >
                상세 보기 →
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
