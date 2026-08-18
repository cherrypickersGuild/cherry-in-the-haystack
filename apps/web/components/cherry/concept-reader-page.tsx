"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ShoppingCart } from "lucide-react"

/* ─────────────────────────────────────────────
   Concept JSON 스키마
   정본: apps/web/public/learning/concepts/<slug>.json
   (기획: apps/docs/learning/2-implementation-guide.md §2)
───────────────────────────────────────────── */
export type ConceptRelation = "SUBTOPIC" | "PREREQUISITE" | "EXTENDS" | "RELATED" | "CONTRADICTS"
export type PageStatus = "full" | "outline" | "soon"

export interface ConceptDoc {
  slug: string
  section: "BASICS" | "ADVANCED"
  title: string
  menuLabel: string
  uiTopicId: string
  ontology: { node: string | null; status: string; parents: string[] }
  meta: {
    updated: string
    readingMinutes: number
    verified: boolean
    contributors: { handle: string; initials: string; role: string }[]
    extraContributors?: number
  }
  overview: { definition: string; whyItMatters: string; context: string }
  cherries: { source: string; author: string | null; locator: string; chunkId: string | null; insight: string }[]
  childConcepts: {
    label: string; ontologyNode: string | null; relation: ConceptRelation
    pageStatus: PageStatus; slug: string | null; why: string
  }[]
  references: {
    order: number; stage: string; title: string; url: string | null
    inLibrary: boolean; byline: string | null; teaches: string; addsOverPrevious: string
  }[]
}

/* 관계별 색 — 화면 표기 전용 */
const RELATION_COLOR: Record<ConceptRelation, string> = {
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
  const [doc, setDoc] = useState<ConceptDoc | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setDoc(null)
    setError(null)
    fetch(`/learning/concepts/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ConceptDoc) => alive && setDoc(d))
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
            <span className="text-text-primary font-semibold">{doc.menuLabel}</span>
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
            <span>Updated {doc.meta.updated}</span>
            <span className="text-border">·</span>
            <span>{doc.cherries.length} cherries</span>
            <span className="text-border">·</span>
            {doc.meta.verified ? (
              <span>Knowledge Team verified</span>
            ) : (
              <span className="text-[#D4854A] font-semibold">Draft — pending review</span>
            )}
            <span className="text-border">·</span>
            <span>{doc.meta.readingMinutes} min read</span>
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
              <p>{doc.overview.definition}</p>
              <p><strong className="text-text-primary">Why it matters:</strong> {doc.overview.whyItMatters}</p>
              <p><strong className="text-text-primary">The shape of the work:</strong> {doc.overview.context}</p>
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
                  <p className="text-[10px] text-text-muted mb-2 pl-[20px]">{cherry.locator}</p>
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
                const badge = STATUS_BADGE[concept.pageStatus]
                const clickable = concept.pageStatus === "full" && concept.slug && onOpenConcept
                return (
                  <button
                    key={i}
                    disabled={!clickable}
                    onClick={() => clickable && onOpenConcept!(concept.slug!)}
                    className={cn(
                      "relative bg-card border rounded-[8px] p-3 pr-14 text-left transition-colors",
                      clickable ? "cursor-pointer hover:border-cherry" : "cursor-default",
                      concept.pageStatus === "soon" && "border-dashed opacity-75",
                      concept.pageStatus === "full" ? "border-violet-border" : "border-border",
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
                    <p className="text-[11px] text-text-muted mt-0.5">{concept.why}</p>
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
                <span>Cherry = Current or full page</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border-2 border-dashed border-violet-border bg-violet-soft" />
                <span>Dashed = Not yet in ontology</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border border-border bg-secondary" />
                <span>Gray = Subtopic</span>
              </div>
            </div>
          </div>

          {/* Contributors card */}
          <div className="bg-card border border-border rounded-[12px] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Knowledge Team
            </p>

            <div className="space-y-2.5">
              {doc.meta.contributors.map((c) => (
                <div key={c.handle} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary">
                    {c.initials}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-primary">{c.handle}</p>
                    <p className="text-[10px] text-text-muted">{c.role}</p>
                  </div>
                </div>
              ))}
            </div>

            {!!doc.meta.extraContributors && (
              <p className="block mt-3 text-[11px] font-medium text-cherry">
                + {doc.meta.extraContributors} contributors
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Learning Roadmap — childConcepts 의 relation 으로 생성
   (별도 데이터 없음: PREREQUISITE=위, EXTENDS=아래)
───────────────────────────────────────────── */
function ConceptRoadmap({ doc }: { doc: ConceptDoc }) {
  const prereq = doc.childConcepts.filter((c) => c.relation === "PREREQUISITE").slice(0, 2)
  const extend = doc.childConcepts.filter((c) => c.relation === "EXTENDS").slice(0, 2)

  return (
    <svg viewBox="0 0 200 220" className="w-full h-auto">
      {/* Current node */}
      <rect x="30" y="10" width="140" height="36" rx="8" fill="white" stroke="#C94B6E" strokeWidth="2" />
      <text x="100" y="32" textAnchor="middle" className="text-[10px] font-bold" fill="#C94B6E">
        {doc.menuLabel}
      </text>
      <text x="100" y="54" textAnchor="middle" className="text-[8px]" fill="#9E97B3">(you are here)</text>

      {prereq.length > 0 && (
        <>
          <line x1="100" y1="46" x2="100" y2="70" stroke="#E4E1EE" strokeWidth="1.5" />
          <polygon points="95,68 105,68 100,76" fill="#E4E1EE" />
          <rect x="15" y="80" width="170" height="44" rx="6" fill="#F2F0F7" stroke="#E4E1EE" strokeWidth="1" />
          <text x="100" y="98" textAnchor="middle" className="text-[9px]" fill="#9E97B3">Prerequisites</text>
          {prereq.map((p, i) => (
            <text
              key={p.label}
              x={prereq.length === 1 ? 100 : i === 0 ? 58 : 142}
              y="114" textAnchor="middle" className="text-[9px] font-medium" fill="#6B6480"
            >
              {p.label.length > 16 ? p.label.slice(0, 15) + "…" : p.label}
            </text>
          ))}
        </>
      )}

      {extend.length > 0 && (
        <>
          <line x1="100" y1="124" x2="100" y2="148" stroke="#E4E1EE" strokeWidth="1.5" strokeDasharray="4" />
          <polygon points="95,146 105,146 100,154" fill="#E4E1EE" />
          <text x="100" y="168" textAnchor="middle" className="text-[8px] font-bold uppercase" fill="#7B5EA7">Extends</text>
          {extend.map((e, i) => (
            <g key={e.label}>
              <rect
                x={extend.length === 1 ? 58 : i === 0 ? 12 : 104} y="175" width={extend.length === 1 ? 84 : 84} height="28" rx="5"
                fill="#F3EFFA" stroke="#C7B8E8" strokeWidth="1"
                strokeDasharray={e.pageStatus === "soon" ? "3" : undefined}
              />
              <text
                x={extend.length === 1 ? 100 : i === 0 ? 54 : 146} y="193" textAnchor="middle"
                className="text-[8px] font-medium" fill="#7B5EA7"
              >
                {e.label.length > 15 ? e.label.slice(0, 14) + "…" : e.label}
              </text>
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
