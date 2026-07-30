"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { API_URL } from "@/lib/auth"

/**
 * Landscape 공용 컴포넌트 (Frameworks Best / Prompting Best 등)
 *
 * 데이터: GET /api/<pageKey>/landscape (백엔드가 JSON 파일 서빙)
 *   자동 생성: apps/api/scripts/generate-frameworks-landscape.cjs
 *   기획서: apps/docs/frameworks-landscape-admin-curation-plan.md
 *
 * 카드(=entity_type/theme) 클릭 → 그 안 top5를 전부 상세히 담은 모달, 각 항목 사이트 링크.
 * #1(최상위)을 spotlight로 강조.
 */

/* ── 표시 타입 (API 응답을 매핑) ── */
export type LandscapeEntity = {
  name: string
  desc: string
  detail?: string
  url: string | null
  stars: number | null
  spotlight: boolean
  emoji: string
}
export type LandscapeCategory = { code: string; name: string; entities: LandscapeEntity[] }

type ApiItem = {
  name: string; desc: string; detail?: string; url: string | null
  stars: number | null; emoji: string
}
type ApiCard = { key: string; label: string; items: ApiItem[] }
type ApiLandscape = { categories: ApiCard[] }

/* ── 카드(key) → 색상 (Frameworks + Prompting 전체) ── */
type CatColor = { c: string; bg: string }
const CAT_COLOR: Record<string, CatColor> = {
  // Frameworks Best
  framework: { c: "#4B78F0", bg: "#EEF2FD" },
  library: { c: "#2E8B6F", bg: "#E7F4EF" },
  client_sdk: { c: "#7C3AED", bg: "#F3EFFA" },
  server: { c: "#0194E2", bg: "#E6F4FD" },
  platform: { c: "#D4854A", bg: "#FEF3E2" },
  tool: { c: "#5B3D87", bg: "#F3EFFA" },
  product: { c: "#C94B6E", bg: "#FDF0F3" },
  spec_registry: { c: "#DC2626", bg: "#FDECEC" },
  // Prompting Best
  techniques: { c: "#7C3AED", bg: "#F3EFFA" },
  guides: { c: "#D4854A", bg: "#FEF3E2" },
  prompt_tools: { c: "#5B3D87", bg: "#F3EFFA" },
  prompt_libraries: { c: "#2E8B6F", bg: "#E7F4EF" },
  datasets: { c: "#0194E2", bg: "#E6F4FD" },
  skills: { c: "#C94B6E", bg: "#FDF0F3" },
  skill_marketplaces: { c: "#E94057", bg: "#FDECEF" },
  skill_specs: { c: "#DC2626", bg: "#FDECEC" },
}
const catColor = (code: string): CatColor => CAT_COLOR[code] ?? { c: "#9E97B3", bg: "#F3F1F6" }

/* 카드(key) → 폴백 이모지 */
const CAT_EMOJI: Record<string, string> = {
  framework: "🧩", library: "📚", client_sdk: "🔌", server: "🖥",
  platform: "🏗", tool: "🔧", product: "📦", spec_registry: "📐",
  techniques: "🔬", guides: "📘", prompt_tools: "🔧", prompt_libraries: "📚",
  datasets: "🗂", skills: "⚡", skill_marketplaces: "🛒", skill_specs: "📐",
}

