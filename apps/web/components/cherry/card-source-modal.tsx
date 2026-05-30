"use client"

/**
 * CardSourceModal — read-only peek at what ships inside a Workshop card.
 *
 * Fetches `GET /v1/kaas/shop/cards/:id/source` on open and renders the raw
 * systemPrompt / promptSuffix / tool schema / memory config. No edit — the
 * source of truth is the server CARD_REGISTRY.
 */

import { useEffect, useState } from "react"
import { fetchCardSource, type CardSource } from "@/lib/api"

interface Props {
  cardId: string
  title: string
  onClose: () => void
}

export function CardSourceModal({ cardId, title, onClose }: Props) {
  const [source, setSource] = useState<CardSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSource(null)
    setError(null)
    fetchCardSource(cardId)
      .then((s) => {
        if (!cancelled) setSource(s)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [cardId])

  function copyAll() {
    if (!source) return
    navigator.clipboard.writeText(source.body).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
        className="relative w-full max-w-[560px] rounded-2xl bg-[#FDFBF5] shadow-2xl overflow-hidden flex flex-col"
        style={{ border: "1px solid #E9D1A6", maxHeight: "80vh" }}
      >
        <header
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b"
          style={{ borderColor: "#E9D1A6" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
              Card source · read-only
            </div>
            <h2 className="mt-0.5 text-[15px] font-extrabold text-[#3A2A1C] truncate">
              {title}
            </h2>
            {source && (
              <div className="mt-1 text-[10px] font-mono text-[#9A7C55]">
                {cardId} · {source.type} · {source.language}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-7 h-7 rounded-full text-[14px] text-[#9A7C55] hover:bg-[#F5E4C2]/40 cursor-pointer leading-none"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!source && !error && (
            <div className="text-[11px] italic text-[#9A7C55] py-6 text-center">
              Loading…
            </div>
          )}
          {error && (
            <div
              className="rounded-lg px-3 py-2 text-[11px]"
              style={{
                backgroundColor: "#FBE8E3",
                border: "1px solid #F2C7BE",
                color: "#C8301E",
              }}
            >
              Failed to load: {error}
            </div>
          )}
          {source && (
            <pre
              className="rounded-lg p-3 text-[11px] font-mono text-[#2A1E15] whitespace-pre-wrap break-words leading-relaxed"
              style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
            >
              {source.body}
            </pre>
          )}
        </div>

        <footer
          className="px-5 py-3 flex items-center justify-end gap-2 border-t"
          style={{ borderColor: "#E9D1A6" }}
        >
          {source && (
            <button
              onClick={copyAll}
              className="h-8 px-3 rounded-md bg-white border text-[11px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
              style={{ borderColor: "#E9D1A6" }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-md text-white text-[11px] font-bold hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "#3A2A1C" }}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
