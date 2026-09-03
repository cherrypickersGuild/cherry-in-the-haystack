"use client"

/**
 * 섹션 4 — 빌딩 블록 (MCP · Agent · Prompt).
 * 좌: 5단계 어셈블리 플로우 + mcp add cherry-mcp 터미널.
 * 우: 실제 워크샵 인벤토리 + 커스텀 도메인 스킬 예시.
 */

import { useState } from "react"
import { JigsawConnector, type JigsawType } from "@/components/cherry/jigsaw-connector"
import { mockInventory } from "@/lib/workshop-mock"
import { DemoFrame, McpTerminal } from "./shared"

const TYPE_THEME: Record<string, { bg: string; border: string; text: string; label: string }> = {
  prompt:        { bg: "#F5EDE1", border: "#C9A24A", text: "#8B6C2A", label: "PROMPT" },
  mcp:           { bg: "#E3F2EC", border: "#2A5C3E", text: "#1F4430", label: "MCP" },
  skill:         { bg: "#FBF6EC", border: "#C8301E", text: "#8F1D12", label: "SKILL" },
  orchestration: { bg: "#EEF0F7", border: "#4A5FA0", text: "#2D3B66", label: "ORCH" },
  memory:        { bg: "#EDE5F5", border: "#7B5EA7", text: "#5E3A8A", label: "MEM" },
}

