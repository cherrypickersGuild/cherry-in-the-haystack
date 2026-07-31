"use client"

import { useEffect, useMemo, useState } from "react"
import { LandscapeSection, RisingStar } from "./nd-landscape"
import { CasesArticleList } from "./nd-cases-articles-page"

/**
 * Research & Models — 방법론 준수.
 *  - 상위(블록): NDResearchPage 카탈로그 — 3분류 전체를 그룹축(domain)별로 나열.
 *  - 하위:
 *      Papers(article)  → NDPapersPage = 기사형 목록(CasesArticleList base="research").
 *      Model Updates / Benchmarks(domain) → NDResearchLandscapePage = 도메인형 랜드스케이프.
 * 데이터: /research/{entities,icons,pages}.json + 랜드스케이프는 GET /api/<page>/landscape.
 */

type Item = {
  id: string; category: string; kind: string; domain: string; name: string
  company: string | null; description: string; summary?: string; tags: string[]
  source_type: string; url: string; date: string | null
}
type Col = { c: string; bg: string }
type Icons = { palette: Col[]; neutral: Col; themePools?: { pattern: string; emojis: string[] }[] }

const RESEARCH_CATS = [
  { key: "papers", label: "Papers" },
  { key: "model-updates", label: "Model Updates" },
  { key: "benchmarks-datasets", label: "Benchmarks & Datasets" },
]
const DISCOURSE_CATS = [
  { key: "regulations-policy-compliance", label: "Regulations · Policy · Compliance" },
  { key: "community", label: "Community" },
  { key: "big-tech-trends", label: "Big Tech Trends" },
  { key: "market-investment", label: "Market & Investment" },
  { key: "technical-deep-dives", label: "Technical Deep Dives" },
  { key: "insights-opinions", label: "Insights & Opinions" },
]

function makeEmoji(icons: Icons | null) {
  const pools: [RegExp, string[]][] = (icons?.themePools ?? []).map((p) => [new RegExp(p.pattern, "i"), p.emojis])
  const FB = ["🔬", "🧠", "📈", "🧩", "📊", "✨", "📚", "🧪"]
  return (name: string, group: string) => {
    let pool = FB
    for (const [re, p] of pools) if (re.test(group)) { pool = p; break }
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return pool[h % pool.length]
  }
}
const PREVIEW = 8

