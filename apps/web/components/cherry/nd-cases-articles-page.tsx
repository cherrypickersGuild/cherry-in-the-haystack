"use client"

import { useEffect, useMemo, useState } from "react"

/**
 * Cases 기사(article) 목록 — pill 섹터 탭 + 세로 목록.
 * kind === "article" 항목을 렌더한다. (kind === "domain"은 도메인형 랜드스케이프 = nd-cases-best-page)
 *
 * ⚠️ 하드코딩 금지 — 화면 구성/색/문구/도메인 정규화는 모두 JSON에서:
 *   - /cases/entities.json  (기초조사: 데이터 + summary + kind)
 *   - /cases/pages.json     (페이지 구성)  → pages[page]
 *   - /cases/icons.json     (색 팔레트)
 *
 * export:
 *   - CasesArticleList : 기사 섹션(탭+목록) 재사용 조각. 혼합 페이지 하단에도 삽입.
 *   - NDCasesListPage  : 기사 단일 분류(Case Studies) 전용 페이지(헤더 + 목록).
 */

type CaseItem = {
  id: string
  category: string
  domain: string
  name: string
  company: string | null
  description: string
  summary?: string
  kind: string
  tags: string[]
  source_type: string
  url: string
  date: string | null
}
type EntitiesPayload = { items: CaseItem[] }

type Col = { c: string; bg: string }
type Icons = { palette: Col[]; neutral: Col }

type CardCfg = {
  title: string
  summary: string[]
  summaryLines: number
  badge: string
  tags: { field: string; max: number }
  meta: string[]
}
type PageCfg = {
  title: string
  subtitle: string
  sectionTitle: string
  tabs: { includeAll: boolean; orderBy: string; fallbackLabel?: string }
  domainMap?: Record<string, string>
  card: CardCfg
  sourceTypeLabels: Record<string, string>
}

const rawSector = (d: string) => (d.split(",")[0].trim() || d)
const field = (it: CaseItem, key: string) => (it as unknown as Record<string, unknown>)[key]
const firstOf = (it: CaseItem, keys: string[]) => {
  for (const k of keys) {
    const v = field(it, k)
    if (typeof v === "string" && v.trim()) return v
  }
  return ""
}

