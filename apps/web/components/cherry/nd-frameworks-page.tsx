"use client"

import { LandscapeSection, RisingStar } from "./nd-landscape"

/**
 * Frameworks Best 페이지
 *
 * 구성:
 *  ① Rising Star — 스타 최다(초기 시딩). 맨 위.
 *  ② Landscape   — 공용 <LandscapeSection pageKey="frameworks">. 빌딩블락스 자동 생성(8타입×top5).
 *
 * ※ Recent Updates(실제 DB 기사)는 JSON 구동이 아니라서 일단 숨김. JSON 기사형으로 전환 시 복원.
 */

/* ── 섹션 헤더 ── */
function SectionHead({ title, desc, first }: { title: string; desc: string; first?: boolean }) {
  return (
    <div className="mb-4 flex items-baseline gap-[10px]" style={{ marginTop: first ? 36 : 52 }}>
      <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{title}</h2>
      <span className="text-[12.5px] text-[#9E97B3]">{desc}</span>
    </div>
  )
}

export function NDFrameworksPage() {
  return (
    // Landscape는 최대 1160px까지 넓혀 화면 폭에 따라 1~4단. 나머지는 940px 읽기 폭.
    <div className="max-w-[1160px]">
      <div className="max-w-[940px]">
        <h1 className="m-0 mb-[4px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">
          Frameworks Best
        </h1>
        <p className="mb-[30px] text-[13.5px] text-[#9E97B3]">
          The best frameworks and SDKs in each category — plus what&apos;s gaining momentum this cycle.
        </p>
      </div>

      {/* ① Rising Star — 맨 위 */}
      <div className="max-w-[940px]">
        <SectionHead first title="Rising Star" desc="Most starred right now" />
        <RisingStar pageKey="frameworks" />
      </div>

      {/* ② Landscape (공용 컴포넌트) */}
      <SectionHead title="Landscape" desc="Frameworks and SDKs across the ecosystem" />
      <LandscapeSection pageKey="frameworks" />

      <div className="h-8" aria-hidden />
    </div>
  )
}
