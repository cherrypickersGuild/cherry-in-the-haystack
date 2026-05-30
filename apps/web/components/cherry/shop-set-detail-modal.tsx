"use client"

import type { ShopSet } from "@/lib/api"
import { TYPE_THEME } from "./kaas-workshop-panel"

interface Props {
  set: ShopSet
  onClose: () => void
  onBuy: () => void
}

function typeFor(type: string): keyof typeof TYPE_THEME {
  if (type === "skill") return "skill"
  if (type === "orchestration") return "orchestration"
  if (type === "memory") return "memory"
  if (type === "mcp") return "mcp"
  return "prompt"
}

export function ShopSetDetailModal({ set, onClose, onBuy }: Props) {
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
        className="relative w-full max-w-[460px] rounded-2xl bg-[#FDFBF5] shadow-2xl overflow-hidden"
        style={{ border: "1px solid #E9D1A6" }}
      >
        <header className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "#E9D1A6" }}>
          <div className="flex items-center gap-2">
            <span className="text-[24px] leading-none">{set.icon}</span>
            <h2 className="text-[17px] font-extrabold text-[#3A2A1C]">
              {set.title}
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-[#8E7555]">
            Set contents — {set.slotCount} components
          </p>
        </header>

        <div className="px-5 py-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {set.components.map((c) => {
            const theme = TYPE_THEME[typeFor(c.type)]
            return (
              <div
                key={c.slot}
                className="flex items-start gap-3 rounded-lg p-2.5"
                style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
              >
                <span
                  className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: theme.badge, color: theme.text }}
                >
                  {theme.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#3A2A1C] truncate">
                    {c.title}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B4F2A] leading-snug line-clamp-2">
                    {c.summary}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <footer className="px-5 py-4 border-t" style={{ borderColor: "#E9D1A6" }}>
          <button
            onClick={onBuy}
            className="w-full h-11 rounded-lg text-white text-[13px] font-extrabold shadow-sm hover:shadow-md cursor-pointer"
            style={{ backgroundColor: "#C8301E" }}
          >
            Buy complete set — {set.priceBundled} cr
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 h-9 rounded-lg bg-white border text-[12px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
            style={{ borderColor: "#E9D1A6" }}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