/* ── 카탈로그 카드 ── */
function Card({ it, col, emoji }: { it: Item; col: Col; emoji: string }) {
  const text = it.summary || it.description
  return (
    <a href={it.url} target="_blank" rel="noopener noreferrer"
      className="group flex items-stretch gap-3 rounded-[12px] border bg-white p-3 no-underline transition-all"
      style={{ borderColor: "#E4E1EE" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C7B8E8"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(91,61,135,.10)"; e.currentTarget.style.transform = "translateY(-2px)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1EE"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none" }}
    >
      <span className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border leading-none"
        style={{ width: "33%", maxWidth: 88, aspectRatio: "1 / 1", background: col.bg, borderColor: "#E4E1EE", fontSize: 48 }}>{emoji}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pt-[1px]">
        <span className="truncate text-[13.5px] font-bold text-[#1A1626] group-hover:text-[#C94B6E]">{it.name}</span>
        {text && <span className="text-[11.5px] leading-[1.45] text-[#6E6A78]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text}</span>}
        <span className="mt-auto flex flex-wrap items-center gap-[5px] text-[10.5px] text-[#9E97B3]">
          {it.tags.slice(0, 2).map((t) => (
            <span key={t} className="flex-shrink-0 rounded-[6px] px-[6px] py-[1px] text-[9.5px] font-bold" style={{ background: col.bg, color: col.c }}>{t}</span>
          ))}
          {it.company && <span className="truncate">{it.company}</span>}
        </span>
      </span>
    </a>
  )
}

/* ── 카탈로그 그룹 섹션 ── */
function GroupSection({ group, items, col, emojiOf }: { group: string; items: Item[]; col: Col; emojiOf: (n: string, g: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, PREVIEW)
  const more = items.length > PREVIEW
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-[9px]">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[14px]" style={{ background: col.bg, color: col.c }}>{emojiOf(group, group)}</span>
        <span className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1626]">{group}</span>
        <span className="rounded-[9px] bg-[#F3F1F6] px-2 py-[2px] text-[10.5px] font-bold text-[#9E97B3]">{items.length}</span>
        {more && expanded && <button type="button" onClick={() => setExpanded(false)} className="ml-auto cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold text-[#7B5EA7] hover:underline">Show less ↑</button>}
      </div>
      <div className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(276px, 1fr))" }}>
        {shown.map((it) => <Card key={it.id} it={it} col={col} emoji={emojiOf(it.name, group)} />)}
        {more && !expanded && (
          <button type="button" onClick={() => setExpanded(true)}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed bg-transparent p-3 transition-all"
            style={{ borderColor: "#C7B8E8", color: "#7B5EA7", minHeight: 112 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F3EFFA"; e.currentTarget.style.borderColor = "#7B5EA7" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#C7B8E8" }}>
            <span className="text-[20px] font-extrabold leading-none">+{items.length - PREVIEW}</span>
            <span className="text-[12px] font-semibold">more</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── 상위 블록: 카탈로그 (Research·Discourse 공용) ── */
type CatDef = { key: string; label: string }
type PageCfg = { domainMap?: Record<string, string>; tabs?: { fallbackLabel?: string } }

function GroupCatalog({ base, cats, title, subtitle }: { base: string; cats: CatDef[]; title: string; subtitle: string }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [icons, setIcons] = useState<Icons | null>(null)
  const [pages, setPages] = useState<Record<string, PageCfg>>({})
  const [active, setActive] = useState(cats[0].key)

  useEffect(() => {
    Promise.all([
      fetch(`/${base}/entities.json`).then((r) => r.json()),
      fetch(`/${base}/icons.json`).then((r) => r.json()),
      fetch(`/${base}/pages.json`).then((r) => r.json()),
    ]).then(([ent, ico, pg]) => { setItems(ent.items); setIcons(ico); setPages(pg) }).catch(() => setItems([]))
  }, [base])

  const emojiOf = useMemo(() => makeEmoji(icons), [icons])
  const countOf = (k: string) => items?.filter((x) => x.category === k).length ?? 0
  const groups = useMemo(() => {
    if (!items) return [] as [string, Item[]][]
    const cfg = pages[active]
    const map = cfg?.domainMap
    const fb = cfg?.tabs?.fallbackLabel ?? "Other"
    const sectorOf = (dom: string) => (map ? (map[dom] ?? fb) : dom)
    const m = new Map<string, Item[]>()
    for (const it of items.filter((x) => x.category === active)) {
      const s = sectorOf(it.domain)
      if (!m.has(s)) m.set(s, [])
      m.get(s)!.push(it)
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [items, active, pages])

  return (
    <div className="max-w-[1000px]">
      <h1 className="mb-[2px] text-[26px] font-extrabold tracking-[-0.4px] text-[#1A1626]">{title}</h1>
      <p className="mb-[18px] max-w-[780px] text-[14px] leading-[1.7] text-[#6E6A78]">{subtitle}</p>

      {/* 카테고리 탭 — 여러 줄이 될 수 있어 채워진 pill 버튼(선택 뚜렷) */}
      <div className="mb-6 flex flex-wrap gap-[8px]">
        {cats.map((c) => {
          const on = c.key === active
          return (
            <button key={c.key} type="button" onClick={() => setActive(c.key)}
              className="flex cursor-pointer items-center gap-[7px] rounded-[10px] border px-[13px] py-[7px] text-[13px] font-semibold transition-all"
              style={{ background: on ? "#C94B6E" : "#FFFFFF", color: on ? "#FFFFFF" : "#6E6A78", borderColor: on ? "#C94B6E" : "#E4E1EE", boxShadow: on ? "0 2px 8px rgba(201,75,110,.22)" : "none" }}
              onMouseEnter={(e) => { if (!on) { e.currentTarget.style.borderColor = "#C7B8E8"; e.currentTarget.style.color = "#1A1626" } }}
              onMouseLeave={(e) => { if (!on) { e.currentTarget.style.borderColor = "#E4E1EE"; e.currentTarget.style.color = "#6E6A78" } }}>
              {c.label}
              <span className="rounded-[7px] px-[6px] py-[1px] text-[10.5px] font-bold" style={{ background: on ? "rgba(255,255,255,.22)" : "#F3F1F6", color: on ? "#FFFFFF" : "#9E97B3" }}>{countOf(c.key)}</span>
            </button>
          )
        })}
      </div>

      {!items && <p className="text-[13px] text-[#9E97B3]">Loading…</p>}
      {items && icons && groups.map(([g, list], idx) => (
        <GroupSection key={g} group={g} items={list} col={icons.palette[idx % icons.palette.length]} emojiOf={emojiOf} />
      ))}
    </div>
  )
}

export function NDResearchPage() {
  return <GroupCatalog base="research" cats={RESEARCH_CATS}
    title="Research & Models - Building Blocks"
    subtitle="Foundational research, model releases, and evaluation resources — milestone papers, open models, and benchmarks. Every entry links to the original source." />
}

export function NDDiscoursePage() {
  return <GroupCatalog base="discourse" cats={DISCOURSE_CATS}
    title="Discourse - Building Blocks"
    subtitle="AI governance, community, big-tech moves, market maps, technical deep dives, and opinions. Every entry links to the original source." />
}

/* ── 하위: Papers(기사형) ── */
export function NDPapersPage() {
  return (
    <div className="max-w-[940px]">
      <CasesArticleList base="research" page="papers" header />
      <div className="h-8" aria-hidden />
    </div>
  )
}

/* ── 하위: Discourse 기사형 (6개 카테고리 공용) ── */
export function NDDiscourseArticlePage({ page }: { page: string }) {
  return (
    <div className="max-w-[940px]">
      <CasesArticleList base="discourse" page={page} header />
      <div className="h-8" aria-hidden />
    </div>
  )
}

/* ── 하위: Model Updates / Benchmarks(도메인형 랜드스케이프) ── */
export function NDResearchLandscapePage({ page }: { page: string }) {
  const [meta, setMeta] = useState<{ title: string; subtitle: string } | null>(null)
  useEffect(() => { fetch("/research/pages.json").then((r) => r.json()).then((p) => setMeta(p[page] ?? null)).catch(() => setMeta(null)) }, [page])
  return (
    <div className="max-w-[1160px]">
      <div className="max-w-[940px]">
        <h1 className="m-0 mb-[4px] text-[30px] font-extrabold leading-[1.1] tracking-[-0.6px] text-[#1A1626]">{meta?.title ?? "Research"}</h1>
        <p className="mb-[30px] text-[13.5px] text-[#9E97B3]">{meta?.subtitle}</p>
      </div>

      {/* Rising Star — 맨 위 (도메인형이라 stars 없으면 대표 1개 featured) */}
      <div className="max-w-[940px]">
        <div className="mb-4 mt-[28px] flex items-baseline gap-[10px]">
          <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">Rising Star</h2>
          <span className="text-[12.5px] text-[#9E97B3]">One to watch right now</span>
        </div>
        <RisingStar pageKey={page} />
      </div>

      <div className="mb-4 mt-[52px] flex items-baseline gap-[10px]">
        <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">Landscape</h2>
        <span className="text-[12.5px] text-[#9E97B3]">Top groups × best 5 · click a card for details</span>
      </div>
      <LandscapeSection pageKey={page} />
      <div className="h-8" aria-hidden />
    </div>
  )
}
