"use client"

import { useEffect, useMemo, useState } from "react"
import {
  fetchAgents,
  fetchAgentSelfReport,
  fetchShopSets,
  type ShopSet,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { ShopSubTabs } from "./shop-subtabs"
import { ShopSetCard } from "./shop-set-card"
import { ShopSetDetailModal } from "./shop-set-detail-modal"
import {
  PurchaseModal,
  type PurchaseAgent,
  type PurchaseTarget,
} from "./purchase-modal"

type DomainFilter = "all" | "hunter" | "quant" | "grounded" | "policy" | "writer" | "tutor" | "scribe"

const DOMAIN_OPTIONS: ReadonlyArray<{ value: DomainFilter; label: string }> = [
  { value: "all",      label: "All" },
  { value: "hunter",   label: "Shopping" },
  { value: "quant",    label: "Quant" },
  { value: "grounded", label: "Research" },
  { value: "policy",   label: "Policy" },
  { value: "writer",   label: "Writer" },
  { value: "tutor",    label: "Tutor" },
  { value: "scribe",   label: "Scribe" },
]

export function ShopByDomain() {
  const [sets, setSets] = useState<ShopSet[]>([])
  const [filter, setFilter] = useState<DomainFilter>("all")
  const [inspect, setInspect] = useState<ShopSet | null>(null)
  const [buyTarget, setBuyTarget] = useState<PurchaseTarget | null>(null)
  const [agents, setAgents] = useState<PurchaseAgent[]>([])
  const [ownedByAgent, setOwnedByAgent] = useState<Record<string, Set<string>>>({})
  const token = typeof window === "undefined" ? null : getAccessToken()

  // Load shop sets
  useEffect(() => {
    fetchShopSets().then(setSets).catch(() => setSets([]))
  }, [])

  // Load agents (for purchase target dropdown)
  useEffect(() => {
    if (!token) return
    fetchAgents()
      .then((data) => {
        if (!Array.isArray(data)) return
        setAgents(
          data.map((a: any) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            api_key: a.api_key,
            karma_tier: a.karma_tier,
            credits: a.credits,
          })),
        )
      })
      .catch(() => {})
  }, [token])

  // Subscribe to self-report events so OWNED badges stay live without polling.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const agentId = detail?.agentId
      if (!agentId) return
      const items = detail?.report?.local_skills?.items ?? []
      const ids = new Set<string>()
      for (const s of items) {
        if (!s?.hasSkillMd) continue
        const folder = String(s.dir ?? "").split(/[\\/]/).filter(Boolean).pop() ?? ""
        if (folder.startsWith("cherry-")) ids.add(folder.slice(7))
      }
      setOwnedByAgent((prev) => ({ ...prev, [agentId]: ids }))
    }
    window.addEventListener("kaas-self-report", handler)
    return () => window.removeEventListener("kaas-self-report", handler)
  }, [])

  // Fire a self-report whenever an agent is available so OWNED hydrates on mount.
  useEffect(() => {
    const first = agents[0]
    if (!first) return
    fetchAgentSelfReport(first.id)
      .then((r: any) => {
        if (!r?.ok || !r?.report) return
        window.dispatchEvent(
          new CustomEvent("kaas-self-report", {
            detail: { report: r.report, agentId: first.id, agentName: first.name },
          }),
        )
      })
      .catch(() => {})
  }, [agents])

  // Re-run after purchase so the set card flips to OWNED.
  useEffect(() => {
    const onDone = () => {
      const first = agents[0]
      if (!first) return
      fetchAgentSelfReport(first.id)
        .then((r: any) => {
          if (!r?.ok || !r?.report) return
          window.dispatchEvent(
            new CustomEvent("kaas-self-report", {
              detail: { report: r.report, agentId: first.id, agentName: first.name },
            }),
          )
        })
        .catch(() => {})
    }
    window.addEventListener("kaas-purchase-complete", onDone)
    return () => window.removeEventListener("kaas-purchase-complete", onDone)
  }, [agents])

  const visible = useMemo(() => {
    return filter === "all" ? sets : sets.filter((s) => s.domain === filter)
  }, [sets, filter])

  const ownedSet = agents[0] ? ownedByAgent[agents[0].id] ?? new Set<string>() : new Set<string>()

  return (
    <div>
      <ShopSubTabs value={filter} onChange={setFilter} options={DOMAIN_OPTIONS} />
      {sets.length === 0 ? (
        <div className="text-[12px] italic text-[#9A7C55] py-12 text-center">
          Loading sets…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((s) => {
            const owned = s.components.filter((c) => ownedSet.has(c.cardId)).length
            return (
              <ShopSetCard
                key={s.id}
                set={s}
                ownedCount={owned}
                onBuy={() =>
                  setBuyTarget({
                    conceptId: s.id,
                    conceptTitle: s.title,
                    creditsBase: s.priceBundled,
                    shopSet: s,
                  })
                }
                onInspect={() => setInspect(s)}
              />
            )
          })}
        </div>
      )}

      {inspect && (
        <ShopSetDetailModal
          set={inspect}
          onClose={() => setInspect(null)}
          onBuy={() => {
            const s = inspect
            setInspect(null)
            setBuyTarget({
              conceptId: s.id,
              conceptTitle: s.title,
              creditsBase: s.priceBundled,
              shopSet: s,
            })
          }}
        />
      )}

      <PurchaseModal
        open={!!buyTarget}
        action="purchase"
        target={buyTarget}
        agents={agents}
        onClose={() => setBuyTarget(null)}
        onSuccess={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("kaas-purchase-complete"))
          }
        }}
      />
    </div>
  )
}
