"use client"

/**
 * PurchaseModal — consumer-friendly buy/follow flow for `/start/shop`.
 *
 * Philosophy: the main-site KaasConsole is developer-themed (MCP endpoints,
 * tx hashes, chain pickers). This modal hides all of that behind a small
 * Cherry Bao character whose expression changes through the flow:
 *   idle     → default     "Ready to teach your AI?"
 *   loading  → sleeping    "Sending to your AI…" (message cycles)
 *   success  → celebrate   "✓ Installed on <agent>"
 *   error    → confused    "Something went wrong…"
 *
 * Only shows: concept title, final price (after Karma tier discount),
 * target AI dropdown, confirm button. Tx hash lives under an optional
 * "Details" fold-out.
 */

import { useEffect, useState } from "react"
import { CherryBao, type BaoVariant } from "./cherry-bao"
import {
  purchaseConcept,
  followConcept,
  fetchBalance,
  buySet,
  buyAgentTradeSkill,
  type ShopSet,
} from "@/lib/api"

export type PurchaseAction = "purchase" | "follow"

export interface PurchaseTarget {
  conceptId: string
  conceptTitle: string
  /** Base cost in credits; server applies Karma tier discount. */
  creditsBase: number
  /** When present, the modal runs in set-mode: calls `/shop/buy-and-install`
   *  instead of the per-concept purchase endpoint. */
  shopSet?: ShopSet
  /** When present, the modal runs in agent-trade mode: calls
   *  `/shop/agents/skills/buy` for a flat-price single-file install. */
  agentTradeSlug?: string
}

export interface PurchaseAgent {
  id: string
  name: string
  icon?: string
  api_key: string
  karma_tier?: string
  credits?: number
}

interface Props {
  open: boolean
  action: PurchaseAction
  target: PurchaseTarget | null
  agents: PurchaseAgent[]
  defaultAgentId?: string
  onClose: () => void
  /** Called after a successful purchase so the parent can refresh credits. */
  onSuccess?: (result: { txHash?: string | null; creditsAfter?: number }) => void
}

type Phase = "idle" | "loading" | "success" | "error"

const LOADING_MESSAGES = [
  "Sending to your AI…",
  "Packing the knowledge…",
  "Writing the receipt…",
  "Cherry is running…",
]

const SET_LOADING_MESSAGES = [
  "Installing your AI…",
  "Copying skills…",
  "Wiring up tools…",
  "Recording on-chain…",
]

const VARIANT_BY_PHASE: Record<Phase, BaoVariant> = {
  idle: "default",
  loading: "sleeping",
  success: "celebrate",
  error: "confused",
}