/** 어셈블리 플로우의 슬롯 행 — 실제 워크샵 카드처럼 지그재그 탭 부착 */
function BlockSlot({
  step,
  title,
  desc,
  type,
}: {
  step: number
  title: string
  desc: string
  type: JigsawType
}) {
  const theme = TYPE_THEME[type]
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-col items-center pt-3">
        <span
          className="w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
          style={{ backgroundColor: theme.border }}
        >
          {step}
        </span>
      </div>
      <div
        className="relative flex-1 rounded-[12px] border p-3.5 pl-5"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <div className="absolute" style={{ left: 0, top: "50%", transform: "translate(-50%, -50%)" }}>
          <JigsawConnector type={type} mode="tab" size={18} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-extrabold tracking-[0.12em]" style={{ color: theme.text }}>
            {theme.label}
          </span>
          <span className="text-[13px] font-bold text-text-primary">{title}</span>
        </div>
        <p className="text-[11.5px] text-text-body leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/** 도메인 스킬 예시 — "책이 스킬이 된다"를 보여주는 추가 카드 */
const DOMAIN_SKILLS = [
  {
    id: "ds-1",
    title: "Landing Page for Japan Market",
    type: "skill" as JigsawType,
    summary: "일본 시장 진출용 랜딩페이지 제작 — 현지 문화 코드, 신뢰 마커, CAC 관점의 카피/구조 패턴.",
  },
  {
    id: "ds-2",
    title: "Selling Tech Products — Consultative Sales",
    type: "skill" as JigsawType,
    summary: "컨설팅 세일스 방법론 — 질문 설계, 페인포인트 진단, 가치 정량화, 이해관계자별 대응 스크립트.",
  },
  {
    id: "ds-3",
    title: "Portfolio Management — Charlie Munger Principles",
    type: "skill" as JigsawType,
    summary: "멍거 원칙 기반 포트폴리오 관리 — 역량 서클, 안전마진, 집중투자 vs 분산의 판단 프레임.",
  },
]

export function BuildingBlocksDemo() {
  const [filter, setFilter] = useState<string>("all")
  const items = mockInventory.filter((i) => filter === "all" || i.type === filter)

  return (
    <div className="flex flex-col gap-5">
      {/* ── MCP 연결 — 섹션 최상단 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 items-center">
        <McpTerminal />
        <p className="text-[11.5px] text-text-secondary leading-relaxed">
          한 줄이면 끝 — 어떤 MCP 호환 에이전트(Claude Code 등)든 Cherry 지식 계층에 붙는다.
          빌딩 블록을 슬롯에 끼워 넣듯, 에이전트도 Cherry에 끼워 넣는다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
      {/* 어셈블리 플로우 */}
      <div className="flex flex-col gap-4">
        <DemoFrame label="에이전트 어셈블리 — 블록이 조립된다">
          <div className="flex flex-col gap-2.5">
            <BlockSlot
              step={1}
              type="prompt"
              title="System Prompt"
              desc="에이전트의 역할과 규율을 정의 — 예: “Policy Expert: 검색된 Cherry 문서만으로 답하고, 문서 ID를 인용.”"
            />
            <BlockSlot
              step={2}
              type="mcp"
              title="MCP Tools"
              desc="에이전트가 실제로 호출하는 도구 — search_catalog(query), get_crypto_price(symbol). cherry-mcp가 이 자리에 연결된다."
            />
            <BlockSlot
              step={3}
              type="skill"
              title="Skills ×3"
              desc="도메인 지식 블록: Citation Discipline, Multi-hop Retrieval, Abstention. 큐레이팅된 책이 스킬로 들어가는 자리."
            />
            <BlockSlot
              step={4}
              type="orchestration"
              title="Orchestration"
              desc="루프 패턴: ReAct / Plan-and-Execute / CodeAct — 생각과 도구 호출을 어떤 순서로 엮을지."
            />
            <BlockSlot
              step={5}
              type="memory"
              title="Memory"
              desc="기억 정책 — 무상태, 세션 내 단기, 도구 결과 유지 중 선택."
            />
          </div>
        </DemoFrame>
      </div>

      {/* 인벤토리 */}
      <DemoFrame label={`인벤토리 — 실제 ${mockInventory.length}개 + 도메인 스킬`}>
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {[
            { k: "all", l: "전체" },
            { k: "prompt", l: "Prompt" },
            { k: "mcp", l: "MCP" },
            { k: "skill", l: "Skill" },
            { k: "orchestration", l: "Orchestration" },
            { k: "memory", l: "Memory" },
          ].map((f) => {
            const isActive = filter === f.k
            return (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive ? "var(--cherry-soft)" : "#FFF",
                  color: isActive ? "var(--cherry)" : "#9E97B3",
                  borderColor: isActive ? "var(--cherry-border)" : "#E4E1EE",
                }}
              >
                {f.l}
              </button>
            )
          })}
        </div>

        {/* 도메인 스킬 — 항상 표시 */}
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2">
          도메인 스킬 — 책에서 뽑은 실전 지식
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {DOMAIN_SKILLS.map((item) => {
            const theme = TYPE_THEME[item.type]
            return (
              <div
                key={item.id}
                className="relative rounded-[10px] border p-3 pl-4"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                <div className="absolute" style={{ left: 0, top: "50%", transform: "translate(-50%, -50%)" }}>
                  <JigsawConnector type={item.type} mode="tab" size={16} />
                </div>
                <span className="text-[9px] font-extrabold tracking-[0.12em] block mb-1" style={{ color: theme.text }}>
                  {theme.label}
                </span>
                <p className="text-[12px] font-bold text-text-primary leading-snug mb-1">{item.title}</p>
                <p className="text-[10.5px] text-text-secondary leading-relaxed">{item.summary}</p>
              </div>
            )
          })}
        </div>

        {/* 실제 워크샵 인벤토리 */}
        {(filter === "all" || filter === "skill") && (
          <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2">
            워크샵 컴포넌트 — 실제 서버에 등록된 것들
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {items.map((item) => {
            const theme = TYPE_THEME[item.type]
            return (
              <div
                key={item.id}
                className="relative rounded-[10px] border p-3 pl-4"
                style={{ backgroundColor: "#FFF", borderColor: "#E4E1EE" }}
              >
                <div className="absolute" style={{ left: 0, top: "50%", transform: "translate(-50%, -50%)" }}>
                  <JigsawConnector type={item.type as JigsawType} mode="tab" size={16} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-extrabold tracking-[0.12em]" style={{ color: theme.text }}>
                    {theme.label}
                  </span>
                  <span className="text-[9px] text-text-muted">{item.category}</span>
                </div>
                <p className="text-[12px] font-bold text-text-primary leading-snug mb-1">{item.title}</p>
                <p className="text-[10.5px] text-text-muted leading-relaxed">{item.summary}</p>
              </div>
            )
          })}
        </div>
      </DemoFrame>
      </div>
    </div>
  )
}
