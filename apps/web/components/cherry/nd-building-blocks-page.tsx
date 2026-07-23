"use client"

import { createContext, useContext, useEffect, useState } from "react"

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

/* ── 카테고리(entity_type) 표시 정보 ──
   ic는 카테고리 헤더 아이콘이자, 로고 수집이 안 된 항목의 '기본 아이콘'으로도 쓰인다. */
type TypeMeta = { ic: string; c: string; bg: string; label: string }

const TYPE_META: Record<string, TypeMeta> = {
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

/* ── 데이터 판단은 전부 여기(로직)에서 한다. JSON은 원본 그대로 두고 손대지 않는다. ── */

/** 링크가 실제로 쓸 수 있는 주소인가. 원본에 target_url이 "unknown" 등으로 오는 경우가 있다. */
function isUsableUrl(u: string): boolean {
  return /^https?:\/\//i.test(u)
}

/** 표시 대상인가 — 링크가 없는 항목은 클릭해도 갈 곳이 없으므로 목록에서 제외 */
function isDisplayable(e: Entity): boolean {
  return isUsableUrl(e.u)
}

/**
 * 수집된 아이콘 slug 목록(icons.json).
 * 이게 있으면 파일 없는 아이콘은 요청조차 하지 않아 404가 안 난다.
 * 로드 실패해도 동작한다 — 그 경우 요청해보고 onError로 폴백(404는 나지만 화면은 정상).
 */
const IconSetContext = createContext<Set<string> | null>(null)
const useHasIcon = () => {
  const set = useContext(IconSetContext)
  return (slug: string) => (set ? set.has(slug) : true)
}

/* ── 엔티티 카드 (아이콘이 카드 폭의 약 1/3) ── */
function EntityCard({ e, m }: { e: Entity; m: TypeMeta }) {
  const hasIcon = useHasIcon()
  // 수집된 아이콘 파일이 없으면 요청을 아예 보내지 않고 바로 기본 아이콘으로(404 방지)
  const [failed, setFailed] = useState(!hasIcon(e.i))
  return (
    <a
      href={e.u}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-[12px] border bg-white p-3 transition-all"
      style={{ borderColor: "#E4E1EE", textDecoration: "none" }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.borderColor = "#C7B8E8"
        ev.currentTarget.style.boxShadow = "0 8px 24px rgba(91,61,135,.14)"
        ev.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.borderColor = "#E4E1EE"
        ev.currentTarget.style.boxShadow = "none"
        ev.currentTarget.style.transform = "none"
      }}
    >
      {/* 아이콘: 카드 폭의 33%. 수집된 로고가 없으면 카테고리 기본 아이콘으로 폴백 */}
      <span
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
        style={{
          width: "33%",
          maxWidth: 88,
          aspectRatio: "1 / 1",
          background: m.bg,
          borderColor: "#E4E1EE",
        }}
      >
        {failed ? (
          <span className="text-[30px] leading-none" style={{ color: m.c }} title={m.label}>
            {m.ic}
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
            <span className="ml-[3px] text-[10px] text-[#2E8B6F]" title="Verified source">
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
  // 링크 없는 항목은 로직에서 걸러낸다 (JSON은 원본 그대로)
  const items = g.items.filter(isDisplayable)
  const shown = expanded ? items : items.slice(0, PREVIEW_COUNT)
  const hasMore = items.length > PREVIEW_COUNT

  if (items.length === 0) return null

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
          {items.length}
        </span>
        {/* 펼치기는 그리드 마지막 칸의 카드가 담당한다. 여기는 접기 전용. */}
        {hasMore && expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-auto cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold text-[#7B5EA7] hover:underline"
          >
            Show less ↑
          </button>
        )}
      </div>

      <div className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(276px, 1fr))" }}>
        {shown.map((e) => (
          <EntityCard key={e.i + e.n} e={e} m={m} />
        ))}

        {/* 그리드 마지막 칸 — 숨겨진 항목이 있다는 걸 목록 안에서 보이게 */}
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed bg-transparent p-3 transition-all"
            style={{ borderColor: "#C7B8E8", color: "#7B5EA7", minHeight: 112 }}
            onMouseEnter={(ev) => {
              ev.currentTarget.style.background = "#F3EFFA"
              ev.currentTarget.style.borderColor = "#7B5EA7"
            }}
            onMouseLeave={(ev) => {
              ev.currentTarget.style.background = "transparent"
              ev.currentTarget.style.borderColor = "#C7B8E8"
            }}
          >
            <span className="text-[20px] font-extrabold leading-none">
              +{items.length - PREVIEW_COUNT}
            </span>
            <span className="text-[12px] font-semibold">more {m.label.toLowerCase()}</span>
            <span className="text-[11px] text-[#9E97B3]">Click to show all</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── 페이지 ── */
export function NDBuildingBlocksPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [iconSet, setIconSet] = useState<Set<string> | null>(null)
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

    // 아이콘 매니페스트 — 실패해도 페이지는 정상 동작(요청 후 onError 폴백)
    fetch("/building-blocks/icons.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no manifest"))))
      .then((slugs: string[]) => setIconSet(new Set(slugs)))
      .catch(() => setIconSet(null))
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 className="mb-2 text-[26px] font-extrabold text-[#1A1626]">Building Blocks</h1>
        <p className="text-[13.5px] text-[#6E6A78]">Failed to load data.</p>
      </div>
    )
  }

  const topic = data?.topics.find((t) => t.k === active)

  // 카운트도 표시 기준(링크 유효한 것)으로 로직에서 계산한다
  const countOf = (t: Topic) =>
    t.groups.reduce((n, g) => n + g.items.filter(isDisplayable).length, 0)
  const grandTotal = data ? data.topics.reduce((n, t) => n + countOf(t), 0) : 0

  return (
    <IconSetContext.Provider value={iconSet}>
      <div>
      {/* 헤더 */}
      <h1 className="mb-[2px] text-[26px] font-extrabold tracking-[-0.4px] text-[#1A1626]">
        Building Blocks
      </h1>
      <p className="mb-[18px] max-w-[780px] text-[14px] leading-[1.7] text-[#6E6A78]">
        Prompts, templates, code snippets, orchestration patterns, MCP servers, and agent
        configurations — ready to pick up and assemble.
      </p>

      {/* 요약 */}
      <div className="mb-[22px] flex flex-wrap gap-[10px]">
        <div className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
          <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">
            {data ? grandTotal.toLocaleString() : "—"}
          </b>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">Total</span>
        </div>
        {data?.topics.map((t) => (
          <div key={t.k} className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
            <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">{countOf(t)}</b>
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
                {countOf(t)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 카테고리별 목록 */}
      {!data && <p className="text-[13px] text-[#9E97B3]">Loading…</p>}
      {topic?.groups.map((g) => (
        <CategorySection key={g.t} g={g} />
      ))}
      </div>
    </IconSetContext.Provider>
  )
}
