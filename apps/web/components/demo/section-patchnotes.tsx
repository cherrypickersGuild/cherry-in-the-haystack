"use client"

/**
 * 섹션 6 — 패치노트 & 지식 비교 (+ MCP 터미널).
 * 좌: 주간 체인지로그 타임라인 (실제 PatchNotesPage 비주얼).
 * 우: 지식 비교 + mcp add cherry-mcp — 비교 대상이 되는 "내 에이전트"에 붙는다.
 */

import { useState } from "react"
import { DemoFrame, McpTerminal } from "./shared"

const PATCH_ITEMS = [
  {
    id: "p1",
    date: "3월 28일",
    area: "모델",
    dotColor: "#7B5EA7",
    title: "Claude 4.5 Sonnet — extended thinking + 프롬프트 캐싱 GA",
    oneLiner: "사고 예산이 요청 단위로. 캐시 히트는 10% 과금.",
    score: 5,
  },
  {
    id: "p2",
    date: "3월 27일",
    area: "프레임워크",
    dotColor: "#2D7A5E",
    title: "LangGraph v0.3 — 장기 실행 에이전트용 durable execution",
    oneLiner: "체크포인팅이 1급 시민으로. 마이그레이션 가이드 공개.",
    score: 5,
  },
  {
    id: "p3",
    date: "3월 26일",
    area: "모델",
    dotColor: "#7B5EA7",
    title: "Gemini 2.5 Flash — 1M 컨텍스트 윈도우 공개 프리뷰",
    oneLiner: "롱컨텍스트 가격 구조 재편. 벤치마크 대기중.",
    score: 4,
  },
  {
    id: "p4",
    date: "3월 25일",
    area: "리서치",
    dotColor: "#C94B6E",
    title: "Self-RAG 논문 재현 — RAGBench에서 주장보다 약함",
    oneLiner: "독립 평가 상승폭 +3.1%, 논문 주장은 +9%.",
    score: 4,
  },
]

const COMPARE_ROWS = [
  { id: "rag", title: "Retrieval-Augmented Generation", status: "outdated" as const, note: "새 증거: contextual retrieval 벤치마크 (3/24)" },
  { id: "cot", title: "Chain-of-Thought Prompting", status: "up-to-date" as const, note: "3/21 최신 검증" },
  { id: "orch", title: "Agent Orchestration", status: "gap" as const, note: "에이전트 지식에 아직 없음" },
  { id: "emb", title: "Embeddings & Vector DBs", status: "up-to-date" as const, note: "3/20 최신 검증" },
]

const COMPARE_STYLE = {
  "up-to-date": { icon: "✓", text: "최신", color: "#2D7A5E", bg: "#EFF7F3", border: "#A8D4C0" },
  outdated:     { icon: "↻", text: "업데이트 있음", color: "#D4854A", bg: "#FDF6EE", border: "#F0D8B0" },
  gap:          { icon: "＋", text: "갭", color: "#C94B6E", bg: "#FDF0F3", border: "#F2C4CE" },
}

export function PatchNotesDemo() {
  const [compared, setCompared] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      {/* ── MCP 연결 — 섹션 최상단 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 items-center">
        <McpTerminal />
        <p className="text-[11.5px] text-text-secondary leading-relaxed">
          비교 대상이 되는 "내 에이전트"에 Cherry가 연결되는 방식 — 연결된 순간 지식 비교가 가능해진다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* 주간 체인지로그 */}
      <DemoFrame label="패치노트 — 주간 체인지로그">
        <div className="relative">
          <div className="absolute left-[4px] top-2 bottom-2 w-px" style={{ backgroundColor: "#E4E1EE" }} />
          {PATCH_ITEMS.map((item) => (
            <div key={item.id} className="relative pl-6 pb-4">
              <span
                className="absolute left-0 top-[7px] w-[10px] h-[10px] rounded-full border-2 border-card"
                style={{ backgroundColor: item.dotColor }}
              />
              <div className="text-[11px] text-text-muted mb-1">
                {item.date} · {item.area}
              </div>
              <p className="text-[13px] font-bold text-[#1A1626] leading-snug mb-0.5">{item.title}</p>
              <p className="text-[11.5px] text-text-muted mb-1.5">{item.oneLiner}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "#C94B6E" }} aria-label={`5점 만점에 ${item.score}점`}>
                  {"★".repeat(item.score)}
                  <span style={{ opacity: 0.25 }}>{"★".repeat(5 - item.score)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </DemoFrame>

      {/* 지식 비교 */}
      <div className="flex flex-col gap-4">
        <DemoFrame label="지식 비교 — 내 에이전트 vs 마켓">
          <button
            onClick={() => setCompared(true)}
            className="w-full rounded-[10px] text-white text-[12.5px] font-bold py-2.5 transition-all cursor-pointer"
            style={{ backgroundColor: "var(--cherry)" }}
          >
            {compared ? "↻ 비교 중…" : "▶ 내 에이전트 지식 비교하기"}
          </button>

          <div className="flex flex-col gap-2 mt-3.5">
            {COMPARE_ROWS.map((row, i) => {
              const revealed = compared || i < 2
              const st = COMPARE_STYLE[row.status]
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-all duration-500"
                  style={{
                    borderColor: revealed ? st.border : "#E4E1EE",
                    backgroundColor: revealed ? st.bg : "#FFF",
                    opacity: revealed ? 1 : 0.45,
                  }}
                >
                  <span className="text-[12.5px] font-semibold text-text-primary flex-1 truncate">{row.title}</span>
                  <span className="text-[10px] text-text-muted hidden sm:block">{row.note}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                    style={{ color: st.color }}
                  >
                    {revealed ? `${st.icon} ${st.text}` : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </DemoFrame>

        <div className="rounded-[12px] p-4 border" style={{ backgroundColor: "#FDF0F3", borderColor: "#F2C4CE" }}>
          <p className="text-[12px] leading-relaxed" style={{ color: "#3D3652" }}>
            <strong style={{ color: "var(--cherry)" }}>루프:</strong> 패치노트는{" "}
            <em>무엇이 바뀌었는지</em>, 비교는 <em>내 에이전트에게 무엇이 빠졌는지</em> 알려준다.
            갭·구버전 페이지는 마켓으로 바로 연결 — 한 번 구매하면 스킬이 갱신된다.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
