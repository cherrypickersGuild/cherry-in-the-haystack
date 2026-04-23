"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchAgents } from "@/lib/api"
import { getAccessToken, useAuthTick } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"
import { KaasWorkshopPanel } from "@/components/cherry/kaas-workshop-panel"

interface Agent {
  id: string
  name: string
  icon?: string
  api_key?: string
  karma_tier?: string
}

export default function WorkshopPage() {
  useAuthTick()
  const token = getAccessToken()

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchAgents()
      .then((data) => {
        setAgents(data ?? [])
        if (data?.[0]?.id) setSelectedId(data[0].id)
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [token])

  const selected = agents.find((a) => a.id === selectedId)

  // ── Unauthenticated ──
  if (!token) {
    return (
      <section className="flex flex-col items-center justify-center text-center py-16">
        <CherryBao size={140} animate />
        <h1 className="mt-6 text-[26px] font-extrabold text-[#3A2A1C]">
          나만의 AI, 만들어 보세요
        </h1>
        <p className="mt-2 text-[14px] text-[#6B4F2A] max-w-md leading-relaxed">
          드래그 · 드롭 · 완성. 개발은 전혀 몰라도 괜찮아요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C8301E] text-white text-[14px] font-bold shadow-md hover:shadow-lg transition-all"
        >
          시작하기
        </Link>
      </section>
    )
  }

  // ── No agents yet ──
  if (!loading && agents.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center text-center py-16">
        <CherryBao size={120} variant="sleeping" animate />
        <h1 className="mt-6 text-[22px] font-extrabold text-[#3A2A1C]">
          아직 AI 가 없어요
        </h1>
        <p className="mt-2 text-[13px] text-[#6B4F2A] max-w-md leading-relaxed">
          먼저 Connect 탭에서 AI 를 만들거나 연결해 주세요.
        </p>
        <Link
          href="/start/connect"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3A2A1C] text-[#FDFBF5] text-[13px] font-bold hover:bg-[#6B4F2A] transition-colors"
        >
          Connect 로 이동
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {/* Header — agent picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#9A7C55]">
          <span>Editing</span>
        </div>
        <AgentPicker
          agents={agents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <p className="ml-auto text-[11px] text-[#9A7C55] italic hidden lg:inline">
          장착한 모든 변경은 AI 별로 자동 저장돼요.
        </p>
      </div>

      {/* Workshop — reuse existing panel.
          The panel is self-contained: it renders the Diablo equipment view,
          inventory with pagination, and per-build register toggle. */}
      <div
        className="rounded-[20px] bg-white overflow-hidden"
        style={{
          border: "1px solid #E9D1A6",
          boxShadow: "0 4px 20px rgba(107,79,42,0.08)",
        }}
      >
        <div className="h-[calc(100vh-220px)] min-h-[720px] overflow-hidden">
          <KaasWorkshopPanel
            currentAgent={selected}
            currentAgentApiKey={selected?.api_key}
          />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   AgentPicker — compact pulldown with Bao + name
───────────────────────────────────────────── */
function AgentPicker({
  agents, selectedId, onSelect,
}: {
  agents: Agent[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0]
  if (!selected) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E9D1A6] hover:bg-[#F5E4C2]/30 transition-colors cursor-pointer"
      >
        <span className="text-[16px] leading-none">{selected.icon ?? "🤖"}</span>
        <span className="text-[13px] font-bold text-[#3A2A1C]">{selected.name}</span>
        <span className="text-[9px] text-[#9A7C55]">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl shadow-lg overflow-hidden min-w-[240px]"
            style={{ border: "1px solid #E9D1A6" }}
          >
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onSelect(a.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  a.id === selectedId
                    ? "bg-[#F5E4C2]/60 text-[#3A2A1C]"
                    : "hover:bg-[#F5E4C2]/30 text-[#6B4F2A]"
                }`}
              >
                <span className="text-[16px] leading-none">{a.icon ?? "🤖"}</span>
                <span className="text-[13px] font-semibold truncate flex-1">{a.name}</span>
                {a.karma_tier && (
                  <span className="text-[10px] font-mono text-[#9A7C55]">{a.karma_tier}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
