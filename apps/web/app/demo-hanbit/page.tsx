"use client"

/**
 * /demo-hanbit — 클라이언트 데모 원페이저 (한국어).
 *
 * 뒤에서 벌어지는 일을 순서대로 보여준다:
 *   1. 데이터 소스      — 실제 구독 중인 정보원 (Notion 소스 DB 실데이터 기반)
 *   2. 디스커버리 엔진  — 새 소스 자동 발굴
 *   3. 학습 목표        — 팀 엑셀 → 컨셉트 리더 페이지 전체
 *   4. 빌딩 블록        — MCP / Agent / Prompt (+ mcp add cherry-mcp)
 *   5. 콘텐츠 분석      — 키워드 빈도, 트렌드 발생지
 *   6. 패치노트 & 지식 비교 (+ mcp add cherry-mcp)
 *   7. 지식 마켓        — 책을 스킬로 판매 (+ mcp add cherry-mcp)
 *
 * 실제 앱 컴포넌트/토큰을 재사용하고, 데이터는 백엔드 없이
 * 동작하도록 데모 정적값으로 둔다.
 */

import { CherryIcon } from "@/components/cherry/sidebar"
import { FONT_ROUNDED } from "@/components/demo-hanbit/shared"
import { DataSourcesDemo } from "@/components/demo-hanbit/section-sources"
import { DiscoveryEngineDemo } from "@/components/demo-hanbit/section-discovery"
import { LearningObjectivesDemo } from "@/components/demo-hanbit/section-objectives"
import { BuildingBlocksDemo } from "@/components/demo-hanbit/section-blocks"
import { ContentAnalysisDemo } from "@/components/demo-hanbit/section-analysis"
import { PatchNotesDemo } from "@/components/demo-hanbit/section-patchnotes"
import { KnowledgeMarketDemo } from "@/components/demo-hanbit/section-market"

const SECTIONS = [
  { id: "sources", label: "데이터 소스" },
  { id: "discovery", label: "디스커버리 엔진" },
  { id: "objectives", label: "학습 목표" },
  { id: "blocks", label: "빌딩 블록" },
  { id: "analysis", label: "콘텐츠 분석" },
  { id: "patchnotes", label: "패치노트 & 비교" },
  { id: "market", label: "지식 마켓" },
]

