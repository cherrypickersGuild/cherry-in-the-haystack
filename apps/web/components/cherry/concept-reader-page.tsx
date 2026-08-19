"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ShoppingCart } from "lucide-react"
import { fetchLearningConcept, type ConceptPage, type ConceptRelationType } from "@/lib/api"

/* 데이터 정본 = DB (API: GET /api/learning/concepts/:key)
   기획: apps/docs/ontology-migration/2-implementation-guide.md §5
   ⚠️ JSON 파일(public/learning/concepts/*.json)은 API 전환으로 폐기됨 */

/** 개념 페이지 발행 여부 → 카드 뱃지 */
type PageStatus = "full" | "outline" | "soon"

/* 관계별 색 — 화면 표기 전용 */
const RELATION_COLOR: Record<ConceptRelationType, string> = {
  SUBTOPIC: "#7B5EA7",
  PREREQUISITE: "#9E97B3",
  EXTENDS: "#2D7A5E",
  RELATED: "#D4854A",
  CONTRADICTS: "#C94B6E",
}

/* pageStatus 뱃지 */
const STATUS_BADGE: Record<PageStatus, { label: string; cls: string }> = {
  full: { label: "FULL", cls: "bg-violet-soft text-violet border-violet-border" },
  outline: { label: "OUTLINE", cls: "bg-secondary text-text-muted border-border" },
  soon: { label: "SOON", cls: "bg-cherry-soft text-cherry border-cherry-border" },
}