export function PurchaseModal({
  open,
  action,
  target,
  agents,
  defaultAgentId,
  onClose,
  onSuccess,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId ?? agents[0]?.id ?? "")
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [result, setResult] = useState<{
    txHash?: string | null
    explorerUrl?: string | null
    chain?: string | null
    onChain?: boolean
    creditsUsed?: number
    creditsAfter?: number
  } | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0]
  const actionVerb = action === "purchase" ? "Purchase" : "Follow"

  // Reset phase ONLY when the modal opens fresh or the target changes.
  // Important: do NOT depend on `agents` — parent refreshes it after a
  // successful purchase (to update credit balance), and that would
  // otherwise kick us back into `idle` while the receipt is showing.
  useEffect(() => {
    if (!open) return
    setPhase("idle")
    setErrorMsg("")
    setResult(null)
    setShowDetails(false)
    setLoadingMsgIdx(0)
  }, [open, target?.conceptId])

  // Pick a default agent once agents become available (no phase reset).
  useEffect(() => {
    if (defaultAgentId) {
      setSelectedAgentId(defaultAgentId)
    } else if (!selectedAgentId && agents[0]?.id) {
      setSelectedAgentId(agents[0].id)
    }
  }, [defaultAgentId, agents, selectedAgentId])

  // Cycle loading messages every 5s so it doesn't loop in a blink.
  useEffect(() => {
    if (phase !== "loading") return
    const t = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 5000)
    return () => clearInterval(t)
  }, [phase])

  // Success stays open until the user acknowledges — they want to SEE the
  // transaction, not watch the receipt disappear on them.

  async function handleConfirm() {
    if (!target || !selectedAgent) return
    setPhase("loading")
    setErrorMsg("")
    try {
      if (target.agentTradeSlug) {
        const resp = await buyAgentTradeSkill(selectedAgent.api_key, target.agentTradeSlug)
        const prov = resp.provenance ?? ({} as any)
        setResult({
          txHash: prov.hash ?? null,
          explorerUrl: prov.explorer_url ?? null,
          chain: prov.chain ?? null,
          onChain: !!prov.on_chain,
          creditsUsed: resp.credits_consumed,
          creditsAfter: resp.credits_after,
        })
        setPhase("success")
        onSuccess?.({ txHash: prov.hash ?? null, creditsAfter: resp.credits_after })
        return
      }

      if (target.shopSet) {
        // Set mode — calls `/shop/buy-and-install`.
        const resp = await buySet(selectedAgent.api_key, target.shopSet.id, "status")
        if (resp.partial) {
          setErrorMsg(
            "Some components failed to install. Your credits were fully refunded. Please try again.",
          )
          setPhase("error")
          return
        }
        const prov = resp.provenance ?? ({} as any)
        setResult({
          txHash: prov.hash ?? null,
          explorerUrl: prov.explorer_url ?? null,
          chain: prov.chain ?? null,
          onChain: !!prov.on_chain,
          creditsUsed: resp.credits_consumed,
          creditsAfter: resp.credits_after,
        })
        setPhase("success")
        onSuccess?.({ txHash: prov.hash ?? null, creditsAfter: resp.credits_after })
        return
      }

      // Component mode (kept for main-site catalog; Shop no longer uses this).
      const call = action === "purchase" ? purchaseConcept : followConcept
      const resp = await call(selectedAgent.api_key, target.conceptId, "status")
      let creditsAfter: number | undefined
      try {
        const bal = await fetchBalance(selectedAgent.api_key)
        creditsAfter = typeof bal?.credits === "number" ? bal.credits : undefined
      } catch { /* ignore */ }
      const prov = resp?.provenance ?? {}
      const txHash: string | null = prov.hash ?? null
      const chain: string | null = prov.chain ?? null
      const explorerUrl: string | null = prov.explorer_url ?? null
      const onChain: boolean = prov.on_chain ?? false
      const creditsUsed = resp?.credits_consumed ?? target.creditsBase
      setResult({ txHash, explorerUrl, chain, onChain, creditsUsed, creditsAfter })
      setPhase("success")
      onSuccess?.({ txHash, creditsAfter })
    } catch (err) {
      const e = err as { code?: string; status?: number; message?: string; credits_required?: number; credits_available?: number }
      const code = e?.code
      const status = e?.status
      let msg = e?.message ?? String(err)
      if (code === "INSUFFICIENT_CREDITS" || status === 402) {
        const need = e?.credits_required ?? target?.creditsBase
        const have = e?.credits_available
        msg =
          typeof have === "number"
            ? `크레딧이 부족합니다. 필요: ${need}cr · 보유: ${have}cr`
            : `크레딧이 부족합니다. 이 거래는 ${need}cr이 필요해요.`
      }
      setErrorMsg(msg)
      setPhase("error")
    }
  }

  if (!open || !target) return null

  const variant = VARIANT_BY_PHASE[phase]

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={phase === "loading" ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-[#3A2A1C]/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[380px] rounded-2xl bg-[#FDFBF5] p-6 shadow-2xl"
        style={{ border: "1px solid #E9D1A6" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Cherry character ── */}
        <div className="flex flex-col items-center pt-2">
          <CherryBao size={104} variant={variant} animate={phase !== "loading"} />

          {/* Phase-specific headline */}
          <div className="mt-4 min-h-[48px] text-center">
            {phase === "idle" && (
              <>
                <h2 className="text-[18px] font-extrabold text-[#3A2A1C]">
                  {target.conceptTitle}
                </h2>
                <p className="mt-1 text-[12px] text-[#8E7555]">
                  {target.shopSet
                    ? `Install this ${target.shopSet.slotCount}-slot AI?`
                    : action === "purchase"
                      ? "Add this skill to your AI?"
                      : "Follow this concept?"}
                </p>
              </>
            )}
            {phase === "loading" && (
              <>
                <h2 className="text-[16px] font-bold text-[#3A2A1C] animate-pulse">
                  {(target?.shopSet ? SET_LOADING_MESSAGES : LOADING_MESSAGES)[
                    loadingMsgIdx % (target?.shopSet ? SET_LOADING_MESSAGES.length : LOADING_MESSAGES.length)
                  ]}
                </h2>
                <p className="mt-1 text-[11px] text-[#B8A788]">Hang tight…</p>
              </>
            )}
            {phase === "success" && (
              <>
                <h2 className="text-[18px] font-extrabold text-[#2D7A5E]">
                  ✓ Installed on {selectedAgent?.name ?? "your AI"}
                </h2>
                <p className="mt-1 text-[12px] text-[#8E7555]">
                  {target.conceptTitle}
                </p>
              </>
            )}
            {phase === "error" && (
              <>
                <h2 className="text-[16px] font-bold text-[#C8301E]">
                  Something went wrong
                </h2>
                <p className="mt-1 text-[11px] text-[#9A7C55] break-words">{errorMsg}</p>
              </>
            )}
          </div>
        </div>

        {/* ── Body: idle shows purchase form, success shows receipt ── */}
        <div className="mt-4">
          {phase === "idle" && (
            <div className="space-y-3">
              {/* Agent selector */}
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
                  Target AI
                </span>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[13px] font-semibold text-[#3A2A1C]"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  {agents.length === 0 && <option value="">No AI connected</option>}
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon ? `${a.icon} ` : ""}
                      {a.name}
                      {typeof a.credits === "number" ? ` · ${a.credits} cr` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/* Price line */}
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
              >
                <span className="text-[11px] text-[#8E7555]">{actionVerb} cost</span>
                <span className="text-[15px] font-extrabold text-[#3A2A1C] tabular-nums">
                  {target.creditsBase} <span className="text-[10px] text-[#9A7C55]">cr</span>
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-lg bg-white border text-[13px] font-bold text-[#6B4F2A] hover:bg-[#F5E4C2]/50"
                  style={{ borderColor: "#E9D1A6" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedAgent}
                  className="flex-1 h-10 rounded-lg bg-[#C8301E] text-white text-[13px] font-extrabold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
                >
                  {actionVerb}
                </button>
              </div>
            </div>
          )}

          {phase === "success" && result && (
            <div className="space-y-3">
              {/* Compact receipt */}
              <div
                className="rounded-lg px-3 py-2.5 space-y-1.5"
                style={{ backgroundColor: "#E9F6EF", border: "1px solid #BEE0D0" }}
              >
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#2D7A5E] font-semibold">Used</span>
                  <span className="tabular-nums text-[#2D7A5E] font-bold">
                    −{result.creditsUsed} cr
                  </span>
                </div>
                {typeof result.creditsAfter === "number" && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#2D7A5E] font-semibold">Balance</span>
                    <span className="tabular-nums text-[#2D7A5E] font-bold">
                      {result.creditsAfter} cr
                    </span>
                  </div>
                )}
              </div>

              {/* On-chain transaction — clickable link to the block explorer
                  when available, falling back to plain hash for mock runs. */}
              {result.txHash && (
                <div
                  className="rounded-lg px-3 py-2 space-y-1"
                  style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
                      Transaction
                    </span>
                    {result.chain && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#9A7C55]">
                        {result.chain}
                      </span>
                    )}
                  </div>
                  {result.explorerUrl ? (
                    <a
                      href={result.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#B12A17] hover:text-[#8F1D12] underline decoration-dotted break-all leading-snug"
                    >
                      <span>{result.txHash}</span>
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <div className="text-[10px] font-mono text-[#3A2A1C] break-all leading-snug">
                      {result.txHash}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full h-10 rounded-lg bg-[#3A2A1C] text-white text-[13px] font-extrabold hover:bg-[#2A1E15] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-2">
              <button
                onClick={() => setPhase("idle")}
                className="w-full h-10 rounded-lg bg-[#C8301E] text-white text-[13px] font-bold hover:bg-[#8F1D12] cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="w-full h-10 rounded-lg bg-white border text-[12px] font-semibold text-[#6B4F2A] cursor-pointer"
                style={{ borderColor: "#E9D1A6" }}
              >
                Close
              </button>
            </div>
          )}

          {phase === "loading" && (
            <div className="flex justify-center">
              {/* Tri-dot bounce */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#C8301E] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
