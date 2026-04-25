"use client"

/**
 * ShopByAgent — third Shop tab.
 *
 *   1. Pick "my agent" from the dropdown.
 *   2. See a grid of every other registered agent.
 *   3. Click "Compare" → modal lists their skills split into Both /
 *      Only Theirs / Only Mine.
 *   4. Click "Buy 5cr" on any "Only Theirs" item → server installs that
 *      single SKILL.md to my agent for a flat 5 credits.
 */

import { useEffect, useState } from "react"
import {
  AGENT_TRADE_FLAT_PRICE,
  fetchAgentDiff,
  fetchAgents,
  fetchShopAgents,
  type AgentTradeDiff,
  type ClassifiedSkill,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { PurchaseModal, type PurchaseTarget } from "./purchase-modal"

interface MyAgent {
  id: string
  name: string
  api_key: string
  credits?: number
}

export function ShopByAgent() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const token = mounted ? getAccessToken() : null

  const [myAgents, setMyAgents] = useState<MyAgent[]>([])
  const [myAgentId, setMyAgentId] = useState<string>("")
  const [others, setOthers] = useState<{ id: string; name: string; connected: boolean }[]>([])
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const myAgent = myAgents.find((a) => a.id === myAgentId) ?? myAgents[0]

  // Load my agents
  useEffect(() => {
    if (!token) return
    fetchAgents()
      .then((data: any) => {
        if (!Array.isArray(data)) return
        const list: MyAgent[] = data.map((a) => ({
          id: a.id,
          name: a.name,
          api_key: a.api_key,
          credits: a.credits,
        }))
        setMyAgents(list)
        if (list[0]) setMyAgentId(list[0].id)
      })
      .catch(() => setMyAgents([]))
  }, [token])

  // Load other agents whenever myAgent changes
  useEffect(() => {
    if (!myAgent) return
    setLoading(true)
    fetchShopAgents(myAgent.api_key)
      .then(setOthers)
      .catch(() => setOthers([]))
      .finally(() => setLoading(false))
  }, [myAgent?.id])

  if (!mounted) return null

  if (!token) {
    return (
      <p className="text-[12px] italic text-[#9A7C55] py-12 text-center">
        Sign in to compare with other agents.
      </p>
    )
  }

  if (myAgents.length === 0) {
    return (
      <p className="text-[12px] italic text-[#9A7C55] py-12 text-center">
        Register an AI assistant first (Install Skill tab).
      </p>
    )
  }

  return (
    <div>
      {/* My agent selector */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[#6B4F2A]">
        <span>Compare from:</span>
        <select
          value={myAgentId}
          onChange={(e) => setMyAgentId(e.target.value)}
          className="rounded-md border bg-white px-2 py-1 text-[12px] font-semibold text-[#3A2A1C] cursor-pointer"
          style={{ borderColor: "#E9D1A6" }}
        >
          {myAgents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {typeof a.credits === "number" ? ` · ${a.credits} cr` : ""}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-[11px] italic text-[#9A7C55]">Loading…</p>
      )}

      {!loading && others.length === 0 && (
        <p className="text-[12px] italic text-[#9A7C55] py-12 text-center">
          No other agents to trade with yet.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {others.map((a) => (
          <article
            key={a.id}
            className="rounded-lg bg-white p-3.5 transition-all hover:shadow-md relative"
            style={{ border: "1px solid #D4CEBD" }}
          >
            {/* Connection badge — green pulse when live, dim when offline. */}
            <span
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: a.connected ? "#2D7A5E" : "#B8A788" }}
              title={a.connected ? "Connected via cherry-kaas MCP" : "Not connected"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${a.connected ? "animate-pulse" : ""}`}
                style={{ backgroundColor: a.connected ? "#2D7A5E" : "#C9B88A" }}
              />
              {a.connected ? "online" : "offline"}
            </span>
            <div className="text-[14px] font-extrabold text-[#3A2A1C] truncate pr-14">
              {a.name}
            </div>
            <div className="mt-0.5 text-[10px] font-mono text-[#9A7C55] truncate">
              {a.id.slice(0, 8)}…
            </div>
            <button
              onClick={() => setTarget(a)}
              disabled={!a.connected}
              title={a.connected ? "" : "This agent is offline — diff will be empty"}
              className="mt-3 h-8 px-3 rounded-md text-[11px] font-bold border bg-white text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "#E89080" }}
            >
              Compare →
            </button>
          </article>
        ))}
      </div>

      {target && myAgent && (
        <DiffModal
          target={target}
          myAgent={myAgent}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Diff modal — three sections, Buy on Only Theirs
───────────────────────────────────────────── */

function DiffModal({
  target,
  myAgent,
  onClose,
}: {
  target: { id: string; name: string }
  myAgent: MyAgent
  onClose: () => void
}) {
  const [diff, setDiff] = useState<AgentTradeDiff | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseTarget | null>(null)

  const reload = () => {
    setDiff(null)
    setError(null)
    fetchAgentDiff(target.id, myAgent.api_key)
      .then(setDiff)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id])

  function buy(item: ClassifiedSkill) {
    if (item.kind === "meta" || item.kind === "unknown") return
    setPurchaseTarget({
      conceptId: item.slug,
      conceptTitle: item.title || item.slug,
      creditsBase: AGENT_TRADE_FLAT_PRICE,
      agentTradeSlug: item.slug,
    })
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
        className="relative w-full max-w-[520px] rounded-2xl bg-[#FDFBF5] shadow-2xl overflow-hidden flex flex-col"
        style={{ border: "1px solid #E9D1A6", maxHeight: "85vh" }}
      >
        <header
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b"
          style={{ borderColor: "#E9D1A6" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9A7C55]">
              Learn from another agent
            </div>
            <h2 className="mt-0.5 text-[15px] font-extrabold text-[#3A2A1C] truncate">
              {target.name}'s knowledge
            </h2>
            <p className="mt-0.5 text-[11px] text-[#8E7555]">
              Skills {target.name} has that {myAgent.name} doesn't.
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!diff && !error && (
            <p className="text-[11px] italic text-[#9A7C55]">Loading…</p>
          )}
          {error && (
            <div
              className="rounded-lg px-3 py-2 text-[11px]"
              style={{ backgroundColor: "#FBE8E3", border: "1px solid #F2C7BE", color: "#C8301E" }}
            >
              {error}
            </div>
          )}
          {diff && (() => {
            const buyable = diff.onlyTheirs.filter(
              (i) => i.kind !== "meta" && i.kind !== "unknown",
            )
            if (buyable.length === 0) {
              return (
                <p className="text-[12px] italic text-[#9A7C55] py-10 text-center">
                  Nothing new to learn — {myAgent.name} already has every shared skill.
                </p>
              )
            }
            return (
              <ul className="space-y-2">
                {buyable.map((item) => (
                  <SkillRow key={item.slug} item={item} onBuy={buy} />
                ))}
              </ul>
            )
          })()}
        </div>
      </div>

      <PurchaseModal
        open={!!purchaseTarget}
        action="purchase"
        target={purchaseTarget}
        agents={[{ id: myAgent.id, name: myAgent.name, api_key: myAgent.api_key, credits: myAgent.credits }]}
        defaultAgentId={myAgent.id}
        onClose={() => setPurchaseTarget(null)}
        onSuccess={() => {
          reload()
          window.dispatchEvent(new CustomEvent("kaas-purchase-complete"))
        }}
      />
    </div>
  )
}

const KIND_THEME: Record<string, { label: string; bg: string; fg: string }> = {
  concept: { label: "Concept",  bg: "#EAF1FB", fg: "#2F5BA8" },
  card:    { label: "Workshop", bg: "#FBF1E4", fg: "#9C5A1F" },
}

function SkillRow({
  item,
  onBuy,
}: {
  item: ClassifiedSkill
  onBuy: (item: ClassifiedSkill) => void
}) {
  const theme = KIND_THEME[item.kind] ?? { label: item.kind, bg: "#F0E7D4", fg: "#6B4F2A" }
  return (
    <li
      className="rounded-xl bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-3"
      style={{
        border: "1px solid #D4CEBD",
        boxShadow: "0 1px 0 rgba(107,79,42,0.04), 0 2px 8px rgba(107,79,42,0.05)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
            style={{ backgroundColor: theme.bg, color: theme.fg }}
          >
            {theme.label}
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-[#3A2A1C] truncate">
          {item.title || item.slug}
        </div>
        {item.summary ? (
          <p className="mt-0.5 text-[11px] text-[#6B4F2A] leading-snug line-clamp-1">
            {item.summary}
          </p>
        ) : (
          <div className="mt-0.5 text-[10px] font-mono text-[#9A7C55] truncate">
            {item.slug}
          </div>
        )}
      </div>
      <button
        onClick={() => onBuy(item)}
        className="flex-shrink-0 h-9 px-3 rounded-lg text-[12px] font-extrabold text-white shadow-sm hover:shadow-md cursor-pointer transition-shadow tabular-nums"
        style={{ backgroundColor: "#C8301E" }}
      >
        Buy {AGENT_TRADE_FLAT_PRICE}
        <span className="text-[9px] font-bold opacity-80 ml-0.5">cr</span>
      </button>
    </li>
  )
}
