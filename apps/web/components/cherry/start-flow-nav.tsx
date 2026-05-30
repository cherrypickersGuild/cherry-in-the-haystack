"use client"

/**
 * StartFlowNav — 3-step breadcrumb showing the canonical consumer flow:
 * Workshop → Install Skill → Shop. Rendered to the right of each page's
 * H1 title so users see where they are + where to go next.
 *
 * Each step is clickable (Link). The current step is highlighted.
 * Completed steps (before current) use a subtle filled pill;
 * upcoming steps use an outline pill.
 */

import Link from "next/link"

export type FlowStepId = "workshop" | "install" | "shop"

interface Step {
  id: FlowStepId
  href: string
  label: string
  icon: string
  n: number
}

const STEPS: Step[] = [
  { id: "workshop", href: "/start/workshop", label: "Workshop",      icon: "⚒️", n: 1 },
  { id: "install",  href: "/start/connect",  label: "Install Skill", icon: "📥", n: 2 },
  { id: "shop",     href: "/start/shop",     label: "Shop",          icon: "🛒", n: 3 },
]

export function StartFlowNav({ current }: { current: FlowStepId }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)
  return (
    <nav
      aria-label="Consumer flow"
      className="flex items-center gap-1 flex-wrap opacity-75"
    >
      {STEPS.map((s, i) => {
        const isCurrent = s.id === current
        const isDone = i < currentIdx
        return (
          <div key={s.id} className="flex items-center gap-1">
            <Link
              href={s.href}
              aria-current={isCurrent ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[12px] transition-colors whitespace-nowrap ${
                isCurrent
                  ? "font-bold text-[#3A2A1C]"
                  : isDone
                    ? "text-[#9A7C55] hover:text-[#6B4F2A]"
                    : "text-[#B8A788] hover:text-[#9A7C55]"
              }`}
            >
              <span className="tabular-nums">{s.n}</span>
              <span>{s.label}</span>
            </Link>
            {i < STEPS.length - 1 && (
              <span className="text-[12px] text-[#C9B88A]">›</span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
