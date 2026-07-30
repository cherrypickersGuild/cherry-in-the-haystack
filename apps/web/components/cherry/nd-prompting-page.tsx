"use client"

import { LandscapeSection, RisingStar } from "./nd-landscape"

/**
 * Prompting Best 페이지
 *
 * 빌딩블락스의 prompt·skill 계열을 8개 테마로 묶어 각 top5.
 *   공용 <LandscapeSection pageKey="prompting">.
 *   자동 생성: apps/api/scripts/generate-frameworks-landscape.cjs (PAGES.prompting)
 *   기획서: apps/docs/frameworks-landscape-admin-curation-plan.md
 */
export function NDPromptingPage() {
  return (
    <div className="max-w-[1160px]">
      <div className="max-w-[940px]">
        <h1 className="m-0 mb-[4px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">
          Prompting Best
        </h1>
        <p className="mb-[30px] text-[13.5px] text-[#9E97B3]">
          The best prompting techniques, guides, skills, and datasets — grouped by theme.
        </p>
      </div>

      <div className="mb-4 mt-[36px] flex items-baseline gap-[10px]">
        <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">Landscape</h2>
        <span className="text-[12.5px] text-[#9E97B3]">
          Prompting &amp; skills across the ecosystem — click a theme for details
        </span>
      </div>
      <LandscapeSection pageKey="prompting" />

      <div className="max-w-[940px]">
        {/* Rising Star — 스타 최다(초기 시딩) */}
        <div className="mb-4 mt-[52px] flex items-baseline gap-[10px]">
          <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">Rising Star</h2>
          <span className="text-[12.5px] text-[#9E97B3]">Most starred right now</span>
        </div>
        <RisingStar pageKey="prompting" />
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
