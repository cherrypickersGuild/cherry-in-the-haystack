"use client"

/**
 * ExportFlockxModal — push a Workshop build to flockx.io as a public agent.
 *
 * Auth: user pastes their flockx.io API key (saved per-browser in localStorage
 * under `cherry.flockx.api_key` so they don't re-paste each time, but never
 * sent to anyone except api.flockx.io via Cherry's backend).
 */

import { useEffect, useState } from "react"
import { exportToFlockx, type FlockExportRequest, type FlockExportResponse } from "@/lib/api"

const STORAGE_KEY = "cherry.flockx.api_key"

interface Props {
  open: boolean
  onClose: () => void
  build: {
    id: string
    name: string
    summary?: string
    equipped: FlockExportRequest["equipped"]
  } | null
}

type Phase = "idle" | "loading" | "success" | "error"

export function ExportFlockxModal({ open, onClose, build }: Props) {
  const [apiKey, setApiKey] = useState("")
  const [remember, setRemember] = useState(true)
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [result, setResult] = useState<FlockExportResponse | null>(null)

  useEffect(() => {
    if (!open) return
    setPhase("idle")
    setErrorMsg("")
    setResult(null)
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY) ?? ""
      setApiKey(saved)
    }
  }, [open])

  if (!open || !build) return null

  const slotCount = Object.values(build.equipped).filter(Boolean).length

  async function handleExport() {
    if (!build) return
    if (!apiKey.trim()) {
      setErrorMsg("flockx.io API key required")
      setPhase("error")
      return
    }
    setPhase("loading")
    setErrorMsg("")
    try {
      const resp = await exportToFlockx({
        build_id: build.id,
        build_name: build.name,
        build_summary: build.summary,
        equipped: build.equipped,
        api_key: apiKey.trim(),
        public: true,
      })
      if (remember && typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, apiKey.trim())
      } else if (!remember && typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      setResult(resp)
      setPhase("success")
    } catch (err) {
      const e = err as { status?: number; message?: string; detail?: any }
      let msg = e?.message ?? String(err)
      if (e?.status === 401) msg = "Invalid flockx.io API key (401)"
      setErrorMsg(msg)
      setPhase("error")
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={phase === "loading" ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-[#3A2A1C]/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[440px] rounded-2xl bg-[#FDFBF5] shadow-2xl flex flex-col"
        style={{ border: "1px solid #E9D1A6", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b"
          style={{ borderColor: "#E9D1A6" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
              Export to Flockx
            </div>
            <h2 className="mt-0.5 text-[15px] font-extrabold text-[#3A2A1C] truncate">
              {build.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8E7555]">
              Publish this build as a public agent on flockx.io marketplace.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-7 h-7 rounded-full text-[14px] text-[#9A7C55] hover:bg-[#F5E4C2]/40 cursor-pointer leading-none"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {phase === "idle" && (
            <>
              <div
                className="rounded-md px-3 py-2 text-[11px] flex items-center justify-between"
                style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
              >
                <span className="text-[#6B4F2A]">Equipped slots</span>
                <span className="font-extrabold text-[#3A2A1C] tabular-nums">{slotCount}</span>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
                  Flockx API key
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your flockx.io token"
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[12px] font-mono text-[#3A2A1C]"
                  style={{ borderColor: "#E9D1A6" }}
                />
                <a
                  href="https://docs.flockx.io/documentation/getting-started/api-authentication"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[10px] text-[#9A7C55] hover:text-[#6B4F2A] underline"
                >
                  How to get a flockx API key →
                </a>
              </label>

              <label className="flex items-center gap-2 text-[11px] text-[#6B4F2A]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember this key in this browser
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-9 rounded-lg bg-white border text-[12px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={!apiKey.trim() || slotCount === 0}
                  className="flex-1 h-9 rounded-lg border bg-white text-[12px] font-extrabold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: "#E89080" }}
                >
                  Publish to Flockx →
                </button>
              </div>
            </>
          )}

          {phase === "loading" && (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="flex gap-1.5 mb-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#C8301E] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-[12px] font-semibold text-[#3A2A1C] animate-pulse">
                Publishing to flockx.io…
              </p>
              <p className="mt-1 text-[10px] text-[#9A7C55]">
                Creating agent + knowledge graph + documents.
              </p>
            </div>
          )}

          {phase === "success" && result && (
            <>
              <div
                className="rounded-lg px-3 py-2 text-[11px]"
                style={{ backgroundColor: "#E9F6EF", border: "1px solid #BEE0D0", color: "#2D7A5E" }}
              >
                <div className="font-extrabold text-[12px]">✓ Published to flockx.io</div>
                <div className="mt-1">
                  Agent ID: <span className="font-mono">{result.agent.id}</span>
                </div>
                {result.agent.handle && (
                  <div>
                    Handle: <span className="font-mono">{result.agent.handle}</span>
                  </div>
                )}
                {result.knowledge_graph && (
                  <div>
                    Knowledge graph: <span className="font-mono">{result.knowledge_graph.id}</span>{" "}
                    · {result.documents.filter((d) => d.ok).length}/{result.documents.length} docs
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55] mb-1.5">
                  Public URL candidates
                </div>
                <ul className="space-y-1">
                  {result.public_url_candidates.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] font-mono text-[#B12A17] hover:text-[#8F1D12] underline decoration-dotted break-all"
                      >
                        {url} ↗
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-[#9A7C55]">
                  flockx docs don't pin a single canonical URL — try each. The one that resolves is yours.
                </p>
              </div>

              {result.warnings.length > 0 && (
                <div
                  className="rounded-md px-3 py-2 text-[10px]"
                  style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6", color: "#9A7C55" }}
                >
                  {result.warnings.map((w) => (
                    <div key={w}>· {w}</div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full h-9 rounded-lg bg-[#3A2A1C] text-white text-[12px] font-extrabold hover:bg-[#2A1E15] cursor-pointer"
              >
                Done
              </button>
            </>
          )}

          {phase === "error" && (
            <>
              <div
                className="rounded-lg px-3 py-2 text-[11px]"
                style={{ backgroundColor: "#FBE8E3", border: "1px solid #F2C7BE", color: "#C8301E" }}
              >
                {errorMsg}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhase("idle")}
                  className="flex-1 h-9 rounded-lg border bg-white text-[12px] font-bold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer"
                  style={{ borderColor: "#E89080" }}
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-9 rounded-lg border bg-white text-[12px] font-semibold text-[#6B4F2A] cursor-pointer"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
