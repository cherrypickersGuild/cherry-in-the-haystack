"use client"

/**
 * SlotBadgeBar — renders a small 7-pill row showing which Workshop slots
 * a build fills. Reuses Workshop TYPE_THEME so Shop/Workshop stay visually
 * consistent.
 */

import { TYPE_THEME } from "./kaas-workshop-panel"

type SlotKey = "prompt" | "mcp" | "skillA" | "skillB" | "skillC" | "orchestration" | "memory"

const SLOT_ORDER: SlotKey[] = [
  "prompt",
  "mcp",
  "skillA",
  "skillB",
  "skillC",
  "orchestration",
  "memory",
]

function typeForSlot(slot: SlotKey): keyof typeof TYPE_THEME {
  if (slot.startsWith("skill")) return "skill"
  if (slot === "orchestration") return "orchestration"
  if (slot === "memory") return "memory"
  if (slot === "mcp") return "mcp"
  return "prompt"
}

export function SlotBadgeBar({
  equipped,
  compact = false,
}: {
  equipped: Partial<Record<SlotKey, string | null>>
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {SLOT_ORDER.map((slot) => {
        const filled = !!equipped[slot]
        const theme = TYPE_THEME[typeForSlot(slot)]
        const sz = compact ? "w-2 h-2" : "w-2.5 h-2.5"
        return (
          <span
            key={slot}
            title={`${theme.label}${filled ? "" : " (empty)"}`}
            className={`${sz} rounded`}
            style={{
              backgroundColor: filled ? theme.border : "transparent",
              border: filled ? "none" : `1px solid ${theme.border}44`,
            }}
          />
        )
      })}
    </div>
  )
}
