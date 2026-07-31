"use client"

import { useEffect, useMemo, useState } from "react"

/**
 * Cases 페이지 — 실제 AI 활용 사례.
 * 데이터: /cases/entities.json (실제 큐레이션 소스 3곳에서 수집, 전부 원문 링크 有)
 * 구성: 카테고리 탭(Case Studies / Domain Applications / Product Discovery) → 도메인 섹션 → 링크 카드
 * 기획서: apps/docs/cases-data-and-page-plan.md
 */

type CaseItem = {
  id: string
  category: string
  domain: string
  name: string
  company: string | null
  description: string
  outcome: string | null
  tags: string[]
  source_type: string
  url: string
  date: string | null
  verified: boolean
  source: string
}
type Payload = { total: number; generatedAt: string; sources: string[]; items: CaseItem[] }

const CATS: { key: string; label: string }[] = [
  { key: "case-studies", label: "Case Studies" },
  { key: "domain-applications", label: "Domain Applications" },
  { key: "product-discovery", label: "Product Discovery" },
]

/* 도메인 섹션마다 다른 색 (Engineering / Best 페이지와 동일 8색 팔레트) */
type Col = { c: string; bg: string }
const PALETTE: Col[] = [
  { c: "#4B78F0", bg: "#EEF2FD" },
  { c: "#2E8B6F", bg: "#E7F4EF" },
  { c: "#7C3AED", bg: "#F3EFFA" },
  { c: "#0194E2", bg: "#E6F4FD" },
  { c: "#D4854A", bg: "#FEF3E2" },
  { c: "#5B3D87", bg: "#F3EFFA" },
  { c: "#C94B6E", bg: "#FDF0F3" },
  { c: "#DC2626", bg: "#FDECEC" },
]

