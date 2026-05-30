"use client"

import { useEffect, useState } from "react"
import { ShopByDomain } from "@/components/cherry/shop-by-domain"
import { ShopByComponent } from "@/components/cherry/shop-by-component"
import { ShopByAgent } from "@/components/cherry/shop-by-agent"
import { StartFlowNav } from "@/components/cherry/start-flow-nav"
import { useAuthTick } from "@/lib/auth"

type RootTab = "domain" | "component" | "agent"

export default function ShopPage() {
  useAuthTick()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [root, setRoot] = useState<RootTab>("domain")

  // Avoid SSR hydration mismatch — both server and the very first client
  // render default to By Domain, then client re-renders if needed.
  if (!mounted) {
    return (
      <div>
        <header className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold text-[#3A2A1C]">Shop</h1>
            <p className="text-[12px] text-[#9A7C55] mt-1">
              Browse ready-made AIs or individual components.
            </p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold text-[#3A2A1C]">Shop</h1>
          <p className="text-[12px] text-[#9A7C55] mt-1">
            Browse ready-made AIs or individual components.
          </p>
        </div>
        <StartFlowNav current="shop" />
      </header>

      {/* Two big tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1 mb-4"
      >
        <RootTabButton
          active={root === "domain"}
          onClick={() => setRoot("domain")}
          label="By Domain"
          hint="Buy a complete AI"
        />
        <RootTabButton
          active={root === "component"}
          onClick={() => setRoot("component")}
          label="By Component"
          hint="Browse individual pieces"
        />
        <RootTabButton
          active={root === "agent"}
          onClick={() => setRoot("agent")}
          label="By Agent"
          hint="Trade with another agent"
        />
      </div>

      {root === "domain" ? (
        <ShopByDomain />
      ) : root === "component" ? (
        <ShopByComponent />
      ) : (
        <ShopByAgent />
      )}
    </div>
  )
}

function RootTabButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 md:flex-none text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
        active ? "shadow-sm" : "hover:bg-[#FBF6ED]"
      }`}
      style={{
        backgroundColor: active ? "#FBF6ED" : "transparent",
        border: `1.5px solid ${active ? "#C8301E" : "transparent"}`,
      }}
    >
      <span
        className={`block text-[14px] font-extrabold ${
          active ? "text-[#3A2A1C]" : "text-[#6B4F2A]"
        }`}
      >
        {label}
      </span>
      <span
        className={`block mt-0.5 text-[10px] font-semibold ${
          active ? "text-[#8F1D12]" : "text-[#9A7C55]"
        }`}
      >
        {hint}
      </span>
    </button>
  )
}
