"use client"

import { useEffect, useState } from "react"
import { fetchFrameworks, FrameworksArticleItem } from "@/lib/api"
import { LandscapeSection, RisingStar } from "./nd-landscape"

/**
 * Frameworks Best 페이지
 *
 * 구성(기획서: apps/docs/frameworks-landscape-admin-curation-plan.md)
 *  ① Landscape       — 공용 <LandscapeSection pageKey="frameworks">. 빌딩블락스 자동 생성(8타입×top5).
 *  ② Rising Star     — 정적 샘플. 추세 그래프 없음. 기획회의 전 임시 자리.
 *  ③ Recent Updates  — 실제 DB 기사(fetchFrameworks.articles). ai_score → ★ 별점.
 */

/* 기사 카테고리(표시명) → 점 색상 */
const ARTICLE_CAT_COLOR: Record<string, string> = {
  "Agent": "#E94057",
  "Fine-Tuning": "#8B5CF6",
  "RAG": "#7C3AED",
  "Prompt Engineering": "#DC2626",
  "Serving": "#10B981",
  "Data & Storage": "#F97316",
  "LLMOps": "#0194E2",
  "Observability": "#7B5EA7",
}
const articleDot = (name: string) => ARTICLE_CAT_COLOR[name] ?? "#9E97B3"

/* ── ③ Recent Updates 행 (실제 기사) ── */
function ArticleRow({ item }: { item: FrameworksArticleItem }) {
  const dot = articleDot(item.categoryName)
  const score = Math.max(0, Math.min(5, item.score))
  return (
    <div className="flex items-start gap-[14px] border-b py-[15px] last:border-b-0" style={{ borderColor: "#E4E1EE" }}>
      <span className="mt-[6px] block h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <p className="mb-[3px] text-[15px] font-bold leading-[1.35] text-[#1A1626]">{item.title}</p>
        {item.oneLiner && (
          <p
            className="mb-[7px] text-[12.5px] leading-[1.5] text-[#6E6A78]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {item.oneLiner}
          </p>
        )}
        <div className="flex items-center gap-[9px] text-[11px] text-[#9E97B3]">
          {item.categoryName && (
            <span className="font-bold" style={{ color: dot }}>
              {item.categoryName}
            </span>
          )}
          <span className="text-[11px] tracking-[1px] text-[#C7791B]">
            {"★".repeat(score)}
            <span className="text-[#D8D3E2]">{"★".repeat(5 - score)}</span>
          </span>
          <span>
            {item.entityName ? `${item.entityName} · ` : ""}
            {item.date}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── 섹션 헤더 ── */
function SectionHead({ title, desc, first }: { title: string; desc: string; first?: boolean }) {
  return (
    <div
      className="mb-4 flex items-baseline gap-[10px]"
      style={{ marginTop: first ? 36 : 52 }}
    >
      <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{title}</h2>
      <span className="text-[12.5px] text-[#9E97B3]">{desc}</span>
    </div>
  )
}

/* ── 페이지 ── */
export function NDFrameworksPage() {
  const [articles, setArticles] = useState<FrameworksArticleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFrameworks()
      .then((fw) => setArticles(fw.articles))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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

      {/* ① Landscape (공용 컴포넌트) */}
      <SectionHead first title="Landscape" desc="Frameworks and SDKs across the ecosystem" />
      <LandscapeSection pageKey="frameworks" />

      <div className="max-w-[940px]">
        {/* ② Rising Star — 스타 최다(초기 시딩) */}
        <SectionHead title="Rising Star" desc="Most starred right now" />
        <RisingStar pageKey="frameworks" />

        {/* ③ Recent Updates (real) */}
        <SectionHead title="Recent Updates" desc="Latest releases and articles" />
        {articles.length === 0 ? (
          <p className="text-[13px] text-[#9E97B3]">
            {loading ? "Loading…" : "No updates yet."}
          </p>
        ) : (
          <div className="flex flex-col">
            {articles.map((item) => (
              <ArticleRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <div className="h-8" aria-hidden />
    </div>
  )
}
