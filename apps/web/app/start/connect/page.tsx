"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { deleteAgent, fetchAgents, registerAgent } from "@/lib/api"
import { getAccessToken, useAuthTick } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"

interface Agent {
  id: string
  name: string
  icon?: string
  api_key?: string
  karma_tier?: string
  credits?: number
  wallet_address?: string
  wallet_type?: "evm" | "near" | string
}

type WalletType = "evm" | "near"

export default function ConnectPage() {
  useAuthTick()
  const token = getAccessToken()

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [os, setOs] = useState<"mac" | "win">("mac")
  const [copied, setCopied] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    load()
  }, [token])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAgents()
      setAgents(data ?? [])
      if (data?.[0]?.id && !selectedId) setSelectedId(data[0].id)
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteAgent(id)
      setDeleteConfirmId(null)
      if (selectedId === id) setSelectedId("")
      await load()
    } catch {
      /* noop */
    } finally {
      setDeleting(false)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0]

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://solteti.site"
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    (siteUrl.includes("localhost:3000") ? "http://localhost:4000" : "https://api.solteti.site")

  const cmdMac = selected
    ? `curl -so ~/cherry-agent.js ${siteUrl}/cherry-agent.js && curl -so ~/cherry-kaas.sh ${siteUrl}/cherry-kaas.sh && chmod +x ~/cherry-kaas.sh && claude mcp add cherry-kaas ~/cherry-kaas.sh --env KAAS_AGENT_API_KEY=${selected.api_key ?? "YOUR_KEY"} --env KAAS_WS_URL=${apiUrl}`
    : ""
  const cmdWin = selected
    ? `curl.exe -so "$env:USERPROFILE\\cherry-agent.js" ${siteUrl}/cherry-agent.js; curl.exe -so "$env:USERPROFILE\\cherry-kaas.bat" ${siteUrl}/cherry-kaas.bat; claude mcp add cherry-kaas "$env:USERPROFILE\\cherry-kaas.bat" --env KAAS_AGENT_API_KEY=${selected.api_key ?? "YOUR_KEY"} --env KAAS_WS_URL=${apiUrl}`
    : ""
  const cmd = os === "mac" ? cmdMac : cmdWin
  const removeCmd = "claude mcp remove cherry-kaas"

  // ── Unauthenticated ──
  if (!token) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={120} animate />
        <h1 className="mt-6 text-[22px] font-extrabold text-[#3A2A1C]">
          Sign in to continue
        </h1>
        <Link
          href="/start/login?next=/start/connect"
          className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold hover:shadow-lg transition-all"
        >
          Sign in
        </Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={96} variant="sleeping" animate />
        <p className="mt-4 text-[13px] text-[#9A7C55]">Loading…</p>
      </section>
    )
  }

  if (agents.length === 0) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={120} animate />
        <h1 className="mt-6 text-[22px] font-extrabold text-[#3A2A1C]">
          Build your first AI?
        </h1>
        <p className="mt-2 text-[13px] text-[#6B4F2A] max-w-md">
          Just pick a name and we'll issue your AI card instantly. 200 free credits to get you started.
        </p>
        <button
          onClick={() => setShowRegister(true)}
          className="mt-6 px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold shadow-md hover:shadow-lg transition-all"
        >
          + New AI
        </button>
        {showRegister && (
          <RegisterAgentModal
            onClose={() => setShowRegister(false)}
            onSuccess={async () => {
              setShowRegister(false)
              await load()
            }}
          />
        )}
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {/* ── 내 AI 목록 (여러 개 가능, 삭제 포함) ── */}
      <div
        className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">My AIs</h3>
          <button
            onClick={() => setShowRegister(true)}
            className="text-[11px] font-bold text-[#C8301E] hover:underline"
          >
            + New AI
          </button>
        </div>
        <div className="space-y-2">
          {agents.map((a) => {
            const isSelected = a.id === selectedId
            const isConfirming = deleteConfirmId === a.id
            return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`rounded-[14px] p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#F5E4C2]/50 border border-[#E9D1A6]"
                    : "bg-white border border-[#F0E7D4] hover:bg-[#FBF6ED]"
                }`}
              >
                <div className="text-[20px] leading-none flex-shrink-0">{a.icon ?? "🤖"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-extrabold text-[#3A2A1C] truncate">{a.name}</span>
                    {a.karma_tier && <KarmaStars tier={a.karma_tier} />}
                  </div>
                  <div className="text-[11px] text-[#9A7C55] font-mono truncate">
                    {a.id.slice(0, 8)}…
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[13px] font-extrabold text-[#3A2A1C] tabular-nums">
                    {a.credits ?? 200}
                    <span className="text-[10px] text-[#9A7C55] ml-0.5">cr</span>
                  </div>
                  <ConnectionDot id={a.id} />
                </div>

                {isConfirming ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 flex-shrink-0"
                  >
                    <span className="text-[10px] font-bold text-[#C8301E]">Delete?</span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting}
                      className="px-2 py-1 rounded-md bg-[#C8301E] text-white text-[10px] font-bold hover:bg-[#8F1D12] disabled:opacity-50"
                    >
                      {deleting ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 rounded-md border border-[#E9D1A6] text-[#6B4F2A] text-[10px] font-bold hover:bg-[#FBF6ED]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(a.id)
                    }}
                    title="Delete this AI"
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#9A7C55] hover:bg-[#FBE8E3] hover:text-[#C8301E] transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showRegister && (
        <RegisterAgentModal
          onClose={() => setShowRegister(false)}
          onSuccess={async () => {
            setShowRegister(false)
            await load()
          }}
        />
      )}

      {selected && (
        <>
          {/* ── Claude Code 연결 가이드 ── */}
          <div
            className="rounded-[20px] bg-[#FDFBF5] p-5 lg:p-6"
            style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">Connect your AI</h3>
                <p className="text-[12px] text-[#9A7C55] mt-0.5">
                  Hook <span className="font-bold text-[#3A2A1C]">{selected.name}</span> up to Claude Code.
                </p>
              </div>
              <div className="inline-flex p-0.5 rounded-full bg-[#F5E4C2]/40 border border-[#E9D1A6]">
                {(["mac", "win"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setOs(k)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${
                      os === k
                        ? "bg-white text-[#3A2A1C] shadow-sm"
                        : "text-[#9A7C55] hover:text-[#6B4F2A]"
                    }`}
                  >
                    {k === "mac" ? "Mac / Linux" : "Windows"}
                  </button>
                ))}
              </div>
            </div>

            <ol className="space-y-2 mb-4">
              {["Copy the command", "Paste into your terminal", "Hit Enter — done!"].map((step, i) => (
                <li key={i} className="flex items-center gap-3 text-[13px] text-[#6B4F2A]">
                  <span className="w-6 h-6 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[11px] font-black flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="relative">
              <pre
                className="rounded-xl bg-[#FBF6ED] p-4 pr-14 text-[11px] leading-relaxed font-mono text-[#3A2A1C] overflow-x-auto break-all whitespace-pre-wrap"
                style={{ border: "1px solid #E9D1A6" }}
              >
                {cmd}
              </pre>
              <button
                onClick={() => copyText(cmd, "cmd")}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white border border-[#E9D1A6] text-[10px] font-bold text-[#6B4F2A] hover:bg-[#F5E4C2]/60 transition-colors"
              >
                {copied === "cmd" ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-[#E9D1A6]">
              <details className="text-[12px]">
                <summary className="cursor-pointer text-[#9A7C55] hover:text-[#6B4F2A] font-semibold">
                  How to disconnect
                </summary>
                <div className="relative mt-2">
                  <pre
                    className="rounded-lg bg-[#FBF6ED] p-3 pr-14 text-[11px] font-mono text-[#3A2A1C]"
                    style={{ border: "1px solid #E9D1A6" }}
                  >
                    {removeCmd}
                  </pre>
                  <button
                    onClick={() => copyText(removeCmd, "remove")}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white border border-[#E9D1A6] text-[10px] font-bold text-[#6B4F2A] hover:bg-[#F5E4C2]/60 transition-colors"
                  >
                    {copied === "remove" ? "✓" : "📋"}
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Help card */}
          <div
            className="rounded-[20px] p-5 flex items-center gap-4"
            style={{ backgroundColor: "#FBF6ED", border: "1px solid #E9D1A6" }}
          >
            <CherryBao size={56} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#3A2A1C]">
                Don't have Claude Code yet?
              </p>
              <p className="text-[11px] text-[#6B4F2A] mt-0.5">
                Get it free from Anthropic.
              </p>
            </div>
            <a
              href="https://claude.ai/download"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[12px] font-bold hover:bg-[#6B4F2A] transition-colors flex-shrink-0"
            >
              Install guide →
            </a>
          </div>
        </>
      )}
    </section>
  )
}

function KarmaStars({ tier }: { tier: string }) {
  const stars = tier === "Platinum" ? 4 : tier === "Gold" ? 3 : tier === "Silver" ? 2 : 1
  return (
    <span className="text-[11px] leading-none" style={{ color: "#C9A24A" }}>
      {Array.from({ length: stars }).map((_, i) => <span key={i}>★</span>)}
      {Array.from({ length: 4 - stars }).map((_, i) => <span key={`e-${i}`} style={{ color: "#E9D1A6" }}>★</span>)}
    </span>
  )
}

/* ══════════ 새 AI 등록 모달 ══════════ */
function RegisterAgentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const [name, setName] = useState("")
  const [walletType, setWalletType] = useState<WalletType>("evm")
  const [walletAddress, setWalletAddress] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (walletType !== "near") return
    let cancelled = false
    ;(async () => {
      try {
        const { getConnectedNearAccount } = await import("@/lib/near-connector")
        const acct = await getConnectedNearAccount()
        if (!cancelled && acct) setWalletAddress(acct)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walletType])

  async function connectMetaMask() {
    setError("")
    setConnecting(true)
    try {
      const eth = (window as any).ethereum
      if (!eth) {
        setError("MetaMask isn't installed. Please install it first.")
        return
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      if (accounts?.[0]) setWalletAddress(accounts[0])
    } catch {
      setError("MetaMask connection failed.")
    } finally {
      setConnecting(false)
    }
  }

  async function connectNear() {
    setError("")
    setConnecting(true)
    try {
      const { connectNearWallet } = await import("@/lib/near-connector")
      const id = await connectNearWallet()
      setWalletAddress(id)
    } catch (e: any) {
      setError(`NEAR wallet connection failed: ${e?.message ?? e}`)
    } finally {
      setConnecting(false)
    }
  }

  async function changeWallet() {
    if (walletType === "near") {
      try {
        const { disconnectNearWallet } = await import("@/lib/near-connector")
        await disconnectNearWallet()
      } catch {
        /* ignore */
      }
    }
    setWalletAddress("")
    setError("")
  }

  async function handleRegister() {
    if (!name.trim() || !walletAddress) return
    setRegistering(true)
    setError("")
    try {
      await registerAgent({
        name: name.trim(),
        wallet_address: walletAddress,
        wallet_type: walletType,
        domain_interests: [],
      })
      await onSuccess()
    } catch (e: any) {
      setError(e?.message || "Registration failed.")
    } finally {
      setRegistering(false)
    }
  }

  const canRegister = name.trim().length > 0 && walletAddress.length > 0 && !registering

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(58,42,28,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[24px] bg-[#FDFBF5] p-6 lg:p-7 relative"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 20px 50px rgba(107,79,42,0.25)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#9A7C55] hover:bg-[#FBE8E3] hover:text-[#C8301E] transition-colors"
        >
          ×
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <CherryBao size={72} animate />
          <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">Create a new AI</h2>
          <p className="mt-1 text-[12px] text-[#9A7C55]">
            A name and a wallet. That's all it takes.
          </p>
        </div>

        {/* 1. Name */}
        <label className="block mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            1. Name your AI
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crypto Watcher · Auction Sniper"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-[#FBF6ED] text-[14px] text-[#3A2A1C] placeholder:text-[#C9B88A] outline-none focus:bg-white focus:ring-2 focus:ring-[#C8301E]/30 transition"
            style={{ border: "1px solid #E9D1A6" }}
          />
        </label>

        {/* 2. Wallet */}
        <div className="mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            2. Connect your wallet
          </span>
          <p className="text-[11px] text-[#9A7C55] mt-0.5 mb-2">
            Credit top-ups, withdrawals, and usage logs are recorded here.
          </p>

          <div className="inline-flex p-0.5 rounded-full bg-[#F5E4C2]/40 mb-3" style={{ border: "1px solid #E9D1A6" }}>
            {(["evm", "near"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setWalletType(t)
                  setWalletAddress("")
                  setError("")
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${
                  walletType === t
                    ? "bg-white text-[#3A2A1C] shadow-sm"
                    : "text-[#9A7C55] hover:text-[#6B4F2A]"
                }`}
              >
                {t === "evm" ? "🦊 MetaMask" : "🪐 NEAR"}
              </button>
            ))}
          </div>

          {walletAddress ? (
            <div className="rounded-xl bg-[#EFF7F3] p-3 flex items-center gap-2" style={{ border: "1px solid #B8D8C4" }}>
              <span className="w-2 h-2 rounded-full bg-[#2D7A5E] flex-shrink-0" />
              <span className="text-[12px] font-mono text-[#2D7A5E] truncate flex-1">
                {walletAddress}
              </span>
              <button
                onClick={changeWallet}
                className="text-[10px] font-bold text-[#6B4F2A] hover:underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={walletType === "evm" ? connectMetaMask : connectNear}
              disabled={connecting}
              className="w-full rounded-xl bg-[#3A2A1C] text-[#FDFBF5] py-3 text-[13px] font-extrabold hover:bg-[#6B4F2A] disabled:opacity-60 transition-colors"
            >
              {connecting
                ? "Connecting…"
                : walletType === "evm"
                ? "🦊 Connect MetaMask"
                : "🪐 Connect NEAR"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-[#FBE8E3] px-3 py-2 text-[12px] text-[#C8301E]" style={{ border: "1px solid #F2C7BE" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={!canRegister}
          className="w-full rounded-full bg-[#C8301E] text-white py-3 text-[14px] font-extrabold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all"
        >
          {registering ? "Creating…" : "✨ Create AI"}
        </button>

        <p className="mt-3 text-center text-[11px] text-[#9A7C55]">
          You get 200 free credits the moment you register.
        </p>
      </div>
    </div>
  )
}

function ConnectionDot({ id }: { id?: string }) {
  const connected = Boolean(id)
  return (
    <div className="flex items-center gap-1 justify-end mt-0.5 text-[9px] font-semibold text-[#9A7C55]">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: connected ? "#2D7A5E" : "#9A7C55" }}
      />
      {connected ? "Ready" : "Not connected"}
    </div>
  )
}