/* ── 기사 한 줄 카드 ── */
function ArticleRow({ it, col, card, srcLabels }: { it: CaseItem; col: Col; card: CardCfg; srcLabels: Record<string, string> }) {
  const title = String(field(it, card.title) ?? "")
  const summary = firstOf(it, card.summary)
  const badge = card.badge ? (field(it, card.badge) as string | null) : null
  const tags = (field(it, card.tags.field) as string[] | undefined)?.slice(0, card.tags.max) ?? []
  return (
    <a
      href={it.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-[12px] border bg-white p-4 no-underline transition-all"
      style={{ borderColor: "#E4E1EE" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C7B8E8"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(91,61,135,.08)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1EE"; e.currentTarget.style.boxShadow = "none" }}
    >
      <h3 className="m-0 mb-1.5 text-[15px] font-bold leading-[1.4] text-[#1A1626] group-hover:text-[#C94B6E]">{title}</h3>
      {summary && (
        <p
          className="m-0 mb-2.5 text-[13px] leading-[1.55] text-[#6E6A78]"
          style={{ display: "-webkit-box", WebkitLineClamp: card.summaryLines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {summary}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {badge && (
          <span className="inline-flex rounded-[7px] px-2 py-[2px] text-[10.5px] font-bold" style={{ background: col.bg, color: col.c }}>{badge}</span>
        )}
        {tags.map((t) => (
          <span key={t} className="inline-flex rounded-[7px] border px-2 py-[2px] text-[10.5px] text-[#6E6A78]" style={{ borderColor: "#E4E1EE" }}>{t}</span>
        ))}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-[#9E97B3]">
          {card.meta.map((m, i) => {
            const raw = field(it, m)
            if (!raw) return null
            const val = m === "source_type" ? (srcLabels[String(raw)] ?? String(raw)) : String(raw)
            return <span key={m}>{i > 0 ? `· ${val}` : val}</span>
          })}
        </span>
      </div>
    </a>
  )
}

/* ── 재사용: 기사 섹션(탭 + 목록). 혼합 페이지 하단에도 삽입.
 *    base = 데이터 그룹 경로(public/<base>/{entities,icons,pages}.json). 기본 "cases", Research는 "research". ── */
export function CasesArticleList({ page, kind, header, sectionTitle, base = "cases" }: { page: string; kind?: string; header?: boolean; sectionTitle?: string; base?: string }) {
  const [items, setItems] = useState<CaseItem[] | null>(null)
  const [icons, setIcons] = useState<Icons | null>(null)
  const [cfg, setCfg] = useState<PageCfg | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<string | null>(null)

  useEffect(() => {
    setItems(null); setTab(null)
    Promise.all([
      fetch(`/${base}/entities.json`).then((r) => r.json()),
      fetch(`/${base}/icons.json`).then((r) => r.json()),
      fetch(`/${base}/pages.json`).then((r) => r.json()),
    ])
      .then(([ent, ico, pages]: [EntitiesPayload, Icons, Record<string, PageCfg>]) => {
        setItems(ent.items.filter((x) => x.category === page && (!kind || x.kind === kind)))
        setIcons(ico)
        setCfg(pages[page] ?? null)
      })
      .catch(() => setError(true))
  }, [page, kind, base])

  const sectorOf = useMemo(() => {
    const map = cfg?.domainMap
    const fb = cfg?.tabs.fallbackLabel ?? "Other"
    return (domain: string) => { const s = rawSector(domain); return map ? (map[s] ?? fb) : s }
  }, [cfg])

  const sectors = useMemo(() => {
    if (!items) return [] as [string, number][]
    const map = new Map<string, number>()
    for (const it of items) { const s = sectorOf(it.domain); map.set(s, (map.get(s) ?? 0) + 1) }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [items, sectorOf])

  useEffect(() => { if (tab === null && sectors.length) setTab(sectors[0][0]) }, [sectors, tab])

  const colorOf = useMemo(() => {
    const m = new Map<string, Col>()
    if (icons) sectors.forEach(([s], i) => m.set(s, icons.palette[i % icons.palette.length]))
    return m
  }, [sectors, icons])

  const shown = useMemo(() => {
    if (!items || !tab) return []
    return items.filter((it) => sectorOf(it.domain) === tab)
  }, [items, tab, sectorOf])

  if (error) return <p className="text-[13px] text-[#6E6A78]">Failed to load data.</p>
  const loading = !items || !icons || !cfg
  const secTitle = sectionTitle ?? cfg?.sectionTitle ?? "Articles"

  return (
    <>
      {header && (
        <>
          <h1 className="mb-[2px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">{cfg?.title ?? "Cases"}</h1>
          <p className="mb-[24px] max-w-[760px] text-[14px] leading-[1.7] text-[#6E6A78]">{cfg?.subtitle}</p>
        </>
      )}

      {/* 섹션 제목 (탭보다 위 — 이게 기사 섹션임을 먼저 알림) */}
      <div className="mb-3 flex items-baseline gap-[10px]">
        <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{secTitle}</h2>
        {tab && <span className="text-[12.5px] text-[#9E97B3]">{shown.length} in {tab}</span>}
      </div>

      {/* 산업 섹터 탭 (pill) */}
      <div className="mb-6 flex flex-wrap gap-[8px]">
        {sectors.map(([key, n]) => {
          const on = key === tab
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex cursor-pointer items-center gap-[7px] rounded-[10px] border px-[13px] py-[7px] text-[13px] font-semibold transition-all"
              style={{ background: on ? "#C94B6E" : "#FFFFFF", color: on ? "#FFFFFF" : "#6E6A78", borderColor: on ? "#C94B6E" : "#E4E1EE", boxShadow: on ? "0 2px 8px rgba(201,75,110,.22)" : "none" }}
              onMouseEnter={(e) => { if (!on) { e.currentTarget.style.borderColor = "#C7B8E8"; e.currentTarget.style.color = "#1A1626" } }}
              onMouseLeave={(e) => { if (!on) { e.currentTarget.style.borderColor = "#E4E1EE"; e.currentTarget.style.color = "#6E6A78" } }}
            >
              {key}
              <span className="rounded-[7px] px-[6px] py-[1px] text-[10.5px] font-bold" style={{ background: on ? "rgba(255,255,255,.22)" : "#F3F1F6", color: on ? "#FFFFFF" : "#9E97B3" }}>{n}</span>
            </button>
          )
        })}
      </div>

      {loading && <p className="text-[13px] text-[#9E97B3]">Loading…</p>}
      {!loading && shown.length === 0 && <p className="text-[13px] text-[#9E97B3]">No articles.</p>}

      <div className="flex flex-col gap-[10px]">
        {!loading && cfg && icons && shown.map((it) => (
          <ArticleRow key={it.id} it={it} col={colorOf.get(sectorOf(it.domain)) ?? icons.neutral} card={cfg.card} srcLabels={cfg.sourceTypeLabels} />
        ))}
      </div>
    </>
  )
}

/* ── 기사 단일 분류(Case Studies) 전용 페이지 ── */
export function NDCasesListPage({ page }: { page: string }) {
  return (
    <div className="max-w-[940px]">
      <CasesArticleList page={page} header />
      <div className="h-8" aria-hidden />
    </div>
  )
}
