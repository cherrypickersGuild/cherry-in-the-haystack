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
          먼저 로그인이 필요해요
        </h1>
        <Link
          href="/start/login?next=/start/connect"
          className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold hover:shadow-lg transition-all"
        >
          로그인
        </Link>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={96} variant="sleeping" animate />
        <p className="mt-4 text-[13px] text-[#9A7C55]">불러오는 중…</p>
      </section>
    )
  }

  if (agents.length === 0) {
    return (
      <section className="flex flex-col items-center text-center py-16">
        <CherryBao size={120} animate />
        <h1 className="mt-6 text-[22px] font-extrabold text-[#3A2A1C]">
          첫 번째 AI 를 만들어 볼까요?
        </h1>
        <p className="mt-2 text-[13px] text-[#6B4F2A] max-w-md">
          이름 하나만 정해주시면 바로 AI 카드를 발급해 드려요. 시작은 200 크레딧 무료.
        </p>
        <button
          onClick={() => setShowRegister(true)}
          className="mt-6 px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold shadow-md hover:shadow-lg transition-all"
        >
          + 새 AI 만들기
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
        className="rounded-[20px] bg-white p-5 lg:p-6"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">내 AI</h3>
          <button
            onClick={() => setShowRegister(true)}
            className="text-[11px] font-bold text-[#C8301E] hover:underline"
          >
            + 새 AI 만들기
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
                    <span className="text-[10px] font-bold text-[#C8301E]">정말 삭제?</span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting}
                      className="px-2 py-1 rounded-md bg-[#C8301E] text-white text-[10px] font-bold hover:bg-[#8F1D12] disabled:opacity-50"
                    >
                      {deleting ? "…" : "삭제"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-1 rounded-md border border-[#E9D1A6] text-[#6B4F2A] text-[10px] font-bold hover:bg-[#FBF6ED]"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(a.id)
                    }}
                    title="이 AI 삭제"
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
            className="rounded-[20px] bg-white p-5 lg:p-6"
            style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#3A2A1C]">AI 연결하기</h3>
                <p className="text-[12px] text-[#9A7C55] mt-0.5">
                  <span className="font-bold text-[#3A2A1C]">{selected.name}</span> 를 Claude Code 에 연결해요.
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
              {["명령 복사하기", "터미널에 붙여넣기", "Enter — 완료!"].map((step, i) => (
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
                {copied === "cmd" ? "✓ 복사됨" : "📋 복사"}
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-[#E9D1A6]">
              <details className="text-[12px]">
                <summary className="cursor-pointer text-[#9A7C55] hover:text-[#6B4F2A] font-semibold">
                  연결 해제 방법
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
                아직 Claude Code 가 없으신가요?
              </p>
              <p className="text-[11px] text-[#6B4F2A] mt-0.5">
                Anthropic 에서 무료로 받으실 수 있어요.
              </p>
            </div>
            <a
              href="https://claude.ai/download"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[12px] font-bold hover:bg-[#6B4F2A] transition-colors flex-shrink-0"
            >
              설치 가이드 →
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
        setError("MetaMask 가 설치되어 있지 않아요. 먼저 설치해 주세요.")
        return
      }
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      if (accounts?.[0]) setWalletAddress(accounts[0])
    } catch {
      setError("MetaMask 연결에 실패했어요.")
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
      setError(`NEAR 지갑 연결 실패: ${e?.message ?? e}`)
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
      setError(e?.message || "등록에 실패했어요.")
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
        className="w-full max-w-[480px] rounded-[24px] bg-white p-6 lg:p-7 relative"
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
          <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">새 AI 만들기</h2>
          <p className="mt-1 text-[12px] text-[#9A7C55]">
            이름 하나, 지갑 연결 하나. 그게 전부예요.
          </p>
        </div>

        {/* 1. 이름 */}
        <label className="block mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            1. 이 AI 의 이름
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 코인 비서 · 경매 감시인"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-[#FBF6ED] text-[14px] text-[#3A2A1C] placeholder:text-[#C9B88A] outline-none focus:bg-white focus:ring-2 focus:ring-[#C8301E]/30 transition"
            style={{ border: "1px solid #E9D1A6" }}
          />
        </label>

        {/* 2. 지갑 */}
        <div className="mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7C55]">
            2. 전자지갑 연결
          </span>
          <p className="text-[11px] text-[#9A7C55] mt-0.5 mb-2">
            크레딧 충전·출금, 이용 기록이 이 지갑에 기록돼요.
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
                변경
              </button>
            </div>
          ) : (
            <button
              onClick={walletType === "evm" ? connectMetaMask : connectNear}
              disabled={connecting}
              className="w-full rounded-xl bg-[#3A2A1C] text-[#FDFBF5] py-3 text-[13px] font-extrabold hover:bg-[#6B4F2A] disabled:opacity-60 transition-colors"
            >
              {connecting
                ? "연결 중…"
                : walletType === "evm"
                ? "🦊 MetaMask 연결"
                : "🪐 NEAR 연결"}
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
          {registering ? "만드는 중…" : "✨ AI 만들기"}
        </button>

        <p className="mt-3 text-center text-[11px] text-[#9A7C55]">
          등록과 동시에 200 크레딧이 무료로 지급돼요.
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
      {connected ? "준비됨" : "미연결"}
    </div>
  )
}
