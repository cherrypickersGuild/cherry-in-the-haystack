"use client"

/**
 * 투고 검토 — 관리자
 * 목업이 정본이다: apps/docs/source-submission/mockups/source-review-mockup.html
 * 기획 §10-B · D6(기존 대시보드 탭)
 *
 * 파일과 링크는 하는 일이 달라 목록부터 가른다(기획 §3).
 * 목록·상세는 파일 본문을 받지 않는다 — [내려받기] 를 눌렀을 때만 받는다. 화면에 띄우지 않는다(D20).
 */

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  adminAnalysis,
  adminAnalyze,
  adminDecide,
  adminExport,
  adminFetchFile,
  adminGet,
  adminList,
  adminLoadPreview,
  ANALYSIS_LABEL,
  ANALYSIS_STEPS,
  daysAgoLabel,
  STATE_COLOR,
  STATE_LABEL,
  type AdminSubmission,
  type AnalysisJson,
  type AnalysisState,
  type LoadPreview,
  type SubmissionState,
} from "@/lib/submission-api"

const STATES: (SubmissionState | "ALL")[] = ["ALL", "PENDING", "ON_HOLD", "APPROVED", "REJECTED"]
const SLABEL: Record<string, string> = { ALL: "전체", ...STATE_LABEL }
const TAG_COLOR: Record<AnalysisState, string> = {
  NONE: "bg-[#F0F0F0] text-[#888]",
  RUNNING: "bg-[#FFF3E8] text-[#A85D2C]",
  DONE: "bg-[#E8F3EE] text-[#2D7A5E]",
  FAILED: "bg-[#FBEAE7] text-[#C0503C]",
}

type RTab = "meta" | "doc" | "analysis" | "load" | "export"

