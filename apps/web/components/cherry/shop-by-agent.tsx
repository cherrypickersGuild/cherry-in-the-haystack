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
import { mockInventory } from "@/lib/workshop-mock"
import { PurchaseModal, type PurchaseTarget } from "./purchase-modal"

/** Map a Workshop card slug (`p-hunter`) → human title + summary from the
 *  shared inventory. The slug in self-report drops the `cherry-` prefix; the
 *  inventory id is `inv-<slug>`. */
function lookupCard(slug: string): { title: string; summary: string } | null {
  const found = mockInventory.find((i) => i.id === `inv-${slug}`)
  if (!found) return null
  return { title: found.title, summary: found.summary }
}

/** Pretty-print kind for the badge. Concept = market knowledge, Workshop =
 *  hand-built card from the inventory. */
const KIND_LABEL: Record<string, string> = {
  concept: "Concept",
  card: "Workshop",
}

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

  const onlineCount = others.filter((a) => a.connected).length

  return (
    <div>
      {/* Compare-from selector */}
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
        <span className="ml-auto text-[10px] text-[#9A7C55]">
          {onlineCount} online · {others.length} total
        </span>
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
        {[...others]
          .sort((a, b) => Number(b.connected) - Number(a.connected))
          .map((a) => (
            <AgentCard key={a.id} agent={a} onCompare={() => setTarget(a)} />
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
              Agent Trade · {AGENT_TRADE_FLAT_PRICE} cr / file
            </div>
            <h2 className="mt-1 text-[16px] font-extrabold text-[#3A2A1C] truncate">
              {target.name} → {myAgent.name}
            </h2>
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
            <ComparingState targetName={target.name} myName={myAgent.name} />
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
              <>
                <div
                  className="mb-3 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                  style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
                >
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#9A7C55]">
                      Knowledge only in
                    </div>
                    <div className="text-[13px] font-extrabold text-[#3A2A1C] truncate">
                      {target.name}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-[10px] font-extrabold tabular-nums px-2 py-1 rounded-md"
                    style={{ backgroundColor: "#FBE8E3", color: "#B12A17" }}
                  >
                    {buyable.length} file{buyable.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {buyable.map((item) => (
                    <SkillRow key={item.slug} item={item} onBuy={buy} />
                  ))}
                </ul>
              </>
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

/** Subtle, muted accent palette so each agent gets a slightly different left
 *  edge without breaking the cream/cherry tone. Offline agents collapse to a
 *  dim beige so connection state still reads at a glance. */
const AGENT_ACCENTS = ["#9C5A1F", "#2F5BA8", "#7A2D6F", "#2D7A5E", "#A86A1F", "#5C4A8A"]
function accentFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AGENT_ACCENTS[hash % AGENT_ACCENTS.length]
}

function AgentCard({
  agent,
  onCompare,
}: {
  agent: { id: string; name: string; connected: boolean }
  onCompare: () => void
}) {
  const accent = agent.connected ? accentFor(agent.id) : "#C9B88A"
  return (
    <article
      className="relative rounded-lg bg-white p-3 transition-all hover:shadow-md"
      style={{
        border: "1px solid #D4CEBD",
        borderLeftWidth: "4px",
        borderLeftColor: accent,
      }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[#1A1626] truncate">
            {agent.name}
          </div>
          <div className="text-[10px] font-mono text-[#9A7C55] mt-0.5 truncate">
            {agent.id.slice(0, 8)}…
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase flex-shrink-0"
          style={{
            backgroundColor: agent.connected ? "#E9F6EF" : "#F5EFE2",
            color: agent.connected ? "#2D7A5E" : "#9A7C55",
            border: `1px solid ${agent.connected ? "#BEE0D0" : "#E9D1A6"}`,
          }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${agent.connected ? "animate-pulse" : ""}`}
            style={{ backgroundColor: agent.connected ? "#2D7A5E" : "#C9B88A" }}
          />
          {agent.connected ? "Live" : "Offline"}
        </span>
      </header>
      <button
        onClick={onCompare}
        disabled={!agent.connected}
        title={agent.connected ? "" : "Offline — diff returns empty"}
        className="mt-2.5 h-7 px-2.5 rounded-md text-[11px] font-bold border bg-white text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "#E89080" }}
      >
        Compare →
      </button>
    </article>
  )
}

function ComparingState({ targetName, myName }: { targetName: string; myName: string }) {
  const messages = [
    "Comparing knowledge systems…",
    "Fetching skill manifests…",
    "Sorting shared vs unique skills…",
    "Filtering buyable items…",
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1100)
    return () => clearInterval(t)
  }, [messages.length])

  return (
    <div className="py-10 flex flex-col items-center text-center">
      {/* Two-agent comparison animation */}
      <div className="flex items-center gap-3 mb-4">
        <AgentBubble name={myName} />
        <div className="flex flex-col items-center">
          <span className="text-[18px] text-[#C8301E] animate-pulse leading-none">⇄</span>
          <span className="mt-1 text-[8px] font-bold tracking-wider uppercase text-[#9A7C55]">
            Comparing
          </span>
        </div>
        <AgentBubble name={targetName} delay="0.3s" />
      </div>

      {/* Tri-dot bounce */}
      <div className="flex gap-1.5 mb-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#C8301E] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      <p className="text-[12px] font-semibold text-[#3A2A1C] animate-pulse min-h-[18px]">
        {messages[idx]}
      </p>
      <p className="mt-1 text-[10px] text-[#9A7C55]">
        Reading the target agent's self-report.
      </p>
    </div>
  )
}

function AgentBubble({ name, delay }: { name: string; delay?: string }) {
  return (
    <div
      className="rounded-xl bg-white px-3 py-2 min-w-[80px] max-w-[120px] animate-pulse"
      style={{
        border: "1px solid #E9D1A6",
        boxShadow: "0 1px 2px rgba(107,79,42,0.08)",
        animationDelay: delay,
      }}
    >
      <div className="text-[8px] font-bold uppercase tracking-wider text-[#9A7C55] mb-0.5">
        Agent
      </div>
      <div className="text-[12px] font-extrabold text-[#3A2A1C] truncate">{name}</div>
    </div>
  )
}

const KIND_THEME: Record<string, { label: string; bg: string; fg: string; accent: string }> = {
  concept: { label: "지식",       bg: "#EAF1FB", fg: "#2F5BA8", accent: "#2F5BA8" },
  card:    { label: "워크샵 카드", bg: "#FBF1E4", fg: "#9C5A1F", accent: "#9C5A1F" },
}

function SkillRow({
  item,
  onBuy,
}: {
  item: ClassifiedSkill
  onBuy: (item: ClassifiedSkill) => void
}) {
  const theme =
    KIND_THEME[item.kind] ?? { label: item.kind, bg: "#F0E7D4", fg: "#6B4F2A", accent: "#6B4F2A" }
  // For cards we fall back to local inventory metadata so the row shows a real
  // title + description instead of just a cryptic slug.
  const card = item.kind === "card" ? lookupCard(item.slug) : null
  const title = item.title && item.title !== item.slug ? item.title : (card?.title ?? item.slug)
  const summary = item.summary || card?.summary || ""

  return (
    <li
      className="rounded-xl bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md flex items-start gap-3"
      style={{
        border: "1px solid #D4CEBD",
        borderLeftWidth: "4px",
        borderLeftColor: theme.accent,
        boxShadow: "0 1px 0 rgba(107,79,42,0.04), 0 2px 8px rgba(107,79,42,0.05)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
            style={{ backgroundColor: theme.bg, color: theme.fg }}
          >
            {KIND_LABEL[item.kind] ?? theme.label}
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-[#3A2A1C] truncate">
          {title}
        </div>
        {summary && (
          <p className="mt-1 text-[11px] text-[#6B4F2A] leading-snug line-clamp-2">
            {summary}
          </p>
        )}
        <div className="mt-1.5 text-[9px] font-mono text-[#9A7C55] truncate">
          {item.slug}
        </div>
      </div>
      <button
        onClick={() => onBuy(item)}
        className="flex-shrink-0 h-8 px-3 rounded-md text-[11px] font-bold border bg-white text-[#B12A17] hover:bg-[#FBE8E3]/40 cursor-pointer transition-colors tabular-nums"
        style={{ borderColor: "#E89080" }}
      >
        Buy {AGENT_TRADE_FLAT_PRICE}
        <span className="text-[9px] opacity-80 ml-0.5">cr</span>
      </button>
    </li>
  )
}