/* 스타 축약 — 8900 → "8.9k" */
const fmtStars = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`

/* ── 엔티티 행 (카드 안 미리보기 — 표시 전용) ── */
function EntityRow({ e, code }: { e: LandscapeEntity; code: string }) {
  const col = catColor(code)
  return (
    <span className="flex items-center gap-3 border-t border-[#F1EFF5] py-[11px] first:border-t-0">
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-[9px] border text-[18px] leading-none"
        style={{ width: 36, height: 36, background: col.bg, borderColor: "#E4E1EE" }}
      >
        {e.emoji || CAT_EMOJI[code] || "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-[10px]">
          <span
            className="min-w-0 truncate text-[14px] font-bold"
            style={{ color: e.spotlight ? "#C94B6E" : "#1A1626" }}
          >
            {e.name}
          </span>
          {e.stars != null && (
            <span className="flex-shrink-0 text-[11.5px] font-extrabold text-[#C7791B]">
              ★ {fmtStars(e.stars)}
            </span>
          )}
        </span>
        {e.desc && (
          <span className="mt-[2px] block truncate text-[11.5px] leading-[1.4] text-[#6E6A78]">
            {e.desc}
          </span>
        )}
      </span>
    </span>
  )
}

/* ── 카테고리 카드 (카드 전체 클릭 → 상세 모달) ── */
function CategoryCard({
  cat,
  onOpen,
}: {
  cat: LandscapeCategory
  onOpen: (cat: LandscapeCategory) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(cat)}
      className="flex w-full cursor-pointer flex-col rounded-[14px] border bg-white px-[18px] pb-[10px] pt-4 text-left"
      style={{ borderColor: "#E4E1EE", transition: "border-color .15s, box-shadow .15s, transform .15s" }}
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
      <div className="mb-2 flex items-center gap-[10px]">
        <span className="flex-1 text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1626]">
          {cat.name}
        </span>
        <span className="text-[11px] font-extrabold text-[#9E97B3]">{cat.entities.length}</span>
      </div>
      <div className="flex flex-col">
        {cat.entities.map((e) => (
          <EntityRow key={e.name} e={e} code={cat.code} />
        ))}
      </div>
    </button>
  )
}

/* ── 카테고리 상세 모달 — 카드 안 top5 전부 상세히 + 각각 링크 ── */
function CategoryModal({ cat, onClose }: { cat: LandscapeCategory; onClose: () => void }) {
  const col = catColor(cat.code)

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[600px] flex-col rounded-[20px] bg-white"
        style={{ border: "1px solid #E4E1EE", boxShadow: "0 20px 48px rgba(26,22,38,.22)" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-[10px] border-b border-[#EEECF4] px-6 py-[18px]">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-[15px]"
            style={{ background: col.bg, color: col.c }}
          >
            {CAT_EMOJI[cat.code] ?? "•"}
          </span>
          <h3 className="flex-1 text-[18px] font-extrabold tracking-[-0.3px] text-[#1A1626]">
            {cat.name}
          </h3>
          <span className="text-[12px] font-extrabold text-[#9E97B3]">{cat.entities.length}</span>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-md px-1.5 text-[18px] text-[#9E97B3] hover:text-[#1A1626]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-2">
          {cat.entities.map((e) => {
            const inner = (
              <>
                <span
                  className="flex flex-shrink-0 items-center justify-center rounded-[12px] border text-[26px] leading-none"
                  style={{ width: 52, height: 52, background: col.bg, borderColor: "#E4E1EE" }}
                >
                  {e.emoji || CAT_EMOJI[cat.code] || "•"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className="text-[15px] font-extrabold tracking-[-0.2px]"
                      style={{ color: e.spotlight ? "#C94B6E" : "#1A1626" }}
                    >
                      {e.name}
                    </span>
                    {e.spotlight && (
                      <span
                        className="rounded-[5px] px-[6px] py-[1px] text-[9.5px] font-extrabold"
                        style={{ background: "#FDF0F3", color: "#C94B6E" }}
                      >
                        TOP PICK
                      </span>
                    )}
                    {e.stars != null && (
                      <span className="text-[11.5px] font-extrabold text-[#C7791B]">
                        ★ {fmtStars(e.stars)}
                      </span>
                    )}
                    {e.url && (
                      <span className="ml-auto flex-shrink-0 text-[12px] font-bold text-[#7B5EA7] opacity-0 transition-opacity group-hover:opacity-100">
                        Visit ↗
                      </span>
                    )}
                  </span>
                  <span className="mt-[4px] block text-[12.5px] leading-[1.6] text-[#3D3652]">
                    {e.detail || e.desc}
                  </span>
                </span>
              </>
            )
            const cls =
              "group flex items-start gap-[14px] border-b border-[#F1EFF5] py-[15px] no-underline last:border-b-0"
            return e.url ? (
              <a
                key={e.name}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cls + " -mx-3 rounded-[12px] px-3 transition-colors hover:bg-[#F8F5FE]"}
              >
                {inner}
              </a>
            ) : (
              <span key={e.name} className={cls}>
                {inner}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null
}

/* ── Rising Star — 지금은 스타 최다 항목(초기 시딩). 나중에 급상승으로 교체 예정 ── */
export function RisingStar({ pageKey }: { pageKey: string }) {
  const [top, setTop] = useState<{ it: ApiItem; catLabel: string; code: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/api/${pageKey}/landscape`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d: ApiLandscape) => {
        if (!alive) return
        let best: { it: ApiItem; catLabel: string; code: string } | null = null
        for (const c of d.categories || []) {
          for (const it of c.items || []) {
            if (it.stars == null) continue
            if (!best || it.stars > (best.it.stars ?? -1)) best = { it, catLabel: c.label, code: c.key }
          }
        }
        setTop(best)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [pageKey])

  if (!top) return null
  const { it, catLabel, code } = top
  const col = catColor(code)

  const card = (
    <div className="relative rounded-[14px] border bg-white px-6 py-[22px]" style={{ borderColor: "#E4E1EE" }}>
      <span
        className="absolute left-0 top-0 rounded-br-[4px] rounded-tl-[5px] px-[10px] py-[5px] text-[10px] font-extrabold tracking-[0.3px] text-white"
        style={{ background: "#7B5EA7" }}
      >
        HOT
      </span>
      <span className="mb-[8px] mt-[6px] block text-[11px] font-bold text-[#7B5EA7]">
        Most starred right now
      </span>
      <div className="flex items-center gap-2">
        <h3 className="text-[22px] font-extrabold tracking-[-0.4px] text-[#1A1626]">{it.name}</h3>
        {it.stars != null && (
          <span className="text-[13px] font-extrabold text-[#C7791B]">★ {fmtStars(it.stars)}</span>
        )}
      </div>
      <span
        className="mt-[6px] inline-block rounded-[7px] px-[8px] py-[2px] text-[11px] font-bold"
        style={{ background: col.bg, color: col.c }}
      >
        {catLabel}
      </span>
      <p className="mt-[10px] max-w-[560px] text-[13px] leading-[1.6] text-[#5A5568]">
        {it.detail || it.desc}
      </p>
    </div>
  )

  return it.url ? (
    <a href={it.url} target="_blank" rel="noopener noreferrer" className="block no-underline">
      {card}
    </a>
  ) : (
    card
  )
}

