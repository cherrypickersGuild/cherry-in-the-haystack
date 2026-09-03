"use client"

/**
 * 섹션 1 — 데이터 소스.
 * 좌: 실제 구독 중인 정보원을 카테고리별 태그로 보여준다 (클릭 → 상세).
 * 우: 선택된 카테고리의 가치 설명 + 대표 계정 리스트.
 */

import { useState } from "react"
import { SOURCE_GROUPS, TOTAL_EXTERNAL } from "./sources-data"
import { DemoFrame, FONT_ROUNDED } from "./shared"

export function DataSourcesDemo() {
  const [active, setActive] = useState("twitter")
  const group = SOURCE_GROUPS.find((g) => g.key === active)!
  const externals = SOURCE_GROUPS.filter((g) => g.key !== "notion" && g.key !== "dashboard")

  return (
    <div className="flex flex-col gap-5">
      {/* ── 상단: 카테고리 태그 벽 ── */}
      <DemoFrame label={`구독 중인 정보원 — 총 ${TOTAL_EXTERNAL}곳`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {externals.map((g) => {
            const isActive = active === g.key
            return (
              <button
                key={g.key}
                onClick={() => setActive(g.key)}
                className="rounded-full border px-3 py-1.5 text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive ? g.soft : "#FFFFFF",
                  borderColor: isActive ? g.color : "#E4E1EE",
                }}
              >
                <span className="text-[12px] font-bold" style={{ color: isActive ? g.color : "#3D3652" }}>
                  {g.emoji} {g.name}
                </span>
                <span
                  className="ml-2 text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: isActive ? g.color : "#F2F0F7",
                    color: isActive ? "#FFF" : "#9E97B3",
                  }}
                >
                  {g.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* 흐름: 외부 → 내부 레이어 */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div
            className="flex-1 rounded-[10px] border px-3.5 py-3"
            style={{ borderColor: "#C7B8E8", backgroundColor: "#F9F7FD" }}
          >
            <p className="text-[11px] font-bold mb-1" style={{ color: "#7B5EA7" }}>외부 소스</p>
            <p className="text-[10.5px] text-text-secondary leading-relaxed">
              {externals.map((g) => g.name).join(" · ")}
            </p>
          </div>
          <div className="flex sm:flex-col items-center justify-center px-2" aria-hidden>
            <span className="text-[16px]" style={{ color: "#C7B8E8" }}>→</span>
          </div>
          <div
            className="flex-1 rounded-[10px] border px-3.5 py-3"
            style={{ borderColor: "#E4E1EE", backgroundColor: "#FFFFFF" }}
          >
            <p className="text-[11px] font-bold mb-1 text-text-primary">수집 파이프라인</p>
            <p className="text-[10.5px] text-text-secondary leading-relaxed">
              크롤링 · 중복 제거 · AI 스코어링(1–5) · 태깅(17개)
            </p>
          </div>
          <div className="flex sm:flex-col items-center justify-center px-2" aria-hidden>
            <span className="text-[16px]" style={{ color: "#C7B8E8" }}>→</span>
          </div>
          <div
            className="flex-1 rounded-[10px] border px-3.5 py-3"
            style={{ borderColor: "#F2C4CE", backgroundColor: "#FDF0F3" }}
          >
            <p className="text-[11px] font-bold mb-1" style={{ color: "var(--cherry)" }}>🍒 Cherry 페이지</p>
            <p className="text-[10.5px] text-text-secondary leading-relaxed">
              컨셉트 리더 · 패치노트 · Newly Discovered — 사용자가 보는 것
            </p>
          </div>
        </div>
      </DemoFrame>

      {/* ── 하단: 선택 카테고리 상세 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* 대표 계정 리스트 */}
        <DemoFrame label={`${group.emoji} ${group.name} — 대표 소스`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {group.representatives.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 rounded-[10px] border px-3 py-2"
                style={{ borderColor: "#EDEBF2", backgroundColor: "#FFFFFF" }}
              >
                <span
                  className="w-6 h-6 rounded-[8px] flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                  style={{ backgroundColor: group.soft, color: group.color }}
                >
                  {r.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-text-primary truncate">{r.name}</p>
                  {r.sub && <p className="text-[10px] text-text-muted truncate">{r.sub}</p>}
                </div>
              </div>
            ))}
          </div>
          {group.count > group.representatives.length && (
            <p className="text-[11px] text-text-muted mt-3">
              + {group.count - group.representatives.length}곳 더 구독 중 — 전체 목록은 Notion 소스 DB에서 관리
            </p>
          )}
        </DemoFrame>

        {/* 가치 설명 */}
        <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: "#E4E1EE" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
            왜 이 소스인가
          </p>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px]"
              style={{ backgroundColor: group.soft }}
            >
              {group.emoji}
            </span>
            <div>
              <p className="text-[14px] font-bold text-text-primary">{group.name}</p>
              <p className="text-[10px] font-semibold" style={{ color: group.color }}>
                {group.nature} · {group.count > 0 ? `${group.count}곳 구독` : "내부 레이어"}
              </p>
            </div>
          </div>
          <p className="text-[12.5px] text-text-body leading-relaxed">{group.value}</p>
        </div>
      </div>
    </div>
  )
}
