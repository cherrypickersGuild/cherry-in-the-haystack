"use client"

import { useEffect, useState } from "react"

/**
 * Building Blocks 페이지
 *
 * 분류: 서브카테고리(topic) → 카테고리(entity_type) → 엔티티 카드
 * 데이터: /building-blocks/entities.json (apps/docs/seed_data/entity_registry.json 에서 생성)
 * 아이콘: /building-blocks/icons/<slug>.png — 수집 시점에 내려받아 자체 서빙(외부 실시간 호출 없음)
 *
 * 목업: apps/docs/mockups/building-blocks-mockup.html
 */

/* ── 데이터 타입 (JSON 키가 짧은 건 payload 절약용) ── */
type Entity = {
  n: string      // name
  s: number | null // github stars
  v: string      // vendor
  u: string      // target url
  i: string      // icon slug
  d: string      // description
  vf: 0 | 1      // verified
}
type Group = { t: string; c: number; items: Entity[] }
type Topic = { k: string; l: string; total: number; groups: Group[] }
type Payload = { total: number; topics: Topic[] }

/* ── 카테고리(entity_type) 표시 정보 ── */
const TYPE_META: Record<string, { ic: string; c: string; bg: string; label: string }> = {
  server:      { ic: "🖥", c: "#4B78F0", bg: "#EEF2FD", label: "Server" },
  skill:       { ic: "⚡", c: "#C94B6E", bg: "#FDF0F3", label: "Skill" },
  product:     { ic: "📦", c: "#7B5EA7", bg: "#F3EFFA", label: "Product" },
  platform:    { ic: "🏗", c: "#2E8B6F", bg: "#E7F4EF", label: "Platform" },
  framework:   { ic: "🧩", c: "#4B78F0", bg: "#EEF2FD", label: "Framework" },
  guide:       { ic: "📘", c: "#D4854A", bg: "#FEF3E2", label: "Guide" },
  technique:   { ic: "🔬", c: "#7B5EA7", bg: "#F3EFFA", label: "Technique" },
  tool:        { ic: "🔧", c: "#5B3D87", bg: "#F3EFFA", label: "Tool" },
  marketplace: { ic: "🛒", c: "#C94B6E", bg: "#FDF0F3", label: "Marketplace" },
  library:     { ic: "📚", c: "#4B78F0", bg: "#EEF2FD", label: "Library" },
  dataset:     { ic: "🗂", c: "#2E8B6F", bg: "#E7F4EF", label: "Dataset" },
  client_sdk:  { ic: "🔌", c: "#4B78F0", bg: "#EEF2FD", label: "Client SDK" },
  registry:    { ic: "📇", c: "#D4854A", bg: "#FEF3E2", label: "Registry" },
  spec:        { ic: "📐", c: "#5B3D87", bg: "#F3EFFA", label: "Spec" },
  benchmark:   { ic: "📊", c: "#2E8B6F", bg: "#E7F4EF", label: "Benchmark" },
  other:       { ic: "•",  c: "#6B6577", bg: "#F3F1F6", label: "Other" },
}
const meta = (t: string) => TYPE_META[t] ?? TYPE_META.other
const fmtStars = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`)

const PREVIEW_COUNT = 8

/* ── 엔티티 카드 (아이콘이 카드 폭의 약 1/3) ── */
function EntityCard({ e, color, bg }: { e: Entity; color: string; bg: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <a
      href={e.u}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-[12px] border bg-white p-3 transition-all"
      style={{ borderColor: "#E4E1EE", textDecoration: "none" }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.borderColor = "#C7B8E8"
        ev.currentTarget.style.boxShadow = "0 3px 10px rgba(91,61,135,.08)"
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.borderColor = "#E4E1EE"
        ev.currentTarget.style.boxShadow = "none"
      }}
    >
      {/* 아이콘: 카드 폭의 33% */}
      <span
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
        style={{
          width: "33%",
          maxWidth: 88,
          aspectRatio: "1 / 1",
          background: failed ? color : bg,
          borderColor: "#E4E1EE",
        }}
      >
        {failed ? (
          <span className="text-[26px] font-extrabold text-white">
            {e.n.trim().charAt(0).toUpperCase()}
          </span>
        ) : (
          <img
            src={`/building-blocks/icons/${e.i}.png`}
            alt=""
            loading="lazy"
            className="block h-full w-full object-contain p-[9px]"
            onError={() => setFailed(true)}
          />
        )}
      </span>

      {/* 본문 */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 pt-[1px]">
        <span className="truncate text-[13.5px] font-bold text-[#1A1626]">
          {e.n}
          {e.vf === 1 && (
            <span className="ml-[3px] text-[10px] text-[#2E8B6F]" title="출처 확인됨">
              ✔
            </span>
          )}
        </span>
        <span
          className="text-[11.5px] leading-[1.45] text-[#6E6A78]"
          style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {e.d}
        </span>
        <span className="mt-auto flex items-center gap-2 text-[10.5px] text-[#9E97B3]">
          {e.s ? <span className="flex-shrink-0 font-bold text-[#C7791B]">★ {fmtStars(e.s)}</span> : null}
          <span className="truncate">{e.v}</span>
        </span>
      </span>
    </a>
  )
}

/* ── 카테고리(entity_type) 섹션 ── */
function CategorySection({ g }: { g: Group }) {
  const [expanded, setExpanded] = useState(false)
  const m = meta(g.t)
  const shown = expanded ? g.items : g.items.slice(0, PREVIEW_COUNT)
  const hasMore = g.items.length > PREVIEW_COUNT

  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-[9px]">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[14px]"
          style={{ background: m.bg, color: m.c }}
        >
          {m.ic}
        </span>
        <span className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1626]">{m.label}</span>
        <span className="rounded-[9px] bg-[#F3F1F6] px-2 py-[2px] text-[10.5px] font-bold text-[#9E97B3]">
          {g.c}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold text-[#7B5EA7] hover:underline"
          >
            {expanded ? "접기 ↑" : `전체 보기 (${g.c}) →`}
          </button>
        )}
      </div>

      <div className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(276px, 1fr))" }}>
        {shown.map((e) => (
          <EntityCard key={e.i + e.n} e={e} color={m.c} bg={m.bg} />
        ))}
      </div>
    </div>
  )
}

/* ── 페이지 ── */
export function NDBuildingBlocksPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [active, setActive] = useState<string>("agent")
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/building-blocks/entities.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((j: Payload) => {
        setData(j)
        if (j.topics[0]) setActive(j.topics[0].k)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 className="mb-2 text-[26px] font-extrabold text-[#1A1626]">Building Blocks</h1>
        <p className="text-[13.5px] text-[#6E6A78]">데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  const topic = data?.topics.find((t) => t.k === active)

  return (
    <div>
      {/* 헤더 */}
      <div className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[#9E97B3]">
        Newly Discovered · Engineering &amp; Tooling
      </div>
      <h1 className="mb-[2px] mt-[6px] text-[26px] font-extrabold tracking-[-0.4px] text-[#1A1626]">
        Building Blocks
      </h1>
      <p className="mb-[6px] text-[14px] text-[#6E6A78]">빌딩 블록</p>
      <p className="mb-[18px] max-w-[780px] text-[13.5px] leading-[1.7] text-[#3D3652]">
        바로 가져다 조립하는 부품 — 프롬프트·템플릿·코드 스니펫·오케스트레이션 패턴·MCP·에이전트 구성.
        <b> 서브카테고리</b>로 나누고, 그 안을 다시 <b>카테고리</b>로 묶었습니다.
      </p>

      {/* 요약 */}
      <div className="mb-[22px] flex flex-wrap gap-[10px]">
        <div className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
          <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">
            {data ? data.total.toLocaleString() : "—"}
          </b>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">전체 엔티티</span>
        </div>
        {data?.topics.map((t) => (
          <div key={t.k} className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
            <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">{t.total}</b>
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">{t.l}</span>
          </div>
        ))}
      </div>

      {/* 서브카테고리 탭 */}
      <div className="mb-5 flex flex-wrap gap-[6px] border-b" style={{ borderColor: "#E4E1EE" }}>
        {data?.topics.map((t) => {
          const on = t.k === active
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setActive(t.k)}
              className="-mb-px flex cursor-pointer items-center gap-[7px] border-0 border-b-2 bg-transparent px-[14px] py-[9px] text-[13.5px] font-semibold transition-colors"
              style={{
                color: on ? "#C94B6E" : "#9E97B3",
                borderBottomColor: on ? "#C94B6E" : "transparent",
                borderBottomStyle: "solid",
              }}
            >
              {t.l}
              <span
                className="rounded-[9px] px-[7px] py-[1px] text-[10.5px] font-bold"
                style={{ background: on ? "#FDF0F3" : "#F3F1F6", color: on ? "#C94B6E" : "#6B6577" }}
              >
                {t.total}
              </span>
            </button>
          )
        })}
      </div>

      {/* 카테고리별 목록 */}
      {!data && <p className="text-[13px] text-[#9E97B3]">불러오는 중…</p>}
      {topic?.groups.map((g) => (
        <CategorySection key={g.t} g={g} />
      ))}
    </div>
  )
}
