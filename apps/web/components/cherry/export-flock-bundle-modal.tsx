"use client"

/**
 * ExportFlockBundleModal — generate a FLock.io co-creation upload bundle
 * (multiple .txt files + manifest.json) and open a deep-link to FLock's
 * Co-creation page so the user can drop the files in.
 *
 * Why bundle + manual upload: FLock.io's marketplace publish API is
 * gated to `proxy_admin` role. The only public-user route is the
 * platform.flock.io Co-creation web flow. Cherry automates the bundle
 * generation; user does the final upload + wallet sign on FLock.
 */

import { useEffect, useState } from "react"
import {
  buildFlockBundle,
  type FlockBundleResponse,
  type FlockExportRequest,
} from "@/lib/api"

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

type Phase = "idle" | "loading" | "ready" | "error"

export function ExportFlockBundleModal({ open, onClose, build }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [bundle, setBundle] = useState<FlockBundleResponse | null>(null)

  useEffect(() => {
    if (!open) return
    setPhase("idle")
    setErrorMsg("")
    setBundle(null)
  }, [open])

  if (!open || !build) return null

  const slotCount = Object.values(build.equipped).filter(Boolean).length

  async function handleGenerate() {
    if (!build) return
    setPhase("loading")
    setErrorMsg("")
    try {
      const resp = await buildFlockBundle({
        build_id: build.id,
        build_name: build.name,
        build_summary: build.summary,
        equipped: build.equipped,
      })
      setBundle(resp)
      setPhase("ready")
    } catch (err) {
      const e = err as { message?: string }
      setErrorMsg(e?.message ?? String(err))
      setPhase("error")
    }
  }

  function downloadOne(file: FlockBundleResponse["files"][number]) {
    const blob = new Blob([file.content], { type: file.mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function downloadAll() {
    if (!bundle) return
    bundle.files.forEach((f, i) => setTimeout(() => downloadOne(f), i * 150))
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
        className="relative w-full max-w-[460px] rounded-2xl bg-[#FDFBF5] shadow-2xl flex flex-col"
        style={{ border: "1px solid #E9D1A6", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b"
          style={{ borderColor: "#E9D1A6" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
              Publish to FLock Marketplace
            </div>
            <h2 className="mt-0.5 text-[15px] font-extrabold text-[#3A2A1C] truncate">
              {build.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8E7555]">
              FLock Co-creation requires manual upload — Cherry generates the files.
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

              <ol className="text-[11px] text-[#6B4F2A] space-y-1 pl-4 list-decimal">
                <li>Cherry generates upload-ready .txt files + manifest</li>
                <li>Click "Open FLock Models"</li>
                <li>On platform.flock.io/models, click "Create" and upload the files</li>
                <li>Sign with wallet → listed on FLock AI Marketplace</li>
              </ol>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-9 rounded-lg bg-white border text-[12px] font-semibold text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={slotCount === 0}
                  className="flex-1 h-9 rounded-lg border bg-white text-[12px] font-extrabold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: "#E89080" }}
                >
                  Generate bundle →
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
                Generating bundle…
              </p>
            </div>
          )}

          {phase === "ready" && bundle && (
            <>
              <div
                className="rounded-lg px-3 py-2 text-[11px]"
                style={{ backgroundColor: "#E9F6EF", border: "1px solid #BEE0D0", color: "#2D7A5E" }}
              >
                <div className="font-extrabold text-[12px]">
                  ✓ Bundle ready ({bundle.files.length} files)
                </div>
                <div className="mt-0.5">Download then upload on FLock Co-creation.</div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55] mb-1.5">
                  Files
                </div>
                <ul className="space-y-1">
                  {bundle.files.map((f) => (
                    <li
                      key={f.filename}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
                      style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
                    >
                      <span className="text-[11px] font-mono text-[#3A2A1C] truncate">
                        {f.filename}
                      </span>
                      <button
                        onClick={() => downloadOne(f)}
                        className="text-[10px] font-bold text-[#B12A17] hover:underline cursor-pointer flex-shrink-0"
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={downloadAll}
                  className="mt-2 w-full h-8 rounded-md border bg-white text-[11px] font-bold text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer"
                  style={{ borderColor: "#E89080" }}
                >
                  ⬇ Download all
                </button>
              </div>

              {bundle.warnings.length > 0 && (
                <div
                  className="rounded-md px-3 py-2 text-[10px]"
                  style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6", color: "#9A7C55" }}
                >
                  {bundle.warnings.map((w) => (
                    <div key={w}>· {w}</div>
                  ))}
                </div>
              )}

              <a
                href={bundle.flock_platform_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-10 leading-[40px] text-center rounded-lg bg-[#3A2A1C] text-white text-[12px] font-extrabold hover:bg-[#2A1E15] cursor-pointer"
              >
                Open FLock Models ↗
              </a>
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
