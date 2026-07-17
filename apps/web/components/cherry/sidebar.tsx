"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Cherry as CherryLucide } from "lucide-react"
import {
  ND_GROUPS,
  ND_UTILITY_IDS,
  getNDItem,
  getNDGroup,
} from "@/lib/nd-taxonomy"

/* ─────────────────────────────────────────────
   목업(apps/docs/mockups/sidebar-mockup.html) 디자인 그대로.
   색상·간격·폰트·아이콘 모두 목업 CSS 값을 사용한다.
───────────────────────────────────────────── */
const C = {
  cherry: "#C94B6E",
  cherrySoft: "#FDF0F3",
  ink: "#3D3652",      // hover text
  muted: "#6B727E",    // default item text
  label: "#9E97B3",    // section label
  hover: "#F9F7F5",
  line: "#E4E1EE",
  stem: "#D5D0E0",     // children 좌측 선
} as const

/* ── 아이콘 — 목업의 인라인 SVG 그대로 (16px, stroke 1.9) ── */
function Ic({ d }: { d: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d}
    </svg>
  )
}

const IC: Record<string, React.ReactNode> = {
  home: <Ic d={<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>} />,
  file: <Ic d={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>} />,
  bag: <Ic d={<><path d="M6 8h12l-1 12H7z" /><path d="M9 8a3 3 0 0 1 6 0" /></>} />,
  trophy: <Ic d={<><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v4" /></>} />,
  overview: <Ic d={<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>} />,
  research: <Ic d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>} />,
  eng: <Ic d={<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2z" />} />,
  cases: <Ic d={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />,
  discourse: <Ic d={<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />} />,
  book: <Ic d={<><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M18 3v16" /></>} />,
  cap: <Ic d={<><path d="M22 9 12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1 3 2.5 6 2.5s6-1.5 6-2.5v-5" /></>} />,
  zap: <Ic d={<path d="M13 2 4 14h7l-1 8 9-12h-7z" />} />,
  archive: <Ic d={<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></>} />,
  compare: <Ic d={<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5V15a3 3 0 0 0 3 3h6M18 15.5V9a3 3 0 0 0-3-3H9" /></>} />,
  track: <Ic d={<path d="M3 12h4l3 8 4-16 3 8h4" />} />,
}

const Chevron = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type ChildItem = { id: string; label: string; badge?: "new" | "warn" }

type Badge = "new" | "warn"

type NavItem = {
  id: string
  ic?: string
  label: string
  star?: boolean
  badge?: Badge
  children?: ChildItem[]
}

/* 목업 .badge / .b-new / .b-warn */
function BadgeChip({ kind }: { kind: Badge }) {
  const isNew = kind === "new"
  return (
    <span
      className="flex-shrink-0"
      style={{
        fontSize: 8.5,
        fontWeight: 700,
        borderRadius: 4,
        padding: "1px 4px",
        letterSpacing: "0.2px",
        background: isNew ? "#E7F4EF" : "#FBF0DE",
        color: isNew ? "#2E8B6F" : "#C7791B",
      }}
    >
      {isNew ? "NEW" : "⚠️"}
    </span>
  )
}

/** taxonomy 항목 → 사이드바 배지.
 *  충돌(⚠️)은 메뉴에 표시하지 않는다 — 기획페이지 안에서만 대조해서 보여준다. */
function badgeOf(id: string): Badge | undefined {
  const item = getNDItem(id)
  if (!item) return undefined
  if (item.isNew) return "new"
  return undefined
}

type SectionDef = {
  id: string
  label: string
  hot?: boolean
  items: NavItem[]
}

/* ─────────────────────────────────────────────
   Navigation data
   NEWLY DISCOVERED + UTILITY 는 lib/nd-taxonomy.ts 단일 소스에서 생성.
   DIGEST / AGENT SHOP / LEARNING 은 기존 그대로.
───────────────────────────────────────────── */
const ND_GROUP_IC: Record<string, string> = {
  research: "research",
  eng: "eng",
  cases: "cases",
  discourse: "discourse",
}
const ND_UTILITY_IC: Record<string, string> = {
  archive: "archive",
  "compare-kb": "compare",
  "change-tracking": "track",
}

const SECTIONS: SectionDef[] = [
  {
    id: "digest",
    label: "DIGEST",
    items: [
      { id: "highlight", ic: "home", label: "This Week's Highlights" },
      { id: "patch-notes", ic: "file", label: "Patch Notes" },
    ],
  },
  {
    id: "agent-shopping",
    label: "AGENT SHOP",
    hot: true,
    items: [
      { id: "kaas-catalog", ic: "bag", label: "Knowledge Market" },
      { id: "kaas-arena", ic: "trophy", label: "Arena" },
    ],
  },
  {
    id: "newly-discovered",
    label: "NEWLY DISCOVERED",
    items: [
      { id: "nd-overview", ic: "overview", label: "Overview", badge: badgeOf("nd-overview") },
      ...ND_GROUPS.map((g) => ({
        id: g.key,
        ic: ND_GROUP_IC[g.key],
        label: g.label,
        star: g.star,
        children: g.children.map((cid) => {
          const item = getNDItem(cid)!
          return { id: item.id, label: item.label, badge: badgeOf(item.id) }
        }),
      })),
    ],
  },
  {
    id: "learning",
    label: "LEARNING",
    items: [
      { id: "concept-reader", ic: "book", label: "Concept Reader" },
      {
        id: "basics",
        ic: "cap",
        label: "Basics",
        children: [
          { id: "foundations",              label: "Foundations of LLM Systems" },
          { id: "prompting-reasoning",      label: "Prompting & Reasoning" },
          { id: "model-selection",          label: "Model Selection & Benchmarking" },
          { id: "context-engineering",      label: "Context Engineering" },
          { id: "rag-systems",              label: "Retrieval-Augmented Systems (RAG)" },
          { id: "knowledge-systems",        label: "Knowledge Systems" },
          { id: "memory",                   label: "Memory Architectures" },
          { id: "agents-reasoning",         label: "Agents & Reasoning Systems" },
          { id: "agent-orchestration",      label: "Agent Orchestration" },
          { id: "tool-use",                 label: "Tool Use & Integration" },
          { id: "system-architecture",      label: "System Architecture & Infrastructure" },
          { id: "performance-optimization", label: "Performance Optimization" },
          { id: "reliability-safety",       label: "Reliability & Safety" },
          { id: "data-engineering",         label: "Data Engineering for LLMs" },
          { id: "multi-agent-systems",      label: "Multi-Agent Systems" },
          { id: "applications",             label: "Applications & Productization" },
          { id: "evaluation-systems",       label: "Evaluation Systems" },
          { id: "failure-modes",            label: "Failure Modes & Debugging" },
          { id: "control-plane",            label: "Control Plane & Protocols" },
          { id: "data-flywheel",            label: "Data Flywheel & Learning Systems" },
          { id: "multimodal",               label: "Multimodal Systems" },
          { id: "codegen-ai-dev",           label: "Code Generation & AI Dev" },
          { id: "security-adversarial",     label: "Security & Adversarial Systems" },
          { id: "human-ai-ux",              label: "Human–AI Interaction & UX" },
        ],
      },
      {
        id: "advanced",
        ic: "zap",
        label: "Advanced",
        children: [
          { id: "chain-of-thought",  label: "Chain-of-Thought" },
          { id: "multi-hop-rag",     label: "Multi-hop RAG" },
          { id: "peft-lora",         label: "PEFT / LoRA / QLoRA" },
          { id: "custom-embeddings", label: "Custom Embeddings" },
          { id: "adversarial-eval",  label: "Adversarial Evaluation" },
          { id: "agent-topologies",  label: "Agent Topologies" },
        ],
      },
    ],
  },
  {
    id: "utility",
    label: "UTILITY",
    items: ND_UTILITY_IDS.map((uid) => {
      const item = getNDItem(uid)!
      return { id: item.id, ic: ND_UTILITY_IC[item.id], label: item.label, badge: badgeOf(item.id) }
    }),
  },
]

/* ─────────────────────────────────────────────
   Cherry Icon (로고) — 기존 export 유지
───────────────────────────────────────────── */
export function CherryIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.cherry, color: "#fff", flexShrink: 0 }}
      aria-label="cherry"
      role="img"
    >
      <CherryLucide size={18} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Item button — 목업 .item
───────────────────────────────────────────── */
function ItemButton({
  item,
  isActive,
  isChild,
  isCollapsed,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  isChild?: boolean
  isCollapsed?: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const hasChildren = !!item.children?.length

  const color = isActive ? C.cherry : hovered ? C.ink : C.muted
  const bg = isActive ? C.cherrySoft : hovered ? C.hover : "transparent"

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center cursor-pointer"
      style={{
        gap: 10,
        color,
        backgroundColor: bg,
        fontSize: isChild ? 12.5 : 13.5,
        fontWeight: isActive ? 600 : 500,
        textAlign: "left",
        padding: isChild ? "6px 8px" : "8px 10px",
        borderRadius: 8,
        lineHeight: 1.25,
        border: 0,
        transition: "background .12s, color .12s",
      }}
      aria-current={isActive ? "page" : undefined}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
    >
      {item.ic && (
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 16, height: 16, color }}
        >
          {IC[item.ic]}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      {item.badge && <BadgeChip kind={item.badge} />}
      {item.star && <span style={{ color: C.cherry, fontSize: 11, flexShrink: 0 }}>★</span>}
      {hasChildren && (
        <span
          className="flex-shrink-0"
          style={{
            width: 13,
            height: 13,
            opacity: 0.7,
            color,
            transition: "transform .15s",
            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
        >
          <Chevron />
        </span>
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────
   Main Sidebar
───────────────────────────────────────────── */
export function Sidebar({
  active,
  onSelect,
  className,
  hideLogo = false,
}: {
  active: string
  onSelect: (id: string) => void
  className?: string
  hideLogo?: boolean
}) {
  const COLLAPSE_KEY = "cherry_sidebar_collapsed"
  // 전 그룹 기본 접힘 — 메뉴가 간결하게 시작.
  // 사용자가 펼친 상태는 그룹별로 localStorage에 각각 저장·복원된다.
  const DEFAULT_COLLAPSED: Record<string, boolean> = {
    basics: true,
    advanced: true,
    research: true,
    eng: true,
    cases: true,
    discourse: true,
  }
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED)
  const [hydrated, setHydrated] = useState(false)

  // mount 시 1회만 복원.
  // ⚠️ 저장값을 통째로 교체하면 안 된다 — 기존 사용자의 저장값엔 신규 그룹 키가 없어
  //    undefined(=펼침)가 되어 기본값이 안 먹는다. 반드시 기본값과 '병합'한다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object") {
          setCollapsed({ ...DEFAULT_COLLAPSED, ...parsed })
        }
      }
    } catch { /* noop */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)) } catch {}
  }, [collapsed, hydrated])

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))

  return (
    <aside
      className={cn("flex flex-col flex-shrink-0", className)}
      style={{
        width: 260,
        minHeight: "100vh",
        background: "#fff",
        borderRight: `1px solid ${C.line}`,
      }}
      aria-label="Main navigation"
    >
      {/* Logo — 목업 .logo */}
      {!hideLogo && (
        <div
          className="flex items-center flex-shrink-0"
          style={{ gap: 10, padding: "20px 16px 16px", borderBottom: `1px solid ${C.line}` }}
        >
          <CherryIcon />
          <div className="leading-tight">
            <b style={{ fontSize: 17, letterSpacing: "-0.2px" }}>Cherry</b>
            <small style={{ display: "block", color: C.label, fontSize: 11, fontWeight: 600, marginTop: 1 }}>
              for AI Engineers
            </small>
          </div>
        </div>
      )}

      {/* Nav — 목업 nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: "14px 8px 28px" }}>
        {SECTIONS.map((section, si) => (
          <div key={section.id} style={{ marginTop: si === 0 ? 2 : 14 }}>
            {/* 목업 .slabel */}
            <div
              className="flex items-center"
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.9px",
                textTransform: "uppercase",
                color: C.label,
                padding: "0 8px",
                marginBottom: 5,
                gap: 6,
              }}
            >
              {section.label}
              {section.hot && (
                <span
                  style={{
                    background: C.cherry,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0,
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  HOT
                </span>
              )}
            </div>

            {section.items.map((item) => {
              const hasChildren = !!item.children?.length
              if (!hasChildren) {
                return (
                  <ItemButton
                    key={item.id}
                    item={item}
                    isActive={active === item.id}
                    onClick={() => onSelect(item.id)}
                  />
                )
              }

              const isC = !!collapsed[item.id]
              return (
                <div key={item.id}>
                  <ItemButton
                    item={item}
                    isActive={false}
                    isCollapsed={isC}
                    onClick={() => {
                      toggle(item.id)
                      // ND 그룹 헤더는 페이지가 없다 → 열고닫기 + 첫 서브메뉴 활성화.
                      // Basics/Advanced는 기존대로 토글만.
                      const g = getNDGroup(item.id)
                      if (g) onSelect(g.children[0])
                    }}
                  />
                  {/* 목업 .children — 단순 좌측 선 */}
                  {!isC && (
                    <div
                      style={{
                        marginLeft: 18,
                        paddingLeft: 12,
                        borderLeft: `1px solid ${C.stem}`,
                        marginTop: 2,
                      }}
                    >
                      {item.children!.map((c) => (
                        <ItemButton
                          key={c.id}
                          item={{ id: c.id, label: c.label, badge: c.badge }}
                          isActive={active === c.id}
                          isChild
                          onClick={() => onSelect(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
