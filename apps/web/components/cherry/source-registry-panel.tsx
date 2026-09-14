"use client"

/**
 * 소스 관리 — 노션에서 옮겨 온 표를 보고 고친다.
 * 목업이 정본이다: apps/docs/source-registry/mockups/source-registry-mockup.html
 * 기획 §3 · D1~D15
 *
 * 노션에서 가져온 것은 넷뿐이다 — 표 고르기 · 행 보기 · 행 추가 · 칸/칼럼 고치기.
 */

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  addField, addRow, getTable, KIND_LABEL, listTables, removeRow, setCell, updateField,
  type FieldKind, type RegistryField, type RegistryRow, type RegistryTable, type TableDetail,
} from "@/lib/registry-api"

/** 칼럼 종류별 너비. 표가 실제로 넓어져야 가로 스크롤이 생긴다. */
const WIDTH: Record<FieldKind, number> = {
  text: 190, url: 260, long: 300, select: 130, multi: 240, date: 150,
}

/** 연필 — 그 칸에 마우스를 올렸을 때만 나온다. */
const Pencil = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

type Edit = { rowId: string; key: string } | null
type Ask = { title: string; body: string; warn: string; ok: string; run: () => void } | null

export function SourceRegistryPanel() {
  const [tables, setTables] = useState<RegistryTable[]>([])
  const [curKey, setCurKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [edit, setEdit] = useState<Edit>(null)
  const [open, setOpen] = useState<string | null>(null)   // 상세를 연 행
  const [full, setFull] = useState(false)
  const [ask, setAsk] = useState<Ask>(null)
  const [dlg, setDlg] = useState(false)
  /** 칼럼 머리줄의 `⋯` 메뉴. 평소엔 아이콘도 안 보이고, 마우스를 올려야 나온다. */
  const [menu, setMenu] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listTables().then((t) => { setTables(t); setCurKey((k) => k ?? t[0]?.key ?? null) })
      .catch((e) => setError(e.message))
  }, [])

  const load = useCallback(async (key: string) => {
    try { setDetail(await getTable(key)) } catch (e) { setError((e as Error).message) }
  }, [])

  useEffect(() => { if (curKey) { setDetail(null); setOpen(null); setEdit(null); void load(curKey) } }, [curKey, load])

  /* 편집 중 바깥을 누르면 닫는다. Esc 는 편집 먼저, 없으면 크게 보기에서 나온다. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (edit) setEdit(null)
      else if (full) setFull(false)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [edit, full])

  /** 칸 하나를 화면에서 먼저 바꾸고 서버에 보낸다. 실패하면 되돌린다. */
  async function save(rowId: string, key: string, value: unknown) {
    if (!detail) return
    const before = detail.rows.find((r) => r.id === rowId)?.cells[key]
    setDetail({ ...detail, rows: detail.rows.map((r) => {
      if (r.id !== rowId) return r
      const cells = { ...r.cells }
      const empty = value === "" || value === null || (Array.isArray(value) && value.length === 0)
      if (empty) delete cells[key]; else cells[key] = value
      return { ...r, cells }
    }) })
    try { await setCell(rowId, key, value) } catch (e) {
      setError((e as Error).message)
      void load(detail.table.key)
      void before
    }
  }

  const fields = detail?.fields ?? []
  const rows = detail?.rows ?? []
  const curTable = tables.find((t) => t.key === curKey)

  /* ── 칸 한 개 그리기 ── */
  function cell(f: RegistryField, r: RegistryRow) {
    const v = r.cells[f.key]
    if (f.kind === "multi") {
      const list = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : []
      return list.length
        ? list.map((c) => <span key={c} className="mr-1 inline-block rounded bg-[#F3EFFA] px-1.5 text-[10.5px] font-semibold text-[#7B5EA7]">{c}</span>)
        : <span className="text-[#CCC]">—</span>
    }
    if (v === undefined || v === null || v === "") return <span className="text-[#CCC]">—</span>
    const s = String(v)
    if (f.kind === "url") return <a href={s} target="_blank" rel="noopener noreferrer" className="text-[#A85D2C]">{s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 34)}</a>
    if (f.kind === "select") return <span className="inline-block rounded bg-[#FFF3E8] px-1.5 text-[10.5px] font-semibold text-[#A85D2C]">{s}</span>
    if (f.kind === "long") return <span title={s}>{s.slice(0, 38)}{s.length > 38 ? "…" : ""}</span>
    return s
  }

  /* ── 칸 편집기 ── */
  function editor(f: RegistryField, r: RegistryRow) {
    const raw = r.cells[f.key]
    const close = () => setEdit(null)

    if (f.kind === "multi") {
      const sel = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : []
      const opts = f.options ?? []
      const toggle = (o: string) => void save(r.id, f.key, sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])
      return (
        <div className="relative z-10 min-w-[280px] rounded-lg border border-[#D4854A] bg-white p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1.5 flex min-h-[20px] flex-wrap gap-1">
            {sel.length ? sel.map((c) => (
              <button key={c} onClick={() => toggle(c)} className="cursor-pointer rounded bg-[#F3EFFA] px-1.5 text-[10.5px] font-semibold text-[#7B5EA7] hover:bg-[#F6DCDC] hover:text-[#C0503C]">{c} ✕</button>
            )) : <span className="text-[11px] text-[#CCC]">아직 없습니다 — 아래에서 고르세요</span>}
          </div>
          <div className="flex max-h-[130px] flex-wrap gap-1 overflow-y-auto border-t border-[#F0F0F0] pt-1.5">
            {opts.map((o) => (
              <button key={o} onClick={() => toggle(o)}
                className={cn("cursor-pointer rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
                  sel.includes(o) ? "border-[#7B5EA7] bg-[#F3EFFA] text-[#7B5EA7]" : "border-[#E0E0E0] text-[#888] hover:border-[#D4854A] hover:text-[#A85D2C]")}>{o}</button>
            ))}
          </div>
          <form className="mt-1.5 flex gap-1.5" onSubmit={async (e) => {
            e.preventDefault()
            const el = (e.currentTarget.elements.namedItem("v") as HTMLInputElement)
            const v = el.value.trim(); if (!v) return
            if (!opts.includes(v)) { await updateField(f.id, { options: [...opts, v] }); }
            await save(r.id, f.key, [...sel, v])
            el.value = ""
            void load(detail!.table.key)
          }}>
            <input name="v" placeholder="새 값을 만들어 담기" className="flex-1 rounded-md border border-[#E0E0E0] px-2 py-1 text-[11.5px] outline-none focus:border-[#D4854A]" />
            <button className="rounded-md border border-[#E0E0E0] px-2 text-[11.5px] font-semibold text-[#666]">추가</button>
          </form>
          <button onClick={close} className="mt-1.5 w-full rounded-md bg-[#D4854A] py-1 text-[12px] font-semibold text-white">완료</button>
        </div>
      )
    }
    if (f.kind === "select") {
      const opts = f.options ?? []
      return (
        <select autoFocus defaultValue={raw ? String(raw) : ""} onClick={(e) => e.stopPropagation()}
          onChange={(e) => { void save(r.id, f.key, e.target.value); close() }}
          className="w-full rounded-md border border-[#D4854A] px-2 py-1 text-[12.5px] outline-none">
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    const common = {
      autoFocus: true, defaultValue: raw ? String(raw) : "",
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { void save(r.id, f.key, e.target.value.trim()); close() },
      className: "w-full rounded-md border border-[#D4854A] px-2 py-1 text-[12.5px] text-[#1A1626] outline-none",
    }
    if (f.kind === "long") return <textarea {...common} className={common.className + " min-h-[64px] leading-[1.55]"} />
    return <input {...common} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }} />
  }

  /* ── 화면 ── */
  const grid = (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-[#F0F0F0] px-3.5 py-3">
        <h3 className="text-[14px] font-bold text-[#1A1626]">{detail?.table.label ?? "…"}</h3>
        <span className="text-[11px] text-[#999]">{rows.length}행 · 칼럼 {fields.length}개</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => setDlg(true)} className="cursor-pointer rounded-lg border border-[#E0E0E0] px-2.5 py-1 text-[12px] font-semibold text-[#666] hover:border-[#D4854A] hover:text-[#D4854A]">+ 칼럼</button>
          <button disabled={busy} onClick={async () => {
            if (!detail) return
            setBusy(true)
            try { const r = await addRow(detail.table.key); setDetail({ ...detail, rows: [...detail.rows, r] }); setEdit({ rowId: r.id, key: fields[0]?.key }) }
            catch (e) { setError((e as Error).message) } finally { setBusy(false) }
          }} className="cursor-pointer rounded-lg bg-[#D4854A] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40">+ 행 추가</button>
          <button onClick={() => { setFull(!full); setEdit(null) }} title={full ? "원래 화면으로 돌아갑니다 (Esc)" : "메뉴를 감추고 표만 화면 가득 봅니다"}
            className={cn("cursor-pointer rounded-lg border px-2.5 py-1 text-[12px] font-semibold",
              full ? "border-[#1A1626] bg-[#1A1626] text-white hover:bg-black" : "border-[#E0E0E0] text-[#666] hover:border-[#D4854A] hover:text-[#D4854A]")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline align-[-2px]">
              {full ? <><path d="M4 14h6v6" /><path d="M20 10h-6V4" /><path d="M14 10l7-7" /><path d="M3 21l7-7" /></>
                    : <><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>}
            </svg>
            {full ? "원래 크기로" : "크게 보기"}
          </button>
          {full && <span className="self-center text-[10.5px] text-[#999]">Esc</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto" onClick={() => { setEdit(null); setMenu(null) }}>
        <table className="w-max border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 w-[34px] border-b border-r border-[#F0F0F0] bg-[#FBFAF8]" />
              {fields.map((f) => (
                <th key={f.id} style={{ width: WIDTH[f.kind], minWidth: WIDTH[f.kind] }}
                  className="group/th sticky top-0 z-20 whitespace-nowrap border-b border-r border-[#F0F0F0] bg-[#FBFAF8] px-2.5 py-2 text-left text-[11px] font-bold text-[#888]">
                  {f.label}<span className="ml-1 text-[10px] font-semibold text-[#CCC]">{KIND_LABEL[f.kind]}</span>
                  {/* 노션처럼 — 평소엔 안 보이고 마우스를 올려야 `⋯` 하나가 뜬다.
                      칼럼마다 아이콘을 늘어놓으면 머리줄이 아이콘 밭이 된다. */}
                  <span className="relative">
                    <button title="칼럼 메뉴"
                      onClick={(e) => { e.stopPropagation(); setMenu(menu === f.id ? null : f.id) }}
                      className={cn("ml-1.5 cursor-pointer rounded px-1 text-[13px] leading-none text-[#BBB] hover:bg-[#F0F0F0] hover:text-[#666]",
                        menu === f.id ? "opacity-100" : "opacity-0 group-hover/th:opacity-100")}>⋯</button>
                    {menu === f.id && (
                      <span className="absolute left-0 top-5 z-30 w-[132px] overflow-hidden rounded-lg border border-[#E0E0E0] bg-white py-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <button className="block w-full cursor-pointer px-3 py-1.5 text-left text-[12px] font-medium text-[#3D3652] hover:bg-[#FAFAFA]"
                          onClick={async () => {
                            setMenu(null)
                            const v = window.prompt("칼럼 이름", f.label)
                            if (!v) return
                            await updateField(f.id, { label: v }); void load(detail!.table.key)
                          }}>이름 바꾸기</button>
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-[#F0F0F0] bg-white group-hover:bg-[#FAFAFA]">
                  <button title="행 열기" onClick={(e) => { e.stopPropagation(); setOpen(r.id) }} className="cursor-pointer px-2 py-1.5 text-[12px] text-[#CCC] hover:text-[#D4854A]">⤢</button>
                </td>
                {fields.map((f) => (
                  <td key={f.id} className="border-b border-r border-[#F0F0F0] align-top">
                    {/* 칸을 눌렀다고 바로 고쳐지지 않는다. 마우스를 올리면 그 칸에만 연필이 뜨고,
                        연필을 눌러야 편집이 열린다 — 지나가다 잘못 누르는 사고를 막는다. */}
                    <div className={cn("group/cell relative min-h-[33px] px-2.5 py-1.5 text-[12.5px] hover:bg-[#FFF8F0]",
                      edit && edit.rowId === r.id && edit.key === f.key
                        ? ""                                     // 편집 중에는 선택기가 잘리면 안 된다
                        : "overflow-hidden text-ellipsis whitespace-nowrap")}>
                      {edit && edit.rowId === r.id && edit.key === f.key ? editor(f, r) : (
                        <>
                          {cell(f, r)}
                          <button title={`${f.label} 고치기`}
                            onClick={(e) => { e.stopPropagation(); setEdit({ rowId: r.id, key: f.key }) }}
                            className="absolute right-1 top-1 hidden rounded border border-[#E0E0E0] bg-white p-1 text-[#888] shadow-sm hover:border-[#D4854A] hover:text-[#D4854A] group-hover/cell:block">
                            <Pencil />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!detail && <div className="px-4 py-8 text-center text-[12px] text-[#999]">불러오는 중…</div>}
      </div>
    </div>
  )

  const panel = open && detail && (() => {
    const r = rows.find((x) => x.id === open)
    if (!r) return null
    return (
      <div className="flex w-[330px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
        <div className="flex items-center border-b border-[#F0F0F0] px-3.5 py-3">
          <h3 className="text-[13px] font-bold text-[#1A1626]">{String(r.cells[fields[0]?.key] ?? "(이름 없음)")}</h3>
          <button onClick={() => setOpen(null)} className="ml-auto cursor-pointer text-[15px] text-[#888]">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3.5">
          {fields.map((f) => (
            <div key={f.id} className="mb-3.5">
              <label className="mb-1 block text-[10px] font-bold tracking-[.5px] text-[#999]">{f.label}</label>
              <div className="group/cell relative rounded-md px-1 py-0.5 text-[12.5px] hover:bg-[#FFF8F0]">
                {edit && edit.rowId === r.id && edit.key === f.key ? editor(f, r) : (
                  <>
                    {cell(f, r)}
                    <button title={`${f.label} 고치기`}
                      onClick={() => setEdit({ rowId: r.id, key: f.key })}
                      className="absolute right-0 top-0 hidden rounded border border-[#E0E0E0] bg-white p-1 text-[#888] shadow-sm hover:border-[#D4854A] hover:text-[#D4854A] group-hover/cell:block">
                      <Pencil />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="border-t border-[#F0F0F0] pt-3.5">
            <button onClick={() => setAsk({
              title: "이 행을 지울까요?", body: `${String(r.cells[fields[0]?.key] ?? "(이름 없음)")} 을(를) 지웁니다.`,
              warn: "화면에서 사라지지만 DB 에는 남습니다 — 되살릴 수 있습니다.", ok: "행 삭제",
              run: async () => { await removeRow(r.id); setOpen(null); void load(detail.table.key) },
            })} className="cursor-pointer rounded-lg bg-[#C0503C] px-4 py-2 text-[13px] font-semibold text-white">이 행 삭제</button>
          </div>
        </div>
      </div>
    )
  })()

  const modal = ask && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35" onClick={() => setAsk(null)}>
      <div className="w-[420px] rounded-2xl bg-white px-5 py-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-[15px] font-bold text-[#1A1626]">{ask.title}</h3>
        <p className="text-[13px]">{ask.body}</p>
        <p className="mt-1.5 rounded-lg border border-[#EFC8C0] bg-[#FBEAE7] px-3 py-2.5 text-[12px] leading-[1.6] text-[#C0503C]">{ask.warn}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setAsk(null)} className="cursor-pointer rounded-lg border border-[#E0E0E0] px-3 py-1.5 text-[12px] font-semibold text-[#666]">취소</button>
          <button onClick={() => { const run = ask.run; setAsk(null); run() }} className="cursor-pointer rounded-lg bg-[#C0503C] px-3 py-1.5 text-[12px] font-semibold text-white">{ask.ok}</button>
        </div>
      </div>
    </div>
  )

  const colDlg = dlg && detail && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35" onClick={() => setDlg(false)}>
      <form className="w-[420px] rounded-2xl bg-white px-5 py-5" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault()
          const f = e.currentTarget
          const label = (f.elements.namedItem("label") as HTMLInputElement).value.trim()
          const kind = (f.elements.namedItem("kind") as HTMLSelectElement).value as FieldKind
          if (!label) return
          try { await addField(detail.table.key, { label, kind }); setDlg(false); void load(detail.table.key) }
          catch (err) { setError((err as Error).message) }
        }}>
        <h3 className="mb-3 text-[15px] font-bold text-[#1A1626]">칼럼 추가 — {detail.table.label}</h3>
        <label className="mb-1 block text-[10px] font-bold tracking-[.5px] text-[#999]">이름</label>
        <input name="label" autoFocus placeholder="예: 구독자 수" className="w-full rounded-lg border border-[#E0E0E0] px-2.5 py-2 text-[13px] outline-none focus:border-[#D4854A]" />
        <label className="mb-1 mt-3 block text-[10px] font-bold tracking-[.5px] text-[#999]">종류</label>
        <select name="kind" className="w-full rounded-lg border border-[#E0E0E0] px-2.5 py-2 text-[13px] outline-none">
          {(Object.keys(KIND_LABEL) as FieldKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDlg(false)} className="cursor-pointer rounded-lg border border-[#E0E0E0] px-3 py-1.5 text-[12px] font-semibold text-[#666]">취소</button>
          <button className="cursor-pointer rounded-lg bg-[#D4854A] px-3 py-1.5 text-[12px] font-semibold text-white">추가</button>
        </div>
      </form>
    </div>
  )

  if (full) {
    return <div className="fixed inset-0 z-40 flex gap-3 bg-[#F4F3F1] p-3">{grid}{panel}{modal}{colDlg}</div>
  }

  return (
    <div className="flex h-full min-h-[520px] w-full min-w-0 items-stretch gap-4">
      <div className="flex w-[210px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
        <h3 className="px-3.5 pb-2 pt-3 text-[11px] font-extrabold tracking-[.5px] text-[#999]">표</h3>
        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          {tables.map((t) => (
            <button key={t.key} onClick={() => setCurKey(t.key)}
              className={cn("flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px]",
                t.key === curKey ? "bg-[#FFF8F0] font-bold text-[#A85D2C]" : "text-[#3D3652] hover:bg-[#FAFAFA]")}>
              {t.label}<span className="ml-auto text-[11px] text-[#CCC]">{t.rows}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#F0F0F0] px-3 py-2.5 text-[11px] text-[#999]">
          노션 {tables.length}개 표 · 총 {tables.reduce((n, t) => n + t.rows, 0)}행
        </div>
      </div>
      {grid}
      {panel}
      {modal}
      {colDlg}
      {error && <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-[#C0503C] px-3 py-2 text-[12px] text-white" onClick={() => setError(null)}>{error}</div>}
    </div>
  )
}
