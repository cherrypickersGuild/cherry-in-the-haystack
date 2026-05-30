"use client"

/**
 * ShopByComponent — catalog-only tab. Shows Workshop inventory cards
 * grouped by slot type. No purchase here — clicking a card opens a
 * detail modal with an "Equip in Workshop" link.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { mockInventory, type InventoryItem, type SkillType } from "@/lib/workshop-mock"
import { TYPE_THEME } from "./kaas-workshop-panel"
import { ShopSubTabs } from "./shop-subtabs"

const COMPONENT_OPTIONS: ReadonlyArray<{ value: SkillType; label: string }> = [
  { value: "prompt",         label: "Prompt" },
  { value: "mcp",            label: "MCP" },
  { value: "skill",          label: "Skill" },
  { value: "orchestration",  label: "Orchestration" },
  { value: "memory",         label: "Memory" },
]

export function ShopByComponent() {
  const [filter, setFilter] = useState<SkillType>("prompt")
  const [inspect, setInspect] = useState<InventoryItem | null>(null)
  const items = useMemo(
    () => mockInventory.filter((i) => i.type === filter),
    [filter],
  )

  return (
    <div>
      <ShopSubTabs value={filter} onChange={setFilter} options={COMPONENT_OPTIONS} />

      {items.length === 0 ? (
        <div className="text-[12px] italic text-[#9A7C55] py-12 text-center">
          No components in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <ShopComponentCard key={item.id} item={item} onOpen={() => setInspect(item)} />
          ))}
        </div>
      )}

      {inspect && <ShopComponentDetailModal item={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}

function ShopComponentCard({ item, onOpen }: { item: InventoryItem; onOpen: () => void }) {
  const theme = TYPE_THEME[item.type]
  return (
    <button
      onClick={onOpen}
      className="relative text-left rounded-lg p-3 bg-white hover:shadow-md transition-all cursor-pointer"
      style={{ border: "1px solid #D4CEBD", borderLeftWidth: "4px", borderLeftColor: theme.border }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[#1A1626] truncate">
            {item.title}
          </div>
          <div className="text-[10px] text-[#9A7C55] mt-0.5 truncate">
            {item.category}
          </div>
        </div>
        <span
          className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase flex-shrink-0"
          style={{ backgroundColor: theme.badge, color: theme.text }}
        >
          {theme.label}
        </span>
      </header>
      {item.summary && (
        <p className="mt-1 text-[10px] text-[#6B6480] line-clamp-2 leading-snug">
          {item.summary}
        </p>
      )}
    </button>
  )
}

function ShopComponentDetailModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const theme = TYPE_THEME[item.type]
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#3A2A1C]/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] rounded-2xl bg-[#FDFBF5] p-5 shadow-2xl"
        style={{ border: "1px solid #E9D1A6" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
            style={{ backgroundColor: theme.badge, color: theme.text }}
          >
            {theme.label}
          </span>
          <h2 className="text-[16px] font-extrabold text-[#3A2A1C]">
            {item.title}
          </h2>
        </div>
        <p className="mt-2 text-[12px] text-[#6B4F2A] leading-relaxed">
          {item.summary}
        </p>
        {item.setTag && item.setTag.length > 0 && (
          <div className="mt-3 text-[10px] text-[#9A7C55]">
            Domain: {item.setTag.join(", ")}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-white border text-[12px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
            style={{ borderColor: "#E9D1A6" }}
          >
            Close
          </button>
          <Link
            href="/start/workshop"
            className="flex-1 h-9 inline-flex items-center justify-center rounded-lg text-white text-[12px] font-extrabold shadow-sm hover:shadow-md cursor-pointer"
            style={{ backgroundColor: "#C8301E" }}
          >
            Equip in Workshop →
          </Link>
        </div>
      </div>
    </div>
  )
}
