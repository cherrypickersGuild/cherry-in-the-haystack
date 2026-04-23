"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Home,
  FileText,
  Sparkles,
  Link2,
  Lightbulb,
  BookOpen,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Zap,
  ShoppingBag,
  Trophy,
  LayoutDashboard,
  Cherry as CherryLucide,
} from "lucide-react"

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type ChildItem = {
  id: string
  label: string
}

type NavItem = {
  id: string
  icon: React.ReactNode | null
  label: string
  hasArrow?: boolean
  children?: ChildItem[]
}

type SectionDef = {
  id: string
  label: string
  highlight?: boolean
  items: NavItem[]
}

/* ─────────────────────────────────────────────
   TreeStemList — 1px vertical stem + curve at last item only
───────────────────────────────────────────── */
const ITEM_H       = 32   // height per row — default (1 line)
const ITEM_H_LONG  = 48   // height per row — 2 lines (long labels)
const LONG_LABEL   = 25   // chars threshold for 2-line wrapping
const CURVE_R   = 8    // arc radius
const HORIZ_TAIL= 4    // short horizontal tail after arc
const VERT_X    = 1    // x of vertical line
const SVG_WIDTH = VERT_X + CURVE_R + HORIZ_TAIL + 1
// arc starts this many px ABOVE row midpoint so it curves into the midpoint
const ARC_ABOVE = CURVE_R  // curveStartY = midY - CURVE_R, arcEndY = midY