/* 도메인 테마 → 이모지 풀. 항목마다 이름 해시로 풀에서 골라 카드별로 다르게(Frameworks pickEmoji 방식). */
const THEME_POOLS: [RegExp, string[]][] = [
  [/health|medic|clinical|patient|pharma|biotech|diagnos/, ["🏥", "💊", "🩺", "🧬", "🩻", "🧪", "🫀", "🦠"]],
  [/financ|fintech|bank|trading|invest|insurance|payment|credit/, ["💰", "💳", "📈", "🏦", "💵", "🪙", "📊", "🧾"]],
  [/educat|learn|academia|tutor|school|student|course/, ["🎓", "📚", "✏️", "🧑‍🏫", "📖", "🧮", "🖍", "📝"]],
  [/legal|\blaw\b|compliance|privacy|contract|court/, ["⚖️", "📜", "🏛", "🔏", "📝", "🗂", "👨‍⚖️"]],
  [/agricultur|farm|crop|harvest/, ["🌾", "🚜", "🌱", "🥕", "🐄", "🍃", "☀️"]],
  [/energy|grid|power|electric|solar/, ["⚡", "🔋", "🌞", "💡", "🔌", "🏭", "🌬"]],
  [/manufactur|factory|industrial|production/, ["🏭", "⚙️", "🔧", "🛠", "📦", "🤖", "🔩"]],
  [/e-?commerce|retail|shopping|store/, ["🛒", "🛍", "🏬", "💳", "📦", "🏷", "🧾"]],
  [/deliver|mobility|transport|logistic|supply|driving|route|fleet/, ["🚚", "📦", "🗺", "🛵", "🚛", "🧭", "📍"]],
  [/social|network|community|feed/, ["💬", "👥", "📱", "❤️", "🔔", "📢", "🫂"]],
  [/media|streaming|entertain|content/, ["🎬", "📺", "🍿", "🎞", "📸", "🎙", "🎭"]],
  [/gaming|game|player/, ["🎮", "🕹", "👾", "🎲", "🏆", "🎯"]],
  [/travel|hospitality|tourism|hotel/, ["✈️", "🏨", "🗺", "🧳", "🏖", "🗽", "🧭"]],
  [/security|cyber|threat|fraud/, ["🔒", "🛡", "🔑", "🚨", "🕵️", "🔐", "⚠️"]],
  [/customer service|support|helpdesk/, ["🎧", "💬", "📞", "🤝", "🛎", "✉️"]],
  [/human resource|recruit|\bhr\b|career|hiring|job/, ["👥", "📋", "🧑‍💼", "🤝", "📄", "🎯"]],
  [/real estate|property|housing/, ["🏠", "🏢", "🔑", "📍", "🏘", "📐"]],
  [/music|audio track/, ["🎵", "🎶", "🎧", "🎹", "🎤", "🥁"]],
  [/writing|copywrit|content generat/, ["✍️", "📝", "📄", "✒️", "📰", "🖋"]],
  [/image|design|graphic/, ["🎨", "🖼", "🖌", "✨", "📐", "🖍"]],
  [/video/, ["🎥", "🎞", "📹", "🎬", "📽", "🎦"]],
  [/audio|voice|speech/, ["🎙", "🔊", "🗣", "🎧", "📢", "🔈"]],
  [/productivity/, ["📋", "✅", "🗓", "📌", "⏱", "🧷"]],
  [/chatbot|assistant|conversation/, ["🤖", "💬", "🧠", "✨", "🗨", "💡"]],
  [/software|\btech\b|developer|engineering|code/, ["💻", "⌨️", "🖥", "🔌", "🧑‍💻", "🧩", "🛠"]],
]
const CAT_POOL: Record<string, string[]> = {
  "case-studies": ["📄", "📊", "🔬", "🧩", "💡", "📈", "🗂", "🧠"],
  "domain-applications": ["🧩", "🌐", "🎯", "🛠", "💡", "📌", "🧭"],
  "product-discovery": ["✨", "🚀", "💡", "🧩", "🪄", "🎁", "🌟"],
}
/** 항목별 이모지 — 도메인 테마 풀에서 이름 해시로 골라 카드마다 다르게 (Frameworks pickEmoji 방식) */
function pickCaseEmoji(name: string, domain: string, category: string): string {
  const d = domain.toLowerCase()
  let pool: string[] | undefined
  for (const [re, p] of THEME_POOLS) {
    if (re.test(d)) { pool = p; break }
  }
  if (!pool) pool = CAT_POOL[category] ?? ["•"]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

/** 도메인 정규화 — 원본이 "Travel,E-commerce and retail" 처럼 다중산업이면 대표(첫) 산업만 */
const normDomain = (d: string) => (d.split(",")[0].trim() || d)

const PREVIEW = 8

/* ── 케이스 카드 (이모지 타일 + 내용, 원문 링크) ── */
function CaseCard({ it, col }: { it: CaseItem; col: Col }) {
  return (
    <a
      href={it.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-stretch gap-3 rounded-[12px] border bg-white p-3 no-underline transition-all"
      style={{ borderColor: "#E4E1EE" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#C7B8E8"
        e.currentTarget.style.boxShadow = "0 6px 18px rgba(91,61,135,.10)"
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E4E1EE"
        e.currentTarget.style.boxShadow = "none"
        e.currentTarget.style.transform = "none"
      }}
    >
      {/* 이모지 타일 — 카드 폭의 1/3, 이모지가 타일을 채우게 크게 (BB 이미지처럼) */}
      <span
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border leading-none"
        style={{ width: "33%", maxWidth: 88, aspectRatio: "1 / 1", background: col.bg, borderColor: "#E4E1EE", fontSize: 48 }}
      >
        {pickCaseEmoji(it.name, normDomain(it.domain), it.category)}
      </span>

      {/* 내용 — Building Blocks EntityCard와 동일 구조 (이름 / 설명 / 하단 메타). 도메인은 섹션 헤더에 있으므로 카드엔 안 넣음(중복 제거) */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 pt-[1px]">
        <span className="truncate text-[13.5px] font-bold text-[#1A1626] group-hover:text-[#C94B6E]">
          {it.name}
        </span>
        {it.description && (
          <span
            className="text-[11.5px] leading-[1.45] text-[#6E6A78]"
            style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {it.description}
          </span>
        )}
        {/* 하단 메타 = BB의 (★스타 + vendor) 자리. 스타가 없으니 그 자리에 색상 태그, vendor 자리엔 회사 */}
        <span className="mt-auto flex items-center gap-[5px] text-[10.5px] text-[#9E97B3]">
          {it.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="flex-shrink-0 rounded-[6px] px-[6px] py-[1px] text-[9.5px] font-bold"
              style={{ background: col.bg, color: col.c }}
            >
              {t}
            </span>
          ))}
          {it.company && <span className="truncate">{it.company}</span>}
        </span>
      </span>
    </a>
  )
}

/* ── 도메인 섹션 (미리보기 + 펼치기) — Building Blocks CategorySection과 동일 형식 ── */
function DomainSection({ domain, items, category, col }: { domain: string; items: CaseItem[]; category: string; col: Col }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, PREVIEW)
  const hasMore = items.length > PREVIEW

  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-[9px]">
        {/* 섹션 대표 아이콘 (도메인 기준 고정) — BB 섹션 헤더와 동일 */}
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[14px]"
          style={{ background: col.bg, color: col.c }}
        >
          {pickCaseEmoji(domain, domain, category)}
        </span>
        <span className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1626]">{domain}</span>
        <span className="rounded-[9px] bg-[#F3F1F6] px-2 py-[2px] text-[10.5px] font-bold text-[#9E97B3]">
          {items.length}
        </span>
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
        {shown.map((it) => (
          <CaseCard key={it.id} it={it} col={col} />
        ))}
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed bg-transparent p-3 transition-all"
            style={{ borderColor: "#C7B8E8", color: "#7B5EA7", minHeight: 112 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F3EFFA"
              e.currentTarget.style.borderColor = "#7B5EA7"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.borderColor = "#C7B8E8"
            }}
          >
            <span className="text-[20px] font-extrabold leading-none">+{items.length - PREVIEW}</span>
            <span className="text-[12px] font-semibold">more {domain.toLowerCase()}</span>
            <span className="text-[11px] text-[#9E97B3]">Click to show all</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function NDCasesPage({ initialCategory = "case-studies" }: { initialCategory?: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState(false)
  const [active, setActive] = useState(initialCategory)

  // 메뉴 항목(Case Studies/Domain Applications/Product Discovery) 전환 시 탭도 따라가게.
  // (같은 컴포넌트라 리마운트 안 되므로 prop 변경을 반영해야 함)
  useEffect(() => { setActive(initialCategory) }, [initialCategory])

  useEffect(() => {
    fetch("/cases/entities.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((j: Payload) => setData(j))
      .catch(() => setError(true))
  }, [])

  const countOf = (k: string) => data?.items.filter((x) => x.category === k).length ?? 0

  // 활성 카테고리 → 도메인별 그룹 (도메인 큰 순, 각 도메인 내 최신순)
  const domainGroups = useMemo(() => {
    if (!data) return []
    const inCat = data.items.filter((x) => x.category === active)
    const map = new Map<string, CaseItem[]>()
    for (const it of inCat) {
      const dom = normDomain(it.domain)
      if (!map.has(dom)) map.set(dom, [])
      map.get(dom)!.push(it)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0))
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [data, active])

  if (error) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 className="mb-2 text-[26px] font-extrabold text-[#1A1626]">Cases - Building Blocks</h1>
        <p className="text-[13.5px] text-[#6E6A78]">Failed to load data.</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1000px]">
      <h1 className="mb-[2px] text-[26px] font-extrabold tracking-[-0.4px] text-[#1A1626]">Cases - Building Blocks</h1>
      <p className="mb-[18px] max-w-[780px] text-[14px] leading-[1.7] text-[#6E6A78]">
        Real-world AI in production — company case studies, domain applications, and product solutions.
        Every entry links to the original source.
      </p>

      {/* 요약 */}
      <div className="mb-[22px] flex flex-wrap gap-[10px]">
        <div className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
          <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">
            {data ? data.total.toLocaleString() : "—"}
          </b>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">Total</span>
        </div>
        {CATS.map((c) => (
          <div key={c.key} className="min-w-[104px] rounded-[10px] border bg-white px-[14px] py-[10px]" style={{ borderColor: "#E4E1EE" }}>
            <b className="block text-[19px] font-extrabold leading-[1.2] text-[#1A1626]">{countOf(c.key)}</b>
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#9E97B3]">{c.label}</span>
          </div>
        ))}
      </div>

      {/* 카테고리 탭 (원래 언더라인 스타일) */}
      <div className="mb-5 flex flex-wrap gap-[6px] border-b" style={{ borderColor: "#E4E1EE" }}>
        {CATS.map((c) => {
          const on = c.key === active
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(c.key)}
              className="-mb-px flex cursor-pointer items-center gap-[7px] border-0 border-b-2 bg-transparent px-[14px] py-[9px] text-[13.5px] font-semibold transition-colors"
              style={{
                color: on ? "#C94B6E" : "#9E97B3",
                borderBottomColor: on ? "#C94B6E" : "transparent",
                borderBottomStyle: "solid",
              }}
            >
              {c.label}
              <span
                className="rounded-[9px] px-[7px] py-[1px] text-[10.5px] font-bold"
                style={{ background: on ? "#FDF0F3" : "#F3F1F6", color: on ? "#C94B6E" : "#6B6577" }}
              >
                {countOf(c.key)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 도메인별 목록 */}
      {!data && <p className="text-[13px] text-[#9E97B3]">Loading…</p>}
      {data && domainGroups.length === 0 && (
        <p className="text-[13px] text-[#9E97B3]">No entries in this category.</p>
      )}
      {domainGroups.map(([domain, items], idx) => (
        <DomainSection
          key={domain}
          domain={domain}
          items={items}
          category={active}
          col={PALETTE[idx % PALETTE.length]}
        />
      ))}
    </div>
  )
}
