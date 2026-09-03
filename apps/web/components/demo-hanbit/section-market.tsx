"use client"

/**
 * 섹션 7 — 지식 마켓 (+ MCP 터미널).
 * 도메인 스킬(책→스킬) 카드 3종 + mcp add cherry-mcp.
 * 구매 → 설치 시뮬레이션 → "에이전트에 설치됨".
 */

import { useState } from "react"
import { JigsawConnector } from "@/components/cherry/jigsaw-connector"
import { DemoFrame, McpTerminal, Stars } from "./shared"

const MARKET_ITEMS = [
  {
    id: "m1",
    title: "Landing Page for Japan Market",
    category: "Domain Skill",
    score: 4.8,
    sources: 9,
    book: "일본 시장 진출 플레이북 — 내부 큐레이션",
    detail: "문화 코드 · 신뢰 마커 · 카피 패턴 3장 분량",
    price: 20,
  },
  {
    id: "m2",
    title: "Consultative Sales for Tech Products",
    category: "Domain Skill",
    score: 4.7,
    sources: 12,
    book: "SPIN Selling + The Trusted Advisor",
    detail: "질문 설계 · 진단 · 가치 정량화 — 5장 분량",
    price: 25,
  },
  {
    id: "m3",
    title: "Portfolio Management — Munger Principles",
    category: "Domain Skill",
    score: 4.6,
    sources: 7,
    book: "가난한 찰리의 연감 (Poor Charlie's Almanack)",
    detail: "역량 서클 · 안전마진 · 집중투자 프레임 — 4장 분량",
    price: 15,
  },
]

export function KnowledgeMarketDemo() {
  const [bought, setBought] = useState<string[]>([])
  const [installing, setInstalling] = useState<string | null>(null)

  const buy = (id: string) => {
    if (bought.includes(id)) return
    setInstalling(id)
    setTimeout(() => {
      setBought((b) => [...b, id])
      setInstalling(null)
    }, 900)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── MCP 연결 — 섹션 최상단 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 items-center">
        <McpTerminal />
        <p className="text-[11.5px] text-text-secondary leading-relaxed">
          구매한 스킬은{" "}
          <code
            className="px-1.5 py-0.5 rounded text-[11px]"
            style={{ backgroundColor: "#F2F0F7", color: "#7B5EA7", fontFamily: 'var(--font-mono), monospace' }}
          >
            ~/.claude/skills/
          </code>{" "}
          로 설치된다 — cherry-mcp로 연결된 어떤 에이전트든 즉시 사용. 책 한 권을 읽을 시간으로,
          에이전트가 그 지식을 갖고 일한다.
        </p>
      </div>

      {/* 스킬 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MARKET_ITEMS.map((item) => {
          const isBought = bought.includes(item.id)
          const isInstalling = installing === item.id
          return (
            <div
              key={item.id}
              className="rounded-[12px] border bg-white overflow-hidden flex flex-col transition-all duration-300"
              style={{
                borderColor: isBought ? "#A8D4C0" : "#E4E1EE",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {/* 스킬 미리보기 — 미니 지그재그 카드 */}
              <div className="p-4 border-b relative" style={{ backgroundColor: "#FBF6EC", borderColor: "#F0E5D0" }}>
                <div className="absolute" style={{ left: 0, top: "50%", transform: "translate(-30%, -50%)" }}>
                  <JigsawConnector type="skill" mode="tab" size={18} />
                </div>
                <div className="pl-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stars score={item.score} />
                  </div>
                  <p className="text-[13.5px] font-bold text-text-primary leading-snug">{item.title}</p>
                  <p className="text-[10px] font-semibold mt-1" style={{ color: "#8F1D12" }}>
                    SKILL · {item.category}
                  </p>
                </div>
              </div>

              {/* 책 출처 */}
              <div className="p-4 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1.5">
                  이 책에서 증류됨
                </p>
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-[16px]">📖</span>
                  <div>
                    <p className="text-[11.5px] font-semibold text-text-primary leading-snug">{item.book}</p>
                    <p className="text-[10px] text-text-muted">{item.detail}</p>
                  </div>
                </div>
                <p className="text-[10.5px] text-text-muted">
                  <span className="font-semibold text-[#3D3652]">{item.sources}</span>개 증거 소스 ·
                  지식팀 검증
                </p>
              </div>

              {/* 구매 */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => buy(item.id)}
                  disabled={isBought || isInstalling}
                  className="w-full rounded-[10px] text-[12px] font-bold py-2.5 transition-all cursor-pointer disabled:cursor-default"
                  style={{
                    backgroundColor: isBought ? "#EFF7F3" : "var(--cherry)",
                    color: isBought ? "#2D7A5E" : "#FFF",
                    border: isBought ? "1px solid #A8D4C0" : "none",
                  }}
                >
                  {isBought
                    ? "✓ 에이전트에 설치됨"
                    : isInstalling
                      ? "스킬 설치 중…"
                      : `스킬 구매 · ${item.price} 크레딧`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