function TreeStemList({
  items,
  active,
  onSelect,
  onCollapse,
}: {
  items: NavItem[]
  active: string
  onSelect: (id: string) => void
  onCollapse?: () => void
}) {
  const count  = items.length
  const [stemHovered, setStemHovered] = useState(false)

  // 각 행 높이 — 라벨이 길면 2줄 슬롯
  const rowH = (idx: number) => (items[idx].label.length > LONG_LABEL ? ITEM_H_LONG : ITEM_H)
  // 슬롯 top (누적 합)
  const slotTop = (idx: number) => {
    let y = 0
    for (let i = 0; i < idx; i++) y += rowH(i)
    return y
  }
  const totalH = slotTop(count)
  // midpoint Y of each row (슬롯 내 중앙)
  const midY = (idx: number) => slotTop(idx) + rowH(idx) / 2
  // arc starts ARC_ABOVE pixels before midpoint
  const arcStartY = (idx: number) => midY(idx) - ARC_ABOVE
  // last item arc start = vertical line end
  const stemEndY = arcStartY(count - 1)

  const stemColor = stemHovered ? "#8F879E" : "#D5D0E0"

  return (
    <div className="relative ml-5" style={{ height: totalH }}>
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        width={SVG_WIDTH}
        height={totalH}
        style={{ overflow: "visible" }}
      >
        {/* Single continuous vertical line from top to last arc start */}
        <line
          x1={VERT_X} y1={0}
          x2={VERT_X} y2={stemEndY}
          stroke={stemColor}
          strokeWidth={stemHovered ? 1.5 : 1}
          style={{ transition: "stroke 120ms, stroke-width 120ms" }}
        />

        {/* Only last item gets the curved branch */}
        {(() => {
          const lastIdx = count - 1
          const cy = arcStartY(lastIdx)
          return (
            <path
              d={[
                `M ${VERT_X} ${cy}`,
                `A ${CURVE_R} ${CURVE_R} 0 0 0 ${VERT_X + CURVE_R} ${cy + CURVE_R}`,
                `L ${VERT_X + CURVE_R + HORIZ_TAIL} ${cy + CURVE_R}`,
              ].join(" ")}
              fill="none"
              stroke={stemColor}
              strokeWidth={stemHovered ? 1.5 : 1}
              style={{ transition: "stroke 120ms, stroke-width 120ms" }}
            />
          )
        })()}
      </svg>

      {/* Transparent hitbox for the vertical stem — wider than the visible line so it's easy to click (YouTube-style). */}
      {onCollapse && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCollapse() }}
          onMouseEnter={() => setStemHovered(true)}
          onMouseLeave={() => setStemHovered(false)}
          aria-label="Collapse section"
          title="Collapse"
          className="absolute top-0 cursor-pointer"
          style={{
            left: VERT_X - 5,
            width: 11,
            height: stemEndY,
            background: "transparent",
            border: "none",
            padding: 0,
          }}
        />
      )}

      {/* Buttons — fill the row (padding 3px top/bottom) so active bg contains wrapped text */}
      {items.map((item, idx) => {
        const rh     = rowH(idx)
        const btnH   = rh - 6
        const btnTop = slotTop(idx) + 3
        return (
          <TreeStemButton
            key={item.id}
            item={item}
            isActive={active === item.id}
            btnTop={btnTop}
            btnH={btnH}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

function TreeStemButton(props: {
  item: NavItem
  isActive: boolean
  btnTop: number
  btnH: number
  onSelect: (id: string) => void
}) {
  const { item, isActive, btnTop, btnH, onSelect } = props
  const [hovered, setHovered] = useState(false)
  const textColor = isActive ? "var(--cherry)" : hovered ? "#3D3652" : "#6B727E"
  const bg        = isActive ? "var(--cherry-soft)" : hovered ? "#F9F7F5" : "transparent"
  const leftPx    = SVG_WIDTH + 3

  return (
    <button
      onClick={() => onSelect(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute right-0 flex items-center text-left rounded-md px-2 text-[13px] transition-all duration-150 cursor-pointer"
      style={{
        left: leftPx,
        top: btnTop,
        height: btnH,
        minHeight: btnH,
        color: textColor,
        backgroundColor: bg,
        fontWeight: isActive ? 600 : 500,
        lineHeight: 1.25,
      }}
      aria-current={isActive ? "page" : undefined}
    >
      <span style={{ fontSize: item.label.length > 20 ? "11.5px" : undefined }}>
        {item.label}
      </span>
    </button>
  )
}

/* ─────────────────────────────────────────────
   Navigation data
───────────────────────────────────────────── */
const SECTIONS: SectionDef[] = [
  {
    id: "digest",
    label: "DIGEST",
    items: [
      { id: "highlight", icon: <Home size={16} />, label: "This Week's Highlight", hasArrow: true },
      { id: "patch-notes", icon: <FileText size={16} />, label: "Patch Notes" },
    ],
  },
  {
    id: "agent-shopping",
    label: "AGENT SHOP",
    highlight: true,
    items: [
      { id: "kaas-catalog", icon: <ShoppingBag size={16} />, label: "Knowledge Market" },
      { id: "kaas-arena", icon: <Trophy size={16} />, label: "Arena" },
    ],
  },
  {
    id: "newly-discovered",
    label: "NEWLY DISCOVERED",
    items: [
      { id: "model-updates", icon: <Sparkles size={16} />, label: "Model Updates" },
      { id: "frameworks", icon: <Link2 size={16} />, label: "Frameworks" },
      { id: "case-studies", icon: <Lightbulb size={16} />, label: "Case Studies" },
    ],
  },
  {
    id: "learning",
    label: "LEARNING",
    items: [
      { id: "concept-reader", icon: <BookOpen size={16} />, label: "Concept Reader" },
      {
        id: "basics", icon: <GraduationCap size={16} />, label: "Basics",
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
        id: "advanced", icon: <Zap size={16} />, label: "Advanced",
        children: [
          { id: "chain-of-thought",   label: "Chain-of-Thought" },
          { id: "multi-hop-rag",      label: "Multi-hop RAG" },
          { id: "peft-lora",          label: "PEFT / LoRA / QLoRA" },
          { id: "custom-embeddings",  label: "Custom Embeddings" },
          { id: "adversarial-eval",   label: "Adversarial Evaluation" },
          { id: "agent-topologies",   label: "Agent Topologies" },
        ],
      },
    ],
  },
]

/* ─────────────────────────────────────────────
   Cherry SVG Icon
───────────────────────────────────────────── */
export function CherryIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn("w-8 h-8 rounded-[10px] bg-[#C94B6E] flex items-center justify-center", className)}
      aria-label="cherry"
      role="img"
    >
      <CherryLucide size={18} className="text-white" />
    </div>
  )
}

/* ──────────��──────────────────────────────────
   Nav Button
───────────────────────────────────────────── */
function NavButton({
  item,
  isActive,
  onSelect,
}: {
  item: NavItem
  isActive: boolean
  onSelect: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = isActive ? "var(--cherry)" : hovered ? "#3D3652" : "#6B727E"
  const bg    = isActive ? "var(--cherry-soft)" : hovered ? "#F9F7F5" : "transparent"

  return (
    <button
      onClick={() => onSelect(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer",
        "pl-5 pr-3 py-2 text-[13.5px] font-medium",
        isActive && "font-semibold"
      )}
      style={{ color, backgroundColor: bg }}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex-shrink-0" style={{ color }}>{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.hasArrow && isActive && (
        <ChevronRight size={14} style={{ color: "var(--cherry)" }} className="flex-shrink-0" />
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────
   Group Header Button — clickable header for sections with children (Basics, Advanced)
───────────────────────────────────────────── */
function GroupHeaderButton({
  item,
  isCollapsed,
  onToggle,
}: {
  item: NavItem
  isCollapsed: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = hovered ? "#3D3652" : "#6B727E"
  const bg    = hovered ? "#F9F7F5" : "transparent"

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer pl-5 pr-3 text-[13.5px] font-medium"
      style={{ color, backgroundColor: bg, height: ITEM_H }}
      aria-expanded={!isCollapsed}
    >
      <span className="flex-shrink-0" style={{ color }}>{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      <ChevronDown
        size={13}
        className="flex-shrink-0 transition-transform duration-150"
        style={{
          color,
          transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
        }}
      />
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
  // YouTube 스타일 접기: 헤더 클릭 또는 stem 클릭 → 토글. localStorage에 저장.
  // 기본값은 Basics / Advanced 모두 접힌 상태 — 메뉴가 간결하게 시작.
  // SSR 하이드레이션 일치를 위해:
  //   · 첫 렌더는 서버·클라이언트 둘 다 DEFAULT_COLLAPSED로 동일하게 그림
  //   · mount 후 useEffect에서 localStorage 값을 읽어 상태 갱신 (이 시점엔 paint 완료, mismatch 없음)
  const COLLAPSE_KEY = "cherry_sidebar_collapsed"
  const DEFAULT_COLLAPSED: Record<string, boolean> = { basics: true, advanced: true }
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED)
  const [hydrated, setHydrated] = useState(false)

  // mount 시 1회만 localStorage에서 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object") setCollapsed(parsed)
      }
    } catch { /* noop */ }
    setHydrated(true)
  }, [])

  // hydrated 이후부터 localStorage 저장 (초기 DEFAULT 값으로 덮어쓰는 것 방지)
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)) } catch {}
  }, [collapsed, hydrated])
  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))

  return (
    <aside
      className={cn("flex flex-col w-[240px] min-h-screen bg-sidebar border-r border-sidebar-border flex-shrink-0", className)}
      aria-label="Main navigation"
    >
      {/* Logo — hidden in mobile sheet */}
      {!hideLogo && (
        <div className="px-4 pt-5 pb-4 flex-shrink-0 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <CherryIcon className="flex-shrink-0" />
            <div className="leading-tight">
              <span className="text-[17px] font-bold text-text-primary tracking-tight">Cherry</span>
              <p className="text-[11px] text-text-muted font-medium">for AI Engineers</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 pb-6 flex flex-col gap-0.5">
        {SECTIONS.map((section, si) => (
          <div key={section.id} className={si > 0 ? "mt-3" : ""}>
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 mb-1 text-text-muted">
              {section.label}
              {section.highlight && (
                <span className="ml-1.5 text-[9px] font-semibold tracking-normal bg-[var(--cherry)] text-white rounded px-1 py-[1px] align-middle">
                  HOT
                </span>
              )}
            </p>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <div key={item.id}>
                  {item.children && item.children.length > 0 ? (
                    /* Collapsible group — header is a toggle button, stem also clickable to collapse */
                    <>
                      <GroupHeaderButton
                        item={item}
                        isCollapsed={!!collapsed[item.id]}
                        onToggle={() => toggle(item.id)}
                      />
                      {!collapsed[item.id] && (
                        <div className="ml-4">
                          <TreeStemList
                            items={item.children.map(c => ({ id: c.id, icon: null, label: c.label }))}
                            active={active}
                            onSelect={onSelect}
                            onCollapse={() => toggle(item.id)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <NavButton item={item} isActive={active === item.id} onSelect={onSelect} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