/* ── 공용 섹션: <pageKey> landscape를 API에서 읽어 카드 그리드 + 모달 ── */
export function LandscapeSection({ pageKey }: { pageKey: string }) {
  const [categories, setCategories] = useState<LandscapeCategory[]>([])
  const [selected, setSelected] = useState<LandscapeCategory | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/api/${pageKey}/landscape`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d: ApiLandscape) => {
        if (!alive) return
        const mapped: LandscapeCategory[] = (d.categories || [])
          .filter((c) => c.items && c.items.length > 0)
          .map((c) => ({
            code: c.key,
            name: c.label,
            entities: c.items.map((it, i) => ({
              name: it.name,
              desc: it.desc,
              detail: it.detail,
              url: it.url,
              stars: it.stars,
              emoji: it.emoji,
              spotlight: i === 0,
            })),
          }))
        setCategories(mapped)
      })
      .catch(console.error)
    return () => {
      alive = false
    }
  }, [pageKey])

  if (categories.length === 0) {
    return <p className="text-[13px] text-[#9E97B3]">Loading…</p>
  }

  return (
    <>
      <div
        className="grid gap-[12px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {categories.map((cat) => (
          <CategoryCard key={cat.code} cat={cat} onOpen={setSelected} />
        ))}
      </div>
      {selected && <CategoryModal cat={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
