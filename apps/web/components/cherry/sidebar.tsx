"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { 
  Home, 
  FileText, 
  Sparkles, 
  Link2, 
  Lightbulb, 
  BookOpen, 
  ChevronRight,
  GraduationCap,
  Zap,
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
  items: NavItem[]
}

/* ─────────────────────────────────────────────
   TreeStemList — 1px vertical stem + curve at last item only
───────────────────────────────────────────── */
const ITEM_H    = 32   // height per row — same as NavButton
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
}: {
  items: NavItem[]
  active: string
  onSelect: (id: string) => void
}) {
  const count  = items.length
  const totalH = count * ITEM_H

  // midpoint Y of each row
  const midY = (idx: number) => idx * ITEM_H + ITEM_H / 2
  // arc starts ARC_ABOVE pixels before midpoint
  const arcStartY = (idx: number) => midY(idx) - ARC_ABOVE
  // last item arc start = vertical line end
  const stemEndY = arcStartY(count - 1)

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
          stroke="#D5D0E0"
          strokeWidth={1}
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
              stroke="#D5D0E0"
              strokeWidth={1}
            />
          )
        })()}
      </svg>

      {/* Buttons — each centered exactly at row midpoint */}
      {items.map((item, idx) => {
        const btnH   = 24
        const btnTop = midY(idx) - btnH / 2
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
        color: textColor,
        backgroundColor: bg,
        fontWeight: isActive ? 600 : 500,
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
          { id: "prompting",           label: "Prompting Techniques" },
          { id: "rag",                 label: "RAG" },
          { id: "fine-tuning",         label: "Fine-tuning" },
          { id: "agent-architectures", label: "Agent Architectures" },
          { id: "embeddings",          label: "Embeddings & Vector DBs" },
          { id: "evaluation",          label: "Evaluation" },
        ],
      },
      {
        id: "advanced", icon: <Zap size={16} />, label: "Advanced",
        children: [
          { id: "chain-of-thought",   label: "Chain-of-Thought" },
          { id: "multi-hop-rag",      label: "Multi-hop RAG" },
          { id: "peft-lora",          label: "PEFT / LoRA / QLoRA" },
          { id: "multi-agent",        label: "Multi-agent Systems" },
          { id: "custom-embeddings",  label: "Custom Embeddings" },
          { id: "adversarial-eval",   label: "Adversarial Evaluation" },
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="cherry"
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#C94B6E" />
      <path d="M12.5 16.5 Q14 12 16 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M19.5 16.5 Q18 12 16 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M16 9 C19 4 27 5 25 12.5 C22.5 11 19.5 9.5 16 9Z" fill="white" />
      <circle cx="11.5" cy="21" r="5" fill="white" />
      <circle cx="20.5" cy="21" r="5" fill="white" />
    </svg>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted px-2 mb-1">
              {section.label}
            </p>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <div key={item.id}>
                  {item.children && item.children.length > 0 ? (
                    /* Non-clickable group header — same height/padding as NavButton */
                    <>
                      <div
                        className="w-full flex items-center gap-2.5 pl-5 pr-3 text-[13.5px] font-medium"
                        style={{ color: "#6B727E", height: ITEM_H }}
                      >
                        <span className="flex-shrink-0" style={{ color: "#6B727E" }}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                      </div>
                      <div className="ml-4">
                        <TreeStemList
                          items={item.children.map(c => ({ id: c.id, icon: null, label: c.label }))}
                          active={active}
                          onSelect={onSelect}
                        />
                      </div>
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
