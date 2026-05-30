"use client"

import type { ShopSet } from "@/lib/api"
import { SlotBadgeBar } from "./slot-badge-bar"

interface Props {
  set: ShopSet
  ownedCount: number
  onBuy: () => void
  onInspect: () => void
}

export function ShopSetCard({ set, ownedCount, onBuy, onInspect }: Props) {
  const allOwned = ownedCount === set.slotCount && set.slotCount > 0
  const partiallyOwned = !allOwned && ownedCount > 0
  return (
    <article
      className="relative rounded-xl bg-white p-3.5 transition-all hover:-translate-y-0.5"
      style={{
        border: "1px solid #D4CEBD",
        boxShadow:
          "0 1px 0 rgba(107,79,42,0.04), 0 2px 8px rgba(107,79,42,0.06)",
      }}
    >
      {allOwned && (
        <span className="absolute top-2.5 right-2.5 text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded uppercase bg-[#2D7A5E] text-white">
          ✓ Owned
        </span>
      )}
      {partiallyOwned && !allOwned && (
        <span className="absolute top-2.5 right-2.5 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase bg-[#FBF6ED] text-[#9A7C55] border border-[#E9D1A6]">
          {ownedCount}/{set.slotCount}
        </span>
      )}

      <header>
        <div className="flex items-center gap-1.5">
          <span className="text-[22px] leading-none">{set.icon}</span>
          <h3 className="text-[15px] font-extrabold text-[#3A2A1C] truncate">
            {set.title}
          </h3>
        </div>
        <p className="mt-0.5 text-[11px] text-[#6B4F2A] leading-snug line-clamp-2">
          {set.subtitle}
        </p>
      </header>

      {/* Slot coverage bar */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <SlotBadgeBar equipped={set.equipped} compact />
        <span className="text-[9px] font-mono text-[#9A7C55] tabular-nums">
          {set.slotCount}/7
        </span>
      </div>

      {/* Rating + installs */}
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#9A7C55]">
        <span>⭐ {set.qualityScore.toFixed(1)}</span>
        <span>·</span>
        <span>{set.installs.toLocaleString()}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold text-[#3A2A1C] tabular-nums">
          {set.priceBundled}
          <span className="text-[9px] font-bold text-[#9A7C55] ml-0.5">cr</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onInspect}
            className="h-7 px-2 rounded-md bg-white border text-[11px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
            style={{ borderColor: "#E9D1A6" }}
          >
            Details
          </button>
          <button
            onClick={onBuy}
            disabled={allOwned}
            className="h-7 px-2.5 rounded-md text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border"
            style={{
              color: allOwned ? "#9A7C55" : "#B12A17",
              borderColor: allOwned ? "#E9D1A6" : "#E89080",
              backgroundColor: allOwned ? "#F5F1E6" : "#FBE8E3",
            }}
          >
            {allOwned ? "Owned" : "Buy →"}
          </button>
        </div>
      </div>
    </article>
  )
}
