"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function PageHeader() {
  const [tab, setTab] = useState<"community" | "for-you">("community")

  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      {/* Left: text */}
      <div>
        <h1
          className="font-extrabold text-[#1A1626] leading-none mb-2.5 text-balance"
          style={{ fontSize: "30px", letterSpacing: "-0.5px" }}
        >
          {"This Week's Highlight"}
        </h1>
        <p className="text-[15px] text-text-muted leading-relaxed">
          Digest · Week of Mar 24, 2026
        </p>
      </div>

      {/* Right: toggle pill */}
      <div
        className="flex items-center rounded-full border border-border bg-card p-1 gap-0.5 flex-shrink-0 mt-1 shadow-card"
        role="tablist"
        aria-label="Feed view"
      >
        {(["community", "for-you"] as const).map((t) => {
          const isActive = tab === t
          return (
            <button
              key={t}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-card shadow-sm text-[#1A1626]"
                  : "text-text-muted hover:text-text-secondary"
              )}
              style={
                isActive
                  ? {
                      boxShadow:
                        "0 1px 4px rgba(0,0,0,0.10)",
                    }
                  : {}
              }
            >
              {t === "community" ? "Community" : "For You"}
            </button>
          )
        })}
      </div>
    </div>
  )
}
