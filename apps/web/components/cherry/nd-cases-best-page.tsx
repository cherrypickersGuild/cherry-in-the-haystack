"use client"

import { LandscapeSection, RisingStar } from "./nd-landscape"
import { CasesArticleList } from "./nd-cases-articles-page"

/**
 * Cases 혼합(mixed) 분류 페이지 — 한 페이지에 두 섹션으로 분리:
 *   ① 도메인형 랜드스케이프 (kind === "domain"): 8 도메인 카드 × 베스트 5 + 카드 클릭 → 모달
 *      데이터: GET /api/<category>/landscape (생성: generate-cases-landscape.cjs, kind=domain만)
 *   ② 기사형 목록 (kind === "article"): pill 탭 + 세로 목록 (CasesArticleList 재사용)
 * domain-applications / product-discovery 처럼 기사와 도메인이 섞인 분류에 쓴다.
 * (case-studies는 기사 단일이라 NDCasesListPage.)
 */
const TITLES: Record<string, { title: string; sub: string; domainLabel: string }> = {
  "domain-applications": {
    title: "Domain Applications",
    sub: "AI applied across domains — products by domain, plus related articles.",
    domainLabel: "Applications",
  },
  "product-discovery": {
    title: "Product Discovery",
    sub: "AI products solving real-life problems — products by area, plus related articles.",
    domainLabel: "Products",
  },
}

export function NDCasesBestPage({ category }: { category: string }) {
  const t = TITLES[category] ?? { title: "Cases", sub: "", domainLabel: "Domains" }
  return (
    <div className="max-w-[1160px]">
      <div className="max-w-[940px]">
        <h1 className="m-0 mb-[4px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">{t.title}</h1>
        <p className="mb-[30px] text-[13.5px] text-[#9E97B3]">{t.sub}</p>
      </div>

      {/* ① Rising Star — 맨 위 (Frameworks Best와 동일 양식). 도메인형이라 stars 없으면 대표 1개 featured. */}
      <div className="max-w-[940px]">
        <div className="mb-4 mt-[28px] flex items-baseline gap-[10px]">
          <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">Rising Star</h2>
          <span className="text-[12.5px] text-[#9E97B3]">One to watch right now</span>
        </div>
        <RisingStar pageKey={category} />
      </div>

      {/* ② 도메인형 — 랜드스케이프 (kind=domain) */}
      <div className="mb-4 mt-[52px] flex items-baseline gap-[10px]">
        <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{t.domainLabel}</h2>
        <span className="text-[12.5px] text-[#9E97B3]">Top domains × best 5 · click a card for details</span>
      </div>
      <LandscapeSection pageKey={category} />

      {/* ② 기사형 — 관련 기사 목록 (kind=article) */}
      <div className="mt-[52px] max-w-[940px]">
        <CasesArticleList page={category} kind="article" sectionTitle="Related Articles" />
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