/* ─────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────── */
export function ConceptReaderPage({
  slug = "rag",
  onBuyOnMarket,
  onOpenConcept,
}: {
  slug?: string
  onBuyOnMarket?: (conceptId: string) => void
  onOpenConcept?: (slug: string) => void
}) {
  const [doc, setDoc] = useState<ConceptPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setDoc(null)
    setError(null)
    fetchLearningConcept(slug)
      .then((d) => alive && setDoc(d))
      .catch((e) => alive && setError(String(e?.message ?? e)))
    return () => {
      alive = false
    }
  }, [slug])

  if (error) {
    return (
      <div style={{ maxWidth: "700px" }}>
        <p className="text-[13px] text-text-muted">
          Concept <span className="font-semibold text-text-primary">{slug}</span> could not be loaded ({error}).
        </p>
      </div>
    )
  }
  if (!doc) {
    return <div style={{ maxWidth: "700px" }}><p className="text-[13px] text-text-muted">Loading…</p></div>
  }

  const sectionLabel = doc.section === "BASICS" ? "Basics" : "Advanced"

  return (
    <div className="flex flex-col -m-4 -mx-4 lg:-m-8 lg:-mx-10">
      {/* 2-column content (left reading + right panel) */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:overflow-hidden">
        {/* Center reading column */}
        <main className="flex-1 overflow-y-auto px-5 py-6 lg:px-12 lg:py-10" style={{ maxWidth: "700px" }}>
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted mb-3">
            <span>Learning</span>
            <span className="text-border">›</span>
            <span>{sectionLabel}</span>
            <span className="text-border">›</span>
            <span className="text-text-primary font-semibold">{doc.title.length > 18 ? doc.menuLabel : doc.title}</span>
          </div>

          {/* Section badge */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-soft text-violet mb-3">
            {sectionLabel}
          </span>

          {/* Title */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-[20px] lg:text-[28px] font-extrabold text-text-primary tracking-[-0.5px] leading-[1.2]">
              {doc.title}
            </h1>
            {onBuyOnMarket && (
              <button
                onClick={() => onBuyOnMarket(doc.slug)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--cherry)] text-white text-[12px] font-semibold hover:bg-[#B13E5F] transition-colors cursor-pointer"
                title="Buy this concept on the Knowledge Market"
              >
                <ShoppingCart size={13} />
                Buy on Market
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted mb-8">
            <span>Updated {doc.meta.updated ?? "—"}</span>
            <span className="text-border">·</span>
            <span>{doc.cherries.length} cherries</span>
            <span className="text-border">·</span>
            {doc.meta.verified ? (
              <span>Knowledge Team verified</span>
            ) : (
              <span className="text-[#D4854A] font-semibold">Draft — pending review</span>
            )}
            <span className="text-border">·</span>
            <span className="text-text-muted">via {doc.meta.source}</span>
          </div>

          {/* Section 01 — Overview */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                01 — Overview
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-4 text-[14px] text-text-body leading-[1.75]">
              {(doc.overview.body ?? doc.overview.definition ?? "")
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i}>{para.replace(/\*\*/g, "")}</p>
                ))}
              {!doc.overview.body && !doc.overview.definition && (
                <p className="text-text-muted">No overview published yet.</p>
              )}
            </div>
          </section>

          {/* Section 02 — Cherries */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                02 — Cherries
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              Key insights from ingested sources — each covers a distinct, non-overlapping aspect
            </p>

            {doc.cherries.length === 0 && (
              <p className="text-[12px] text-text-muted">No evidence linked yet.</p>
            )}
            <div className="space-y-2.5">
              {doc.cherries.map((cherry, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-[8px] p-4"
                  style={{ borderLeftWidth: "3px", borderLeftColor: "#C94B6E" }}
                >
                  <p className="text-[12px] font-bold text-text-primary mb-1 flex items-center gap-1.5">
                    <span>🍒</span>
                    {cherry.source}
                    {cherry.author && <span className="font-normal text-text-muted">— {cherry.author}</span>}
                  </p>
                  <p className="text-[10px] text-text-muted mb-2 pl-[20px]">
                    {cherry.locator}
                    {!cherry.curated && <span className="ml-1.5 italic">· raw excerpt</span>}
                  </p>
                  <p className="text-[12px] text-text-muted leading-[1.6]">{cherry.insight}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 03 — Child Concepts */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                03 — Child Concepts
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              Follow any concept to keep reading — every concept is its own page
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {doc.childConcepts.map((concept, i) => {
                const status: PageStatus = concept.hasPage ? "full" : "outline"
                const badge = STATUS_BADGE[status]
                /* 온톨로지에 있는 개념은 전부 열린다 — 발행 여부는 뱃지로만 구분.
                   미발행이면 온톨로지 설명 기반 개요 페이지가 자동 생성된다. */
                const clickable = !!onOpenConcept
                return (
                  <button
                    key={i}
                    disabled={!clickable}
                    onClick={() => clickable && onOpenConcept!(concept.node)}
                    className={cn(
                      "relative bg-card border rounded-[8px] p-3 pr-14 text-left transition-colors",
                      clickable ? "cursor-pointer hover:border-cherry" : "cursor-default",
                      !concept.hasPage && "border-dashed",
                      concept.hasPage ? "border-violet-border" : "border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide border",
                        badge.cls,
                      )}
                    >
                      {badge.label}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: RELATION_COLOR[concept.relation] }}
                    >
                      {concept.relation}
                    </span>
                    <p className="text-[13px] font-semibold text-text-primary mt-0.5">{concept.label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{concept.why}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 04 — Progressive References */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                04 — Progressive References
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              MECE learning path — each reference adds what the previous didn&apos;t cover
            </p>

            {doc.references.length === 0 && (
              <p className="text-[12px] text-text-muted">No reading path published yet.</p>
            )}
            <div className="space-y-4">
              {doc.references.map((ref, i) => {
                const first = i === 0
                const borderColor = first ? "#C94B6E" : "#E4E1EE"
                return (
                  <div key={i} className="pl-4 relative" style={{ borderLeft: `2px solid ${borderColor}` }}>
                    <div
                      className="absolute left-[-5px] top-0 w-2 h-2 rounded-full"
                      style={{ backgroundColor: borderColor }}
                    />
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide"
                      style={{ color: first ? "#C94B6E" : "#9E97B3" }}
                    >
                      {ref.stage}
                    </span>
                    <p className="text-[13px] font-bold text-text-primary mt-0.5">{ref.title}</p>
                    <p className="text-[12px] text-text-muted leading-[1.5] mt-1">
                      <strong className="text-text-secondary">What you&apos;ll learn:</strong> {ref.teaches}
                    </p>
                    <p className="text-[11px] italic text-violet mt-1">Adds: {ref.addsOverPrevious}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {ref.inLibrary ? "📚 In our library" : "🔗 External"}
                      {ref.byline ? ` — ${ref.byline}` : ""}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        </main>

        {/* Right panel */}
        <aside className="w-full lg:w-[280px] lg:flex-shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border px-4 py-5">
          {/* Learning Roadmap card */}
          <div className="bg-card border border-border rounded-[12px] p-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Learning Roadmap
            </p>
            <ConceptRoadmap doc={doc} />
            <div className="space-y-1 text-[9px] text-text-muted mt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border-2 border-cherry bg-white" />
                <span>Cherry = You are here</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border-2 border-violet-border bg-violet-soft" />
                <span>Violet = Go deeper</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border border-dashed border-violet-border bg-violet-soft" />
                <span>Dashed = Outline only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border border-border bg-secondary" />
                <span>Gray = Prerequisite</span>
              </div>
            </div>
          </div>

          {/* Contributors card — 데이터는 handbook.knowledge_verification_contributor.
              지금 0행이라 자리표시자로 형태만 유지한다(지어내지 않음). */}
          <div className="bg-card border border-border rounded-[12px] p-3.5 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Knowledge Team
            </p>
            {doc.meta.contributors.length > 0 ? (
              <div className="space-y-2.5">
                {doc.meta.contributors.map((c) => (
                  <div key={c.handle} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary">
                      {c.initials}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">{c.handle}</p>
                      {c.role && <p className="text-[10px] text-text-muted">{c.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 opacity-45">
                    <div className="w-7 h-7 rounded-full border border-dashed border-border" />
                    <div>
                      <p className="text-[12px] text-text-muted">—</p>
                      <p className="text-[10px] text-text-muted">Not assigned</p>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-text-muted pt-1">No reviewer recorded yet.</p>
              </div>
            )}
          </div>

          {/* Source card */}
          <div className="bg-card border border-border rounded-[12px] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-2">
              Ontology
            </p>
            <p className="text-[12px] font-mono text-text-primary">{doc.node}</p>
            {doc.aliases.length > 0 && (
              <p className="text-[10px] text-text-muted mt-1">also: {doc.aliases.join(", ")}</p>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Learning Roadmap — 전부 데이터에서 자동 생성 (고정 슬롯·자르기 없음)
   · 상자 너비 = 이름 길이에 맞춰 늘어남
   · 한 줄에 안 들어가면 줄바꿈 (공백 · camelCase 경계에서 끊음)
   · 줄 수만큼 상자 높이가 늘고, 전체 높이도 다시 계산
   별도 데이터 없음: childConcepts 하나로 그린다.
───────────────────────────────────────────── */
const ROADMAP_BANDS: { title: string; rel: ConceptRelationType[]; pos: "above" | "below" }[] = [
  { title: "Prerequisites", rel: ["PREREQUISITE"], pos: "above" },
  { title: "Go deeper", rel: ["SUBTOPIC", "EXTENDS"], pos: "below" },
  { title: "Related", rel: ["RELATED", "CONTRADICTS"], pos: "below" },
]

const RM = {
  W: 200, PAD: 4, GAP: 6,
  /* 글자 크기 — 사이드 패널에서 읽히도록 키움 */
  FS: 11, CHAR_W: 0.56, PAD_X: 9, LINE_H: 14, CHIP_PAD_Y: 9,
  ROW_GAP: 7, BAND_LABEL_H: 22, BAND_FS: 10, BAND_GAP: 18,
  SELF_MIN_W: 96, SELF_FS: 15, SELF_MIN_FS: 10, SELF_PAD_X: 12, SELF_PAD_Y: 12,
  CHIP_MIN_FS: 8, ARROW: 22,
} as const

/** 끊어도 되는 위치: 공백 앞뒤 + camelCase 경계 */
function breakPoints(s: string): number[] {
  const idx: number[] = []
  for (let i = 1; i < s.length; i++) {
    if (s[i] === " ") idx.push(i)
    else if (/[a-z0-9]/.test(s[i - 1]) && /[A-Z]/.test(s[i])) idx.push(i)
  }
  return idx
}

/** 주어진 폭에 글자를 맞춘다: ①그대로 → ②폰트 축소 → ③줄바꿈. 절대 잘리지 않는다. */
function fitText(label: string, maxTextW: number, maxFS: number, minFS: number) {
  const w = (t: string, fs: number) => t.length * fs * RM.CHAR_W
  if (w(label, maxFS) <= maxTextW) return { lines: [label], fs: maxFS }
  /* 폰트를 줄여서 한 줄에 들어가면 그렇게 */
  const needed = maxTextW / (label.length * RM.CHAR_W)
  if (needed >= minFS) return { lines: [label], fs: Math.floor(needed * 10) / 10 }
  /* 그래도 안 되면 최소 폰트로 줄바꿈 */
  const lines = wrapLabelAt(label, maxTextW, minFS)
  return { lines, fs: minFS }
}

/** 임의 폰트 크기 기준 줄바꿈 */
function wrapLabelAt(label: string, maxTextW: number, fs: number): string[] {
  const w = (t: string) => t.length * fs * RM.CHAR_W
  if (w(label) <= maxTextW) return [label]
  const bps = breakPoints(label)
  const lines: string[] = []
  let start = 0
  while (start < label.length) {
    const rest = label.slice(start)
    if (w(rest) <= maxTextW) { lines.push(rest.trim()); break }
    const cand = bps.filter((b) => b > start && w(label.slice(start, b)) <= maxTextW)
    if (cand.length === 0) {
      const n = Math.max(1, Math.floor(maxTextW / (fs * RM.CHAR_W)))
      lines.push(label.slice(start, start + n).trim())
      start += n
    } else {
      const b = cand[cand.length - 1]
      lines.push(label.slice(start, b).trim())
      start = b
    }
  }
  return lines.filter(Boolean)
}

interface Chip { node: string; label: string; hasPage: boolean; lines: string[]; w: number; h: number; fs: number }

function ConceptRoadmap({ doc }: { doc: ConceptPage }) {
  const inner = RM.W - RM.PAD * 2

  /** 이름 길이에 맞춰 상자 크기 결정 (넘치면 줄바꿈) */
  const makeChip = (c: ConceptPage["childConcepts"][number]): Chip => {
    const maxTextW = inner - RM.PAD_X * 2
    const { lines, fs } = fitText(c.label, maxTextW, RM.FS, RM.CHIP_MIN_FS)
    const widest = Math.max(...lines.map((l) => l.length * fs * RM.CHAR_W))
    const w = Math.min(inner, widest + RM.PAD_X * 2)
    const h = lines.length * (fs + 3) + RM.CHIP_PAD_Y * 2
    return { node: c.node, label: c.label, hasPage: c.hasPage, lines, w, h, fs }
  }

  /** 흐름 배치 — 폭이 남으면 옆에, 모자라면 다음 줄로 */
  const flow = (chips: Chip[]) => {
    const rows: Chip[][] = []
    let cur: Chip[] = [], used = 0
    for (const ch of chips) {
      const need = ch.w + (cur.length ? RM.GAP : 0)
      if (cur.length && used + need > inner) { rows.push(cur); cur = [ch]; used = ch.w }
      else { cur.push(ch); used += need }
    }
    if (cur.length) rows.push(cur)
    return rows
  }

  const bands = ROADMAP_BANDS.map((b) => {
    const chips = doc.childConcepts.filter((c) => b.rel.includes(c.relation)).map(makeChip)
    const rows = flow(chips)
    const h = chips.length
      ? RM.BAND_LABEL_H +
        rows.reduce((s, r) => s + Math.max(...r.map((c) => c.h)), 0) +
        Math.max(0, rows.length - 1) * RM.ROW_GAP
      : 0
    return { ...b, rows, h, count: chips.length }
  }).filter((b) => b.count > 0)

  const above = bands.filter((b) => b.pos === "above")
  const below = bands.filter((b) => b.pos === "below")
  const sum = (l: typeof bands) => l.reduce((s, b) => s + b.h, 0) + Math.max(0, l.length - 1) * RM.BAND_GAP
  /* 중앙 상자도 이름에 맞춰 자동: 폭 확장 → 폰트 축소 → 줄바꿈 */
  const selfFit = fitText(doc.node, inner - RM.SELF_PAD_X * 2, RM.SELF_FS, RM.SELF_MIN_FS)
  const selfTextW = Math.max(...selfFit.lines.map((l) => l.length * selfFit.fs * RM.CHAR_W))
  const selfW = Math.min(inner, Math.max(RM.SELF_MIN_W, selfTextW + RM.SELF_PAD_X * 2))
  const selfH = selfFit.lines.length * (selfFit.fs + 4) + RM.SELF_PAD_Y * 2
  const selfBlock = selfH + 20
  const H = RM.PAD * 2 + (above.length ? sum(above) + RM.ARROW : 0) + selfBlock +
            (below.length ? sum(below) + RM.ARROW : 0)

  const drawBand = (b: (typeof bands)[number], top: number) => {
    let y = top + RM.BAND_LABEL_H
    return (
      <g key={b.title}>
        <text x={RM.W / 2} y={top + 11} textAnchor="middle" fontSize={RM.BAND_FS}
              fontWeight="700" letterSpacing="0.5" fill="#9E97B3">
          {b.title.toUpperCase()}
        </text>
        {b.rows.map((row, ri) => {
          const rowH = Math.max(...row.map((c) => c.h))
          const rowW = row.reduce((s, c) => s + c.w, 0) + (row.length - 1) * RM.GAP
          let x = (RM.W - rowW) / 2      /* 가운데 정렬 */
          const cells = row.map((c) => {
            const cx = x; x += c.w + RM.GAP
            const isPrereq = b.pos === "above"
            return (
              <g key={c.node}>
                <rect x={cx} y={y} width={c.w} height={c.h} rx="7"
                      fill={isPrereq ? "#F2F0F7" : "#F3EFFA"}
                      stroke={isPrereq ? "#E4E1EE" : "#C7B8E8"}
                      strokeDasharray={c.hasPage ? undefined : "3"} />
                {c.lines.map((ln, li) => (
                  <text key={li} x={cx + c.w / 2}
                        y={y + RM.CHIP_PAD_Y + (c.fs + 3) * li + c.fs}
                        textAnchor="middle" fontSize={c.fs}
                        fill={isPrereq ? "#6B6480" : "#7B5EA7"}>
                    {ln}
                  </text>
                ))}
              </g>
            )
          })
          y += rowH + (ri < b.rows.length - 1 ? RM.ROW_GAP : 0)
          return <g key={ri}>{cells}</g>
        })}
      </g>
    )
  }

  const arrow = (y: number, dashed: boolean) => (
    <g key={`a${y}`}>
      <line x1={RM.W / 2} y1={y} x2={RM.W / 2} y2={y + RM.ARROW - 7}
            stroke="#D9D4E8" strokeWidth="2" strokeDasharray={dashed ? "4" : undefined} />
      <polygon points={`${RM.W / 2 - 5},${y + RM.ARROW - 8} ${RM.W / 2 + 5},${y + RM.ARROW - 8} ${RM.W / 2},${y + RM.ARROW}`}
               fill="#D9D4E8" />
    </g>
  )

  const parts: React.ReactNode[] = []
  let y = RM.PAD
  above.forEach((b, i) => { parts.push(drawBand(b, y)); y += b.h + (i < above.length - 1 ? RM.BAND_GAP : 0) })
  if (above.length) { parts.push(arrow(y, false)); y += RM.ARROW }

  parts.push(
    <g key="self">
      <rect x={(RM.W - selfW) / 2} y={y} width={selfW} height={selfH} rx="8"
            fill="white" stroke="#C94B6E" strokeWidth="2" />
      {selfFit.lines.map((ln, i) => (
        <text key={i} x={RM.W / 2}
              y={y + RM.SELF_PAD_Y + (selfFit.fs + 4) * i + selfFit.fs}
              textAnchor="middle" fontSize={selfFit.fs} fontWeight="700" fill="#C94B6E">
          {ln}
        </text>
      ))}
      <text x={RM.W / 2} y={y + selfH + 14} textAnchor="middle" fontSize="10" fill="#9E97B3">
        (you are here)
      </text>
    </g>,
  )
  y += selfBlock
  if (below.length) { parts.push(arrow(y, true)); y += RM.ARROW }
  below.forEach((b, i) => { parts.push(drawBand(b, y)); y += b.h + (i < below.length - 1 ? RM.BAND_GAP : 0) })

  return <svg viewBox={`0 0 ${RM.W} ${Math.ceil(H)}`} className="w-full h-auto">{parts}</svg>
}