export default function DemoLandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F6F9" }}>
      {/* ── 상단 바 ── */}
      <header
        className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur"
        style={{ borderColor: "#E4E1EE" }}
      >
        <div className="max-w-[1080px] mx-auto px-4 lg:px-6 h-14 flex items-center gap-3">
          <CherryIcon className="!w-7 !h-7" />
          <div className="leading-tight">
            <span className="text-[15px] font-bold text-text-primary tracking-tight">Cherry</span>
            <span className="text-[10px] text-text-muted font-medium ml-2">
              Client Demo
            </span>
          </div>
          <nav className="ml-auto hidden lg:flex items-center gap-1">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-[11px] font-semibold px-2 py-1 rounded-[6px] transition-colors hover:bg-[#F2F0F7]"
                style={{ color: "#6B6480" }}
              >
                {i + 1}. {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-4 lg:px-6 pb-24">
        {/* ── 히어로 ── */}
        <section className="pt-14 pb-10 text-center">
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-5"
            style={{ backgroundColor: "#FDF0F3" }}
          >
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--cherry)" }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--cherry)" }}>
              Live Workthrough
            </span>
          </div>
          <h1
            className="text-[30px] lg:text-[42px] font-extrabold text-text-primary tracking-[-1px] leading-[1.12] mb-4 max-w-[760px] mx-auto"
            style={{ fontFamily: FONT_ROUNDED }}
          >
            Raw Data Source에서 <span style={{ color: "var(--cherry)" }}>팔 수 있는 스킬</span>로 바꾸기까지의 흐름
          </h1>
          <p className="text-[14px] lg:text-[15px] text-text-secondary leading-relaxed max-w-[620px] mx-auto">
            수많은 데이터 소스로부터 지식이 흘러들어와, 컨셉트와 컴포넌트로
            구조화되고, 스스로 최신을 유지하다가 — 에이전트가 사서 쓰는 지식이 됩니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
            {SECTIONS.map((s, i) => (
              <span
                key={s.id}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full border"
                style={{ color: "#6B6480", borderColor: "#E4E1EE", backgroundColor: "#FFFFFF" }}
              >
                {i + 1} · {s.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── 1. 데이터 소스 ── */}
        <section id="sources" className="pt-10 pb-14 scroll-mt-20">
          <Section1Header />
          <DataSourcesDemo />
        </section>

        {/* ── 2. 디스커버리 엔진 ── */}
        <section id="discovery" className="pb-14 scroll-mt-20">
          <Section2Header />
          <DiscoveryEngineDemo />
        </section>

        {/* ── 3. 학습 목표 ── */}
        <section id="objectives" className="pb-14 scroll-mt-20">
          <Section3Header />
          <LearningObjectivesDemo />
        </section>

        {/* ── 4. 빌딩 블록 ── */}
        <section id="blocks" className="pb-14 scroll-mt-20">
          <Section4Header />
          <BuildingBlocksDemo />
        </section>

        {/* ── 5. 콘텐츠 분석 ── */}
        <section id="analysis" className="pb-14 scroll-mt-20">
          <Section5Header />
          <ContentAnalysisDemo />
        </section>

        {/* ── 6. 패치노트 & 지식 비교 ── */}
        <section id="patchnotes" className="pb-14 scroll-mt-20">
          <Section6Header />
          <PatchNotesDemo />
        </section>

        {/* ── 7. 지식 마켓 ── */}
        <section id="market" className="pb-6 scroll-mt-20">
          <Section7Header />
          <KnowledgeMarketDemo />
        </section>

        {/* ── 푸터 ── */}
        <footer className="pt-10 border-t text-center" style={{ borderColor: "#E4E1EE" }}>
          <p className="text-[12px] text-text-muted">
            🍒 Cherry in the Haystack - AI 활용을 위한 종합 지식 플랫폼 
          </p>
        </footer>
      </main>
    </div>
  )
}

/* 섹션 헤더들 — 페이지 파일을 가볍게 유지하려고 여기에 둠 */

import { SectionHeader } from "@/components/demo-hanbit/shared"

function Section1Header() {
  return (
    <SectionHeader
      step={1}
      kicker="입력"
      title="데이터 소스"
      desc="AI를 다루는 모든 저명 인사와 대중의 리액션을 수집하고, 그들의 주장을 분석하게 만드는 것이 목표입니다"
    />
  )
}

function Section2Header() {
  return (
    <SectionHeader
      step={2}
      kicker="자동화"
      title="디스커버리 엔진 —"
      desc="디스커버리 에이전트가 유망한 소스를 매일 찾고, 승인된 소스는 소스 DB로 즉시 동기화되어 파이프라인에 들어갑니다."
    />
  )
}

function Section3Header() {
  return (
    <SectionHeader
      step={3}
      kicker="커리큘럼"
      title="'학습 목표'로 변환 "
      desc="매일 새로 등장하는 개념과 방법론을 수집해, 내가 무엇을 놓쳤는지 알 수 있게 됩니다."
    />
  )
}

function Section4Header() {
  return (
    <SectionHeader
      step={4}
      kicker="컴포넌트"
      title="빌딩 블록 — 프롬프트, MCP 도구, 스킬"
      desc="큐레이팅된 모든 것은 조립 가능한 블록으로 저장됩니다: 시스템 프롬프트, MCP 도구 커넥터, 지식 스킬, 오케스트레이션 패턴, 메모리 정책. mcp add cherry-mcp 한 줄로 어떤 에이전트에도 꽂힙니다."
    />
  )
}

function Section5Header() {
  return (
    <SectionHeader
      step={5}
      kicker="신호"
      title="콘텐츠 분석 — 이 바닥 돌아가는 것 한 눈에 보기"
      desc="수집된 아티클을 통해 자연어 분석을 진행해요"
    />
  )
}

function Section6Header() {
  return (
    <SectionHeader
      step={6}
      kicker="최신 유지"
      title="패치노트 & 지식 비교"
      desc="내가 놓친 소식이 무엇일까? 개인화된 정보 모음입니다."
    />
  )
}

function Section7Header() {
  return (
    <SectionHeader
      step={7}
      kicker="출력"
      title="지식 마켓 — 책이 스킬이 됩니다"
      desc="퍼널의 끝: 큐레이팅된 책 지식이 에이전트가 사서 설치하는 스킬로 패키징됩니다. 모든 스킬은 출처를 표시합니다. 계약한 크리에이터에게 수익을 분배합니다. "
    />
  )
}