export function SourceReviewPanel() {
  const [kind, setKind] = useState<"FILE" | "URL">("FILE")
  const [state, setState] = useState<SubmissionState | "ALL">("ALL")
  const [rows, setRows] = useState<AdminSubmission[]>([])
  const [curId, setCurId] = useState<string | null>(null)
  const [cur, setCur] = useState<AdminSubmission | null>(null)
  const [rtab, setRtab] = useState<RTab>("meta")
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [exported, setExported] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [an, setAn] = useState<AnalysisJson | null>(null)
  const [lp, setLp] = useState<LoadPreview | string | null>(null)
  /** 폴링을 다시 켜는 열쇠. [분석 다시하기] 를 누를 때마다 올린다. */
  const [pollKey, setPollKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const list = await adminList(kind)
      setRows(list)
      setCurId((prev) => (prev && list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.")
    }
  }, [kind])

  useEffect(() => {
    void load()
  }, [load])

  /* 상세는 고를 때 부른다. 파일 본문은 여기 없다. */
  useEffect(() => {
    setRtab("meta")
    if (!curId) {
      setCur(null)
      return
    }
    setAn(null)
    setLp(null)
    adminGet(curId).then(setCur).catch(() => setCur(null))
  }, [curId])

  /* 진행 중이면 화면이 몇 초마다 물어본다 (D10). 끝나면 멈추고 목록의 태그도 같이 고친다.
     끝나서 멈춘 뒤 [분석 다시하기] 를 누르면 pollKey 가 올라가 다시 켜진다. */
  useEffect(() => {
    if (!cur || cur.kind !== "FILE") return
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const tick = async () => {
      try {
        const j = await adminAnalysis(cur.id)
        if (!alive) return
        setAn(j)
        if (j.state !== "RUNNING") {
          stop()
          void load()
          // 분석이 끝나면 적재 미리보기도 새로 받는다 —
          // 미리보기는 분석 결과로 만들어지므로 옛 것을 그대로 두면 어긋난다.
          setLp(null)
        }
      } catch {
        /* 잠깐 못 받아도 다음 번에 다시 묻는다 */
      }
    }
    void tick()
    timer = setInterval(tick, 3000)
    return () => {
      alive = false
      stop()
    }
  }, [cur, load, pollKey])

  useEffect(() => {
    if (rtab !== "load" || !cur || cur.kind !== "FILE" || lp) return
    adminLoadPreview(cur.id)
      .then(setLp)
      .catch((e) => setLp(e instanceof Error ? e.message : "불러오지 못했습니다."))
  }, [rtab, cur, lp])

  async function analyze() {
    if (!cur) return
    setBusy(true)
    setError(null)
    try {
      await adminAnalyze(cur.id)
      setAn({ state: "RUNNING", step: 0 })
      setLp(null)
      setPollKey((k) => k + 1)   // 멈춰 있던 폴링을 다시 켠다
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석을 시작하지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }

  /** 원문은 화면에 띄우지 않는다 — 내려받아서 본다(기획 §4-A). */
  async function download() {
    if (!cur) return
    const blob = await adminFetchFile(cur.id, "download")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = cur.file_name ?? "submission"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function decide(v: "approve" | "hold" | "reject") {
    if (!cur) return
    setBusy(true)
    setError(null)
    try {
      await adminDecide(cur.id, v)
      await load()
      setCur(await adminGet(cur.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }

  const pool = rows.filter((r) => state === "ALL" || r.status === state)
  const anState: AnalysisState = (an?.state ?? cur?.analysis_state ?? "NONE") as AnalysisState
  const needAn = cur?.kind === "FILE" && (anState === "NONE" || anState === "RUNNING")
  const decided = cur?.status === "APPROVED" || cur?.status === "REJECTED"

  const tabs: [RTab, string][] =
    cur?.kind === "URL"
      ? [["meta", "투고 정보"], ["doc", "링크"], ["export", `조사 목록 내보내기${checked.size ? ` (${checked.size})` : ""}`]]
      : [["meta", "투고 정보"], ["doc", "원문"], ["analysis", "분석 정보"], ["load", "적재 미리보기"]]

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] items-stretch gap-5">
      {/* 왼쪽 — 목록 */}
      <div className="flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
        <div className="flex flex-shrink-0 border-b border-[#F0F0F0] px-3 pt-2">
          {([["FILE", "파일"], ["URL", "링크"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setKind(k)
                setState("ALL")
                setChecked(new Set())
              }}
              className={cn(
                "cursor-pointer border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors",
                kind === k ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 px-3 py-2">
          {STATES.filter((st) => st === "ALL" || rows.some((r) => r.status === st)).map((st) => {
            const n = st === "ALL" ? rows.length : rows.filter((r) => r.status === st).length
            return (
              <button
                key={st}
                onClick={() => setState(st)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold",
                  state === st
                    ? "border-[#D4854A] bg-[#FFF8F0] text-[#A85D2C]"
                    : "border-[#E0E0E0] bg-white text-[#888] hover:text-[#333]",
                )}
              >
                {SLABEL[st]}
                <span className="ml-1 font-medium text-[#CCC]">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {pool.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[#999]">없습니다.</div>
          ) : (
            pool.map((d) => (
              <div
                key={d.id}
                onClick={() => setCurId(d.id)}
                className={cn(
                  "mb-1 flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2",
                  d.id === curId ? "border-[#D4854A] bg-[#FFF8F0]" : "border-transparent hover:bg-[#FAFAFA]",
                )}
              >
                {kind === "URL" && (
                  <input
                    type="checkbox"
                    checked={checked.has(d.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => {
                      const next = new Set(checked)
                      next.has(d.id) ? next.delete(d.id) : next.add(d.id)
                      setChecked(next)
                    }}
                    className="mt-0.5 flex-shrink-0 accent-[#D4854A]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-[#1A1626]">{d.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-[7px] text-[10px] text-[#999]">
                    <span>{daysAgoLabel(d.created_at)}</span>
                    <span className={cn("font-semibold", STATE_COLOR[d.status])}>{STATE_LABEL[d.status]}</span>
                    {d.kind === "FILE" && (
                      <span className={cn("rounded px-1.5 font-semibold", TAG_COLOR[(d.analysis_state ?? "NONE") as AnalysisState])}>
                        분석 {ANALYSIS_LABEL[(d.analysis_state ?? "NONE") as AnalysisState]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#F0F0F0] px-3 py-2.5 text-[11px] text-[#999]">
          {kind === "URL" ? (
            <>
              <span>선택 {checked.size}건</span>
              <button
                disabled={!checked.size}
                onClick={() => {
                  setRtab("export")
                  adminExport([...checked]).then((j) => setExported(JSON.stringify(j, null, 2)))
                }}
                className="ml-auto cursor-pointer rounded-lg border border-[#E0E0E0] px-2 py-1 text-[11px] font-semibold text-[#666] disabled:opacity-40"
              >
                JSON 내보내기
              </button>
            </>
          ) : (
            <span>파일은 하나씩 열어 보고 판단합니다</span>
          )}
        </div>
      </div>

      {/* 오른쪽 — 상세 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
        {!cur ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-[#999]">
            왼쪽 목록에서 하나를 고르세요.
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 border-b border-[#E0E0E0] px-5 pt-4">
              <h3 className="text-[14px] font-bold leading-[1.35] text-[#1A1626]">{cur.name}</h3>
              <div className="mt-1 break-all text-[10px] text-[#999]">
                <span className="text-[#7B5EA7]">{cur.kind}</span> · {cur.kind === "URL" ? cur.url : cur.file_name} ·{" "}
                {daysAgoLabel(cur.created_at)}
              </div>
              <div className="mt-3 flex">
                {tabs.map(([k, label], i) => (
                  <button
                    key={k}
                    onClick={() => setRtab(k)}
                    className={cn(
                      "cursor-pointer border-b-2 py-[11px] text-[14px] font-semibold transition-colors",
                      i === 0 ? "mr-2 pl-0 pr-5" : "px-5",
                      rtab === k ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]",
                    )}
                  >
                    {label}
                    {k === "analysis" && (
                      <span className={cn("ml-1.5 rounded px-1.5 py-0.5 text-[10px]", TAG_COLOR[anState])}>
                        {ANALYSIS_LABEL[anState]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 text-[13px]">
              {rtab === "meta" && (
                <>
                  {cur.kind === "FILE" && (
                    <>
                      <Sec>첨부된 파일</Sec>
                      <div className="flex items-center gap-2.5 rounded-[10px] border border-[#D4854A] bg-[#FFF8F0] px-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#1A1626]">{cur.file_name}</div>
                          <div className="mt-0.5 text-[11px] text-[#999]">
                            {((cur.file_size ?? 0) / 1024 / 1024).toFixed(2)} MB · {cur.file_mime}
                          </div>
                        </div>
                        <button
                          onClick={() => void download()}
                          className="ml-auto cursor-pointer rounded-lg border border-[#E0E0E0] px-3 py-1.5 text-[12px] font-semibold text-[#666] hover:border-[#D4854A] hover:text-[#D4854A]"
                        >
                          내려받기
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#999]">
                        원문은 화면에 띄우지 않습니다 — 필요하면 내려받아서 보세요
                      </p>
                      <Sec>업로드 검사</Sec>
                      <dl className="grid grid-cols-[88px_1fr] gap-x-3.5 gap-y-2">
                        <Dt>형식</Dt>
                        <dd>진짜 {cur.file_mime?.includes("pdf") ? "PDF" : "MD"} 맞음 — 파일 선두를 확인했습니다</dd>
                        <Dt>해시</Dt>
                        <dd className="font-mono text-[11px]">{(cur.file_sha256 ?? "").slice(0, 12)}… · 같은 파일 없음</dd>
                        <Dt>악성코드</Dt>
                        <dd className="text-[#A85D2C]">검사하지 않았습니다 — 추가 대응할 예정입니다</dd>
                      </dl>
                    </>
                  )}
                  {cur.kind === "URL" && (
                    <>
                      <Sec>주소</Sec>
                      <a
                        href={cur.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-[13px] text-[#A85D2C]"
                      >
                        {cur.url} ↗
                      </a>
                    </>
                  )}
                  <Sec>유저가 쓴 설명</Sec>
                  <p>{cur.reason || "—"}</p>
                </>
              )}

              {rtab === "doc" &&
                (cur.kind === "URL" ? (
                  <div className="rounded-[10px] border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-4">
                    <a href={cur.url ?? "#"} target="_blank" rel="noopener noreferrer" className="break-all text-[#A85D2C]">
                      {cur.url} ↗
                    </a>
                    <p className="mt-2 text-[11px] text-[#999]">남의 서버에 있는 자료라 이 자리에서 본문을 띄우지 않습니다.</p>
                  </div>
                ) : (
                  <>
                    <Sec>원문</Sec>
                    <div className="rounded-[10px] border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-4">
                      <div className="text-[13px] font-semibold text-[#1A1626]">{cur.file_name}</div>
                      <div className="mt-0.5 text-[11px] text-[#999]">
                        {((cur.file_size ?? 0) / 1024 / 1024).toFixed(2)} MB · {cur.file_mime}
                      </div>
                      <button
                        onClick={() => void download()}
                        className="mt-3 cursor-pointer rounded-lg bg-[#D4854A] px-4 py-2 text-[13px] font-semibold text-white"
                      >
                        내려받기
                      </button>
                      <p className="mt-2.5 text-[11px] text-[#999]">
                        원문은 화면에 띄우지 않습니다 — 내려받아서 보세요.
                        <br />
                        목록을 넘겨보기만 할 때 큰 파일을 매번 받아오지 않기 위해서입니다.
                      </p>
                    </div>
                  </>
                ))}

              {rtab === "analysis" && (
                <>
                  {anState === "NONE" && (
                    <div className="rounded-[10px] border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-4">
                      <p className="font-semibold text-[#1A1626]">아직 분석하지 않았습니다.</p>
                      <p className="mt-1.5 text-[11px] text-[#999]">
                        문단을 자른 뒤 묶음마다 LLM 을 불러 개념을 뽑습니다. <b>볼 가치가 있다고 판단했을 때</b>{" "}
                        누릅니다 — 누르면 호출한 만큼 비용이 나갑니다.
                      </p>
                      <button
                        onClick={() => void analyze()}
                        disabled={busy}
                        className="mt-3 cursor-pointer rounded-lg bg-[#D4854A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                      >
                        분석하기
                      </button>
                    </div>
                  )}

                  {anState === "RUNNING" && (
                    <div className="rounded-[10px] border border-[#D4854A] bg-[#FFF8F0] px-4 py-4">
                      <p className="font-bold text-[#A85D2C]">
                        분석 중 — {(an?.step ?? 0) + 1} / {ANALYSIS_STEPS.length} 단계
                      </p>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-[#F0E2D4]">
                        <div
                          className="h-full bg-[#D4854A] transition-all"
                          style={{ width: `${Math.round(((an?.step ?? 0) / ANALYSIS_STEPS.length) * 100)}%` }}
                        />
                      </div>
                      <ul className="mt-3 space-y-1 text-[12px]">
                        {ANALYSIS_STEPS.map((t, i) => (
                          <li
                            key={t}
                            className={cn(
                              i < (an?.step ?? 0) ? "text-[#2D7A5E]" : i === (an?.step ?? 0) ? "font-semibold text-[#1A1626]" : "text-[#CCC]",
                            )}
                          >
                            {i < (an?.step ?? 0) ? "✓" : i === (an?.step ?? 0) ? "▸" : "·"} {t}
                            {i === 3 && an?.sub ? ` (${an.sub.done}/${an.sub.total})` : ""}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2.5 text-[11px] text-[#999]">
                        이 화면을 떠나도 계속 돌아갑니다 — 다른 투고를 보고 있어도 됩니다.
                      </p>
                    </div>
                  )}

                  {anState === "FAILED" && (
                    <div className="rounded-[10px] border border-[#C0503C] bg-[#FBEAE7] px-4 py-4">
                      <p className="font-bold text-[#C0503C]">분석 실패</p>
                      <p className="mt-1.5">{an?.error ?? "알 수 없는 이유로 멈췄습니다."}</p>
                      <button
                        onClick={() => void analyze()}
                        disabled={busy}
                        className="mt-3 cursor-pointer rounded-lg bg-[#D4854A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}

                  {anState === "DONE" && an?.result && (
                    <>
                      <Sec>문서가 어떻게 들어가는가</Sec>
                      <dl className="grid grid-cols-[88px_1fr] gap-x-3.5 gap-y-2">
                        <Dt>구조</Dt>
                        <dd>
                          {an.result.struct.pages}쪽 · 챕터 {an.result.struct.chapters}개 · 문단{" "}
                          {an.result.struct.paragraphs}개
                        </dd>
                        <Dt>개념</Dt>
                        <dd>
                          {an.result.concepts.total}개 — 이미 있음 {an.result.concepts.existing} ·{" "}
                          <span className="font-semibold text-[#A85D2C]">새로 생김 {an.result.concepts.fresh}</span>
                        </dd>
                        <Dt>새 개념</Dt>
                        <dd className="text-[#A85D2C]">{an.result.concepts.freshNames.join(" · ") || "없음"}</dd>
                        <Dt>중복</Dt>
                        <dd>기존 문단과 겹치는 것 {an.result.duplicate.count}건</dd>
                        <Dt>경고</Dt>
                        <dd className="text-[#A85D2C]">{an.result.warnings.join(" / ") || "없음"}</dd>
                      </dl>

                      <Sec>요약</Sec>
                      <ul className="list-inside list-disc space-y-1">
                        {an.result.summary.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>

                      <Sec>근거 후보 (체리)</Sec>
                      <ul className="space-y-1.5">
                        {an.result.cherries.map((c) => (
                          <li key={c.text}>
                            “{c.text}” <span className="text-[11px] text-[#999]">{c.loc}</span>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-5 text-[11px] text-[#999]">
                        이 결과는 <b>보여주기만</b> 합니다 — 승인해도 어느 표에도 행이 생기지 않습니다.
                        <br />
                        판단용 미리보기라, 실제 적재는 파이프라인이 다시 돌려 숫자가 조금 달라질 수 있습니다.
                      </p>

                      {/* 다시 돌릴 수 있다(D13). 누르면 LLM 비용이 다시 나간다. */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => void analyze()}
                          disabled={busy}
                          className="cursor-pointer rounded-lg border border-[#D4854A] bg-[#FFF8F0] px-4 py-2 text-[13px] font-semibold text-[#A85D2C] disabled:opacity-40"
                        >
                          분석 다시하기
                        </button>
                        <span className="text-[11px] text-[#999]">누르면 결과를 새로 덮고, 호출한 만큼 비용이 다시 나갑니다</span>
                      </div>
                    </>
                  )}
                </>
              )}

              {rtab === "load" &&
                (typeof lp === "string" || !lp ? (
                  <div className="rounded-[10px] border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-4 text-[#999]">
                    {lp ?? "불러오는 중…"}
                  </div>
                ) : (
                  <>
                    <div className="rounded-[10px] border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-3 font-mono text-[12px] leading-[1.9]">
                      ① 파이프라인 → <b>public.*</b> (정수 키)
                      <br />② 옮기기 → <b>handbook.*</b> (uuid) ← 화면에 나오는 곳
                      <p className="mt-2 font-sans text-[11px] text-[#A85D2C]">{lp.notice}</p>
                    </div>

                    <Sec>① 파이프라인이 만드는 것 — public.*</Sec>
                    <div className="rounded-[10px] border border-[#E0E0E0]">
                      {lp.pipeline.map((t) => (
                        <div key={t.table} className="flex gap-3 border-b border-[#F0F0F0] px-3 py-2 text-[12px] last:border-0">
                          <b className="w-[190px] shrink-0 font-mono text-[#1A1626]">{t.table}</b>
                          <span className="w-[52px] shrink-0 text-[#A85D2C]">{t.rows}행</span>
                          <span className="min-w-0 truncate text-[11px] text-[#999]">{t.columns}</span>
                        </div>
                      ))}
                    </div>

                    <Sec>② 옮기면 되는 것 — handbook.*</Sec>
                    <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[#888]">
                      <span>값 — 분석이 뽑은 것</span>
                      <span>기본 — DB 기본값</span>
                      <span>빈칸 — NULL 로 남음</span>
                      <span>생성 — 적재할 때 만듦</span>
                    </div>
                    {lp.handbook.map((t) => (
                      <div key={t.table} className="mb-3 rounded-[10px] border border-[#E0E0E0]">
                        <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-3 py-2">
                          <b className="font-mono text-[12px] text-[#1A1626]">{t.table}</b>
                          <span className="rounded bg-[#FFF3E8] px-1.5 py-0.5 text-[11px] font-semibold text-[#A85D2C]">
                            {t.rows}행
                          </span>
                        </div>
                        <div className="px-3 py-1.5">
                          {t.columns.map((c) => (
                            <div key={c.name} className="flex gap-2 py-[3px] text-[12px]">
                              <b className="w-[190px] shrink-0 font-mono font-semibold text-[#3D3652]">{c.name}</b>
                              <span
                                className={cn(
                                  "w-[36px] shrink-0 text-[11px] font-semibold",
                                  c.origin === "값"
                                    ? "text-[#2D7A5E]"
                                    : c.origin === "기본"
                                      ? "text-[#7B5EA7]"
                                      : c.origin === "빈칸"
                                        ? "text-[#C0503C]"
                                        : "text-[#888]",
                                )}
                              >
                                {c.origin}
                              </span>
                              <span className="min-w-0 truncate text-[11px] text-[#999]">{c.note}</span>
                            </div>
                          ))}
                        </div>
                        {t.warn && (
                          <div className="border-t border-[#F0F0F0] bg-[#FFF8F0] px-3 py-1.5 text-[11px] font-semibold text-[#A85D2C]">
                            {t.warn}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ))}

              {rtab === "export" && (
                <pre className="overflow-auto rounded-[10px] border border-[#E0E0E0] bg-[#FBFAF8] p-4 font-mono text-[11px] leading-[1.7]">
                  {exported ?? "왼쪽 목록에서 조사할 링크를 체크하세요."}
                </pre>
              )}

              {error && <div className="mt-3 text-[12px] text-[#C0503C]">{error}</div>}
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-[#E0E0E0] px-5 py-3">
              <button
                disabled={busy || needAn}
                onClick={() => void decide("approve")}
                className="cursor-pointer rounded-lg bg-[#2D7A5E] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                승인
              </button>
              <button
                disabled={busy}
                onClick={() => void decide("hold")}
                className="cursor-pointer rounded-lg border border-[#D4854A] bg-[#FFF8F0] px-4 py-2 text-[13px] font-semibold text-[#A85D2C] disabled:opacity-40"
              >
                유보
              </button>
              <button
                disabled={busy}
                onClick={() => void decide("reject")}
                className="cursor-pointer rounded-lg border border-[#E0E0E0] bg-white px-4 py-2 text-[13px] font-semibold text-[#C0503C] disabled:opacity-40"
              >
                반려
              </button>
              <span className="ml-auto text-[11px] text-[#999]">
                {needAn
                  ? "분석을 한 번 돌려본 뒤에 승인할 수 있습니다"
                  : decided
                    ? `지금 ${STATE_LABEL[cur.status]} · 다시 눌러 바꿀 수 있습니다`
                    : "승인해도 어느 표에도 행이 생기지 않습니다"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Sec({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[.6px] text-[#999] first:mt-0">{children}</div>
  )
}
function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="pt-px text-[11px] font-semibold uppercase tracking-[.4px] text-[#888]">{children}</dt>
}
