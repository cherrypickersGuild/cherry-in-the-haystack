"use client"

import { useEffect, useMemo, useState } from "react"
import { API_URL, authHeaders } from "@/lib/auth"

/**
 * Overview Builder (관리자 전용)
 * - GET /api/overview/config 로 현재 구성 로드
 * - /building-blocks/entities.json 를 클라이언트에서 검색(백엔드 결합 없음)
 * - 슬롯별 저장(PUT /api/overview/slot/:slot) · 자동 리셋(DELETE) · 전체 재생성(POST regenerate)
 * 기획서: apps/docs/overview-builder-admin-plan.md
 */

type BBItem = {
  entityKey: string; name: string; desc: string; url: string
  stars: number | null; icon: string | null; topic: string; type: string
}
type Slot = { source: "auto" | "admin"; updatedAt: string; updatedBy: string | null; label?: string; sub?: string; items: BBItem[] }
type Block = { key: string; source: "auto" | "admin"; updatedAt: string; updatedBy: string | null; title: string; banner: BBItem[]; rows: BBItem[] }
type Cfg = {
  title: { source: "auto" | "admin"; heading: string; subheading: string }
  hero: Slot; spotlight: Slot; justAdded: Slot; blocks: Block[]
}

const fmtStars = (n: number | null) => (n == null ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`)
const usable = (u: string) => /^https?:\/\//i.test(u)

/** building-blocks 원본을 검색용 평탄 목록으로 */
function flattenBB(payload: any): BBItem[] {
  const out: BBItem[] = []
  for (const t of payload?.topics ?? []) {
    for (const g of t.groups ?? []) {
      for (const e of g.items ?? []) {
        if (!usable(e.u)) continue
        out.push({
          entityKey: `${g.t}|${e.n}`, name: e.n, desc: e.d ?? "", url: e.u,
          stars: e.s ?? null, icon: e.i ?? null, topic: t.l, type: g.t,
        })
      }
    }
  }
  return out
}

/* ── 슬롯 하나(항목 목록) 편집기 ── */
function SlotEditor({
  label, source, updatedAt, items, pool, onSave, onReset, busy,
}: {
  label: string; source: string; updatedAt: string
  items: BBItem[]; pool: BBItem[]
  onSave: (items: BBItem[]) => void; onReset: () => void; busy: boolean
}) {
  const [list, setList] = useState<BBItem[]>(items)
  const [q, setQ] = useState("")
  useEffect(() => { setList(items) }, [items])

  const inList = (k: string) => list.some((x) => x.entityKey === k)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return pool.filter((x) => !inList(x.entityKey) && (x.name.toLowerCase().includes(s) || x.topic.toLowerCase().includes(s) || x.type.toLowerCase().includes(s))).slice(0, 8)
  }, [q, pool, list])
  // 추천 1개 — 목록에 없는 것 중 스타 최다
  const rec = useMemo(() => pool.filter((x) => !inList(x.entityKey)).sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))[0], [pool, list])

  const add = (x: BBItem) => { setList([...list, x]); setQ("") }
  const remove = (k: string) => setList(list.filter((x) => x.entityKey !== k))
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= list.length) return
    const next = [...list];[next[i], next[j]] = [next[j], next[i]]; setList(next)
  }
  const dirty = JSON.stringify(list.map((x) => x.entityKey)) !== JSON.stringify(items.map((x) => x.entityKey))

  return (
    <div className="rounded-[12px] border border-[#E4E1EE] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <b className="text-[14px] text-[#1A1626]">{label}</b>
        <span className="rounded-[6px] px-[6px] py-[1px] text-[10px] font-bold"
          style={{ background: source === "admin" ? "#FDF0F3" : "#F3F1F6", color: source === "admin" ? "#C94B6E" : "#9E97B3" }}>
          {source === "admin" ? `관리자 · ${updatedAt.slice(0, 10)}` : "자동"}
        </span>
        <span className="ml-auto text-[11px] text-[#9E97B3]">{list.length}개</span>
      </div>

      {/* 현재 목록 */}
      <div className="mb-2 flex flex-col gap-1">
        {list.map((x, i) => (
          <div key={x.entityKey} className="flex items-center gap-2 rounded-[8px] bg-[#F9F7FF] px-2 py-1 text-[12.5px]">
            <span className="w-4 text-center text-[10px] text-[#9E97B3]">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{x.name} <span className="text-[#9E97B3]">· {x.topic}/{x.type} {x.stars != null ? `★${fmtStars(x.stars)}` : ""}</span></span>
            <button onClick={() => move(i, -1)} className="px-1 text-[#9E97B3] hover:text-[#1A1626]">↑</button>
            <button onClick={() => move(i, 1)} className="px-1 text-[#9E97B3] hover:text-[#1A1626]">↓</button>
            <button onClick={() => remove(x.entityKey)} className="px-1 text-[#C94B6E]">✕</button>
          </div>
        ))}
      </div>

      {/* 추천 */}
      {rec && (
        <div className="mb-2 text-[11.5px]">
          <span className="text-[#9E97B3]">추천: </span>
          <button onClick={() => add(rec)} className="font-semibold text-[#7B5EA7] hover:underline">
            + {rec.name} ★{fmtStars(rec.stars)}
          </button>
        </div>
      )}

      {/* 검색 추가 */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색해서 추가 (이름/토픽/타입)"
        className="w-full rounded-[8px] border border-[#E4E1EE] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#C7B8E8]" />
      {results.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5 rounded-[8px] border border-[#EEECF4] p-1">
          {results.map((x) => (
            <button key={x.entityKey} onClick={() => add(x)} className="flex items-center gap-2 rounded-[6px] px-2 py-1 text-left text-[12px] hover:bg-[#F8F5FE]">
              <span className="min-w-0 flex-1 truncate">{x.name} <span className="text-[#9E97B3]">· {x.topic}/{x.type} {x.stars != null ? `★${fmtStars(x.stars)}` : ""}</span></span>
              <span className="text-[#7B5EA7]">추가</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={() => onSave(list)} disabled={busy || !dirty}
          className="rounded-full bg-[#C94B6E] px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">저장</button>
        <button onClick={onReset} disabled={busy}
          className="rounded-full border border-[#E4E1EE] px-4 py-1.5 text-[12px] font-semibold text-[#6B727E] disabled:opacity-40">자동으로 리셋</button>
      </div>
    </div>
  )
}

export function OverviewBuilderPanel() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [bb, setBB] = useState<BBItem[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  // 제목 편집
  const [heading, setHeading] = useState("")
  const [subheading, setSubheading] = useState("")

  const loadCfg = () =>
    fetch(`${API_URL}/api/overview/config`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Cfg) => { setCfg(d); setHeading(d.title?.heading ?? ""); setSubheading(d.title?.subheading ?? "") })
      .catch(() => setErr("구성을 불러오지 못했습니다."))

  useEffect(() => {
    loadCfg()
    fetch("/building-blocks/entities.json").then((r) => r.json()).then((p) => setBB(flattenBB(p))).catch(() => {})
  }, [])

  const poolByTopic = (topicKey?: string) =>
    topicKey ? bb.filter((x) => x.topic.toLowerCase() === topicKey.toLowerCase() || x.type.toLowerCase() === topicKey.toLowerCase()) : bb

  const call = async (method: string, slot: string, body?: any) => {
    setBusy(true); setMsg(""); setErr("")
    try {
      const res = await fetch(`${API_URL}/api/overview/slot/${slot}`, {
        method, headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await loadCfg(); setMsg(`${slot} ${method === "DELETE" ? "리셋" : "저장"} 완료`)
    } catch (e) { setErr(`실패: ${e instanceof Error ? e.message : e}`) }
    finally { setBusy(false) }
  }
  const saveItems = (slot: string, items: BBItem[], extra?: any) => call("PUT", slot, { items, ...extra })
  const reset = (slot: string) => call("DELETE", slot)

  const regenerate = async () => {
    setBusy(true); setMsg(""); setErr("")
    try {
      const res = await fetch(`${API_URL}/api/overview/regenerate`, { method: "POST", headers: { ...authHeaders() } })
      if (!res.ok) throw new Error(`${res.status}`)
      await loadCfg(); setMsg("전체 재생성 완료")
    } catch (e) { setErr(`재생성 실패: ${e instanceof Error ? e.message : e}`) }
    finally { setBusy(false) }
  }

  const saveTitle = async () => {
    setBusy(true); setMsg(""); setErr("")
    try {
      const res = await fetch(`${API_URL}/api/overview/slot/title`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ heading, subheading }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await loadCfg(); setMsg("제목 저장 완료")
    } catch (e) { setErr(`실패: ${e instanceof Error ? e.message : e}`) }
    finally { setBusy(false) }
  }

  if (err && !cfg) return <p className="p-4 text-[13px] text-[#C94B6E]">{err}</p>
  if (!cfg) return <p className="p-4 text-[13px] text-[#9E97B3]">Loading…</p>

  return (
    // subTab이 데스크톱에서 flex-row+overflow:hidden → 폭 채우고(flex-1) 자체 세로 스크롤.
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAFAFA] p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[16px] font-extrabold text-[#1A1626]">Overview Builder</h3>
          <button onClick={regenerate} disabled={busy}
            className="ml-auto rounded-full border border-[#E4E1EE] bg-white px-4 py-1.5 text-[12px] font-semibold text-[#6B727E] disabled:opacity-40">
            전체 자동 재생성
          </button>
        </div>
        {msg && <p className="text-[12px] text-[#2E7D32]">{msg}</p>}
        {err && <p className="text-[12px] text-[#C94B6E]">{err}</p>}

        {/* 제목 (전체 폭) */}
        <div className="rounded-[12px] border border-[#E4E1EE] bg-white p-4">
          <b className="text-[14px] text-[#1A1626]">Title</b>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="heading"
              className="flex-1 rounded-[8px] border border-[#E4E1EE] px-3 py-1.5 text-[13px] outline-none focus:border-[#C7B8E8]" />
            <input value={subheading} onChange={(e) => setSubheading(e.target.value)} placeholder="subheading"
              className="flex-1 rounded-[8px] border border-[#E4E1EE] px-3 py-1.5 text-[13px] outline-none focus:border-[#C7B8E8]" />
            <button onClick={saveTitle} disabled={busy} className="rounded-full bg-[#C94B6E] px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">제목 저장</button>
          </div>
        </div>

        {/* 슬롯 — 2열 그리드로 빈 공간 활용 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SlotEditor label="Hero (5)" source={cfg.hero.source} updatedAt={cfg.hero.updatedAt} items={cfg.hero.items} pool={bb}
            onSave={(it) => saveItems("hero", it)} onReset={() => reset("hero")} busy={busy} />
          <SlotEditor label={`${cfg.spotlight.label} (2)`} source={cfg.spotlight.source} updatedAt={cfg.spotlight.updatedAt} items={cfg.spotlight.items} pool={bb}
            onSave={(it) => saveItems("spotlight", it, { label: cfg.spotlight.label, sub: cfg.spotlight.sub })} onReset={() => reset("spotlight")} busy={busy} />
          <SlotEditor label={`${cfg.justAdded.label} (6)`} source={cfg.justAdded.source} updatedAt={cfg.justAdded.updatedAt} items={cfg.justAdded.items} pool={bb}
            onSave={(it) => saveItems("justAdded", it, { label: cfg.justAdded.label, sub: cfg.justAdded.sub })} onReset={() => reset("justAdded")} busy={busy} />

          {cfg.blocks.map((b) => (
            <div key={b.key} className="rounded-[12px] border border-[#E4E1EE] bg-white p-3">
              <b className="text-[13px] text-[#1A1626]">블록 · {b.title}</b>
              <div className="mt-2 flex flex-col gap-3">
                {b.key !== "prompt" && (
                  <SlotEditor label="Banner" source={b.source} updatedAt={b.updatedAt} items={b.banner} pool={poolByTopic(b.key)}
                    onSave={(it) => saveItems(`block:${b.key}`, it, { title: b.title, banner: it, rows: b.rows })} onReset={() => reset(`block:${b.key}`)} busy={busy} />
                )}
                <SlotEditor label="Rows" source={b.source} updatedAt={b.updatedAt} items={b.rows} pool={poolByTopic(b.key)}
                  onSave={(it) => saveItems(`block:${b.key}`, it, { title: b.title, banner: b.banner, rows: it })} onReset={() => reset(`block:${b.key}`)} busy={busy} />
              </div>
            </div>
          ))}
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
