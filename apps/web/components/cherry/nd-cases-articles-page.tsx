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

/* 페이지별 대표 픽 기준 (라벨/문구 + 인기주제 정규식 + 인지도 집합).
 * 공통 로직: 최신 연도 항목 중 → 요약 有(+5)·인기주제(+3)·인지도(+2) 점수 최고 1개. */
type FeatCfg = { label: string; sub: string; trending?: RegExp; notable?: Set<string>; prominent?: RegExp }
const FEATURED_CFG: Record<string, FeatCfg> = {
  // ── Cases ──
  "case-studies": {
    label: "Featured Read", sub: "Worth reading right now",
    trending: /llm|agent|rag|generative|multimodal|prompt|fine.?tun|diffusion|embedding|vector|gpt/i,
    notable: new Set(["Netflix", "Uber", "Meta", "Google", "Airbnb", "LinkedIn", "Instacart", "DoorDash", "Stripe", "Dropbox", "Pinterest", "Spotify", "Amazon", "Microsoft", "Nvidia", "Wayfair", "Zillow", "Grammarly", "Canva", "Shopify", "Reddit", "Lyft", "Swiggy", "Slack", "Ramp"]),
  },
  // ── Research: Papers ──
  "papers": {
    label: "Featured Paper", sub: "The latest milestone worth reading",
    trending: /reasoning|open models|multimodal|instruction|alignment|scaling|architecture|agent/i,
    notable: new Set(["OpenAI", "Google", "Meta", "DeepMind", "DeepSeek", "Microsoft", "Mistral", "Alibaba", "Stanford", "Ai2", "NVIDIA", "Anthropic"]),
  },
  // ── Discourse: 날짜형(최신 연/분기 + 주제·인지도) ──
  "market-investment": {
    label: "Featured Map", sub: "Fresh market view",
    prominent: /a16z|andreessen|sequoia|bessemer|cb insights|air street|menlo|coatue|state of ai|battery/i,
    trending: /agent|infrastructure|foundation|compute|inference|data ?center|hardware/i,
  },
  "technical-deep-dives": {
    label: "Featured Read", sub: "Deep dive worth your time",
    trending: /llm|agent|rag|generative|multimodal|prompt|fine.?tun|embedding|vector|ranking|recommendation/i,
    notable: new Set(["Netflix", "Uber", "Meta", "Google", "Airbnb", "LinkedIn", "Instacart", "DoorDash", "Stripe", "Dropbox", "Pinterest", "Amazon", "Microsoft", "Spotify", "Lyft", "Swiggy"]),
  },
  // ── Discourse: 무날짜형(유명 엔티티 매칭) ──
  "regulations-policy-compliance": {
    label: "Key Framework", sub: "The one to know",
    prominent: /NIST|ISO\/IEC 42001|EU AI Act|MITRE ATLAS|OWASP|NIST AI 100/i,
  },
  "community": {
    label: "Featured Event", sub: "Don't miss this",
    prominent: /NeurIPS|ICML|ICLR|AI Action Summit|CVPR|ACL|AI Engineer/i,
  },
  "big-tech-trends": {
    label: "Lab to Watch", sub: "Frontier player right now",
    prominent: /OpenAI|Anthropic|Google DeepMind|DeepMind/i,
  },
  "insights-opinions": {
    label: "Featured Newsletter", sub: "Worth subscribing",
    prominent: /The Batch|Import AI|The Gradient|Latent Space|Ahead of AI|Interconnects/i,
  },
}

/* ── 대표 기사 카드 (Featured Read/Paper) — 페이지 맨 위 1개 픽 ── */
function FeaturedRead({ it, col, label, sub }: { it: CaseItem; col: Col; label: string; sub: string }) {
  const summary = it.summary || it.description
  return (
    <a href={it.url} target="_blank" rel="noopener noreferrer"
      className="group relative mb-6 block rounded-[14px] border bg-white px-6 py-[22px] no-underline transition-all"
      style={{ borderColor: "#E4E1EE" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C7B8E8"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(91,61,135,.10)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1EE"; e.currentTarget.style.boxShadow = "none" }}>
      <span className="absolute left-0 top-0 rounded-br-[4px] rounded-tl-[5px] px-[10px] py-[5px] text-[10px] font-extrabold tracking-[0.3px] text-white" style={{ background: "#7B5EA7" }}>PICK</span>
      <span className="mb-[8px] mt-[6px] block text-[11px] font-bold text-[#7B5EA7]">{label} — {sub}</span>
      <h3 className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.4px] text-[#1A1626] group-hover:text-[#C94B6E]">{it.name}</h3>
      {summary && <p className="mt-[8px] max-w-[660px] text-[13px] leading-[1.6] text-[#5A5568]">{summary}</p>}
      <div className="mt-[12px] flex flex-wrap items-center gap-2">
        {it.company && <span className="rounded-[7px] px-2 py-[2px] text-[10.5px] font-bold" style={{ background: col.bg, color: col.c }}>{it.company}</span>}
        {it.tags.slice(0, 3).map((t) => <span key={t} className="rounded-[7px] border px-2 py-[2px] text-[10.5px] text-[#6E6A78]" style={{ borderColor: "#E4E1EE" }}>{t}</span>)}
        {it.date && <span className="text-[11px] text-[#9E97B3]">{it.date}</span>}
      </div>
    </a>
  )
}

/* ── 재사용: 기사 섹션(탭 + 목록). 혼합 페이지 하단에도 삽입.
 *    base = 데이터 그룹 경로(public/<base>/{entities,icons,pages}.json). 기본 "cases", Research는 "research". ── */
export function CasesArticleList({ page, kind, header, sectionTitle, base = "cases", featured }: { page: string; kind?: string; header?: boolean; sectionTitle?: string; base?: string; featured?: boolean }) {
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

  // 대표 픽 — 페이지 기준(FEATURED_CFG): 최신 연도 중 요약·인기주제·인지도 점수로 1개
  const featuredItem = useMemo(() => {
    const fcfg = FEATURED_CFG[page]
    if (!featured || !fcfg || !items || !items.length) return null
    const yearOf = (it: CaseItem) => Number((it.date || "").match(/\d{4}/)?.[0]) || 0
    const maxYear = items.reduce((m, it) => Math.max(m, yearOf(it)), 0)
    const pool = maxYear ? items.filter((it) => yearOf(it) === maxYear) : items
    const score = (it: CaseItem) => {
      let s = 0
      if (it.summary && it.summary.trim().length > 40) s += 5
      if (fcfg.trending && fcfg.trending.test(`${it.domain} ${it.name} ${it.tags.join(" ")}`)) s += 3
      if (fcfg.notable && it.company && fcfg.notable.has(it.company)) s += 2
      if (fcfg.prominent && fcfg.prominent.test(it.name)) s += 4
      return s
    }
    return pool.slice().sort((a, b) => score(b) - score(a))[0] ?? null
  }, [featured, items, page])

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

      {/* 대표 픽 (Featured Read/Paper) — 맨 위 */}
      {featured && featuredItem && icons && FEATURED_CFG[page] && (
        <FeaturedRead it={featuredItem} col={colorOf.get(sectorOf(featuredItem.domain)) ?? icons.neutral}
          label={FEATURED_CFG[page].label} sub={FEATURED_CFG[page].sub} />
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
      <CasesArticleList page={page} header featured />
      <div className="h-8" aria-hidden />
    </div>
  )
}
