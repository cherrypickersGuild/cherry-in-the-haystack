"use client"

/**
 * 섹션 2 — 디스커버리 엔진.
 * 실제 source_discovery 워크플로(발굴 → 스테이징 → 사람 리뷰 → 소스 DB 동기화) 재현.
 * "스윕 실행" 버튼 → 후보 등장 → 적합도 스코어 → 승인/거절.
 */

import { useEffect, useRef, useState } from "react"
import { DemoFrame } from "./shared"

type Candidate = {
  id: string
  name: string
  kind: string
  signals: string[]
  score: number
  status: "staged" | "approved" | "rejected"
}

const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "AI Engineer Works",
    kind: "Substack",
    signals: ["승인 소스 3곳에서 인용됨", "AI 엔지니어 구독자 12%", "주간 발행"],
    score: 92,
    status: "staged",
  },
  {
    id: "c2",
    name: "Frontier Model Watch",
    kind: "Twitter 리스트",
    signals: ["뉴스레터 평균 1.4일 먼저 모델 뉴스", "스팸 적음"],
    score: 87,
    status: "staged",
  },
  {
    id: "c3",
    name: "LLM Systems Podcast",
    kind: "YouTube",
    signals: ["게스트가 온톨로지 컨셉트와 겹침", " transcript 추출 가능"],
    score: 74,
    status: "staged",
  },
  {
    id: "c4",
    name: "Crypto AI Alpha",
    kind: "Substack",
    signals: ["주제 이탈: 60%가 코인 이야기", "기존 소스와 중복"],
    score: 31,
    status: "staged",
  },
]

const DISCOVERY_STAGES = ["발굴", "스테이징", "사람 리뷰", "소스 DB 동기화"]

export function DiscoveryEngineDemo() {
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const runSweep = () => {
    if (running) return
    setRunning(true)
    setStage(0)
    setCandidates(INITIAL_CANDIDATES.map((c) => ({ ...c, status: "staged" as const })))
    timers.current.forEach(clearTimeout)
    timers.current = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1200),
    ]
    setTimeout(() => setRunning(false), 1400)
  }

  const setStatus = (id: string, status: Candidate["status"]) =>
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)))

  const counts = {
    approved: candidates.filter((c) => c.status === "approved").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
    staged: candidates.filter((c) => c.status === "staged").length,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
      {/* 파이프라인 */}
      <div className="flex flex-col gap-3">
        <DemoFrame label="source_discovery 에이전트">
          <div className="flex flex-col gap-0 mb-4">
            {DISCOVERY_STAGES.map((s, i) => {
              const reached = stage >= i
              return (
                <div key={s} className="flex items-center gap-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-300"
                      style={{
                        backgroundColor: reached ? "var(--cherry)" : "#FFFFFF",
                        borderColor: reached ? "var(--cherry)" : "#E4E1EE",
                      }}
                    >
                      {reached && (
                        <svg width="9" height="9" viewBox="0 0 10 10">
                          <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    {i < DISCOVERY_STAGES.length - 1 && (
                      <span
                        className="w-px transition-all duration-300"
                        style={{ height: 22, backgroundColor: stage > i ? "var(--cherry)" : "#E4E1EE" }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[12px] font-semibold transition-colors"
                    style={{ color: reached ? "var(--cherry)" : "#9E97B3" }}
                  >
                    {s}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={runSweep}
            disabled={running}
            className="w-full rounded-[10px] text-white text-[12.5px] font-bold py-2.5 transition-all cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: "var(--cherry)" }}
          >
            {running ? "스윕 중…" : "▶ 디스커버리 스윕 실행"}
          </button>

          <div className="flex items-center justify-between mt-4 text-[11px]">
            <span className="text-[#2D7A5E] font-bold">✓ {counts.approved} 승인</span>
            <span className="text-text-muted font-semibold">{counts.staged} 대기</span>
            <span className="text-[#C94B6E] font-bold">✕ {counts.rejected} 거절</span>
          </div>
        </DemoFrame>
      </div>

      {/* 후보 리스트 */}
      <DemoFrame label="후보 — 사람이 최종 결정">
        <div className="flex flex-col gap-2.5">
          {candidates.map((c) => {
            const scored = stage >= 2
            return (
              <div
                key={c.id}
                className="rounded-[12px] border p-3.5 transition-all duration-300"
                style={{
                  borderColor:
                    c.status === "approved" ? "#A8D4C0"
                    : c.status === "rejected" ? "#F2C4CE"
                    : "#E4E1EE",
                  backgroundColor:
                    c.status === "approved" ? "#EFF7F3"
                    : c.status === "rejected" ? "#FDF0F3"
                    : "#FFFFFF",
                  opacity: stage === 0 ? 0.35 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold text-text-primary truncate">{c.name}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: "#F2F0F7", color: "#6B6480" }}
                    >
                      {c.kind}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-[64px] h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F2F0F7" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: scored ? `${c.score}%` : "0%",
                          backgroundColor:
                            c.score >= 70 ? "#2D7A5E" : c.score >= 50 ? "#D4854A" : "#C94B6E",
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-bold tabular-nums w-[24px] text-right"
                      style={{ color: scored ? "#3D3652" : "#D5D0E0" }}
                    >
                      {scored ? c.score : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {c.signals.map((sig) => (
                    <span
                      key={sig}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F9F7F5", color: "#6B6480" }}
                    >
                      {sig}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "staged" ? (
                    <>
                      <button
                        onClick={() => setStatus(c.id, "approved")}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-[8px] border transition-all cursor-pointer"
                        style={{ backgroundColor: "#2D7A5E", borderColor: "#2D7A5E", color: "#FFF" }}
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setStatus(c.id, "rejected")}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-[8px] border transition-all cursor-pointer"
                        style={{ backgroundColor: "#FFF", borderColor: "#E4E1EE", color: "#6B6480" }}
                      >
                        거절
                      </button>
                    </>
                  ) : (
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: c.status === "approved" ? "#2D7A5E" : "#C94B6E" }}
                    >
                      {c.status === "approved" ? "✓ 승인 — 소스 DB에 동기화됨" : "✕ 거절됨"}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </DemoFrame>
    </div>
  )
}
