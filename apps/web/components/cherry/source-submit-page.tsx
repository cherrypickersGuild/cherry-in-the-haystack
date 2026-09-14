"use client"

/**
 * 자료 투고 — 유저 화면
 * 목업이 정본이다: apps/docs/source-submission/mockups/source-submit-mockup.html
 * 기획 §10-A · D17(메뉴 `투고란`)
 *
 * 왼쪽은 내 투고만 보여준다. 클릭도 상세도 없다 —
 * 이미 올렸는지와 채택됐는지만 알면 되는 목록이다.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  checkUrl,
  daysAgoLabel,
  listMySubmissions,
  STATE_COLOR,
  STATE_LABEL,
  submitFile,
  submitUrl,
  type DuplicateResult,
  type MySubmission,
} from "@/lib/submission-api"

const ACCEPT = ".pdf,.md,.markdown"
const MAX_MB = 20

export function SourceSubmitPage() {
  const [items, setItems] = useState<MySubmission[]>([])
  const [scope, setScope] = useState<"all" | "APPROVED">("all")
  const [tab, setTab] = useState<"file" | "url">("file")

  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [reason, setReason] = useState("")

  const [dup, setDup] = useState<DuplicateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    try {
      setItems(await listMySubmissions())
    } catch {
      /* 목록을 못 불러와도 투고는 할 수 있다 */
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /* 링크는 입력하는 동안 서버에 물어본다. 파일은 올린 뒤에야 안다 —
     브라우저가 보낸 해시는 믿을 수 없어 서버가 받은 내용으로 계산한다. */
  useEffect(() => {
    if (tab !== "url") return
    const v = url.trim()
    if (!/^https?:\/\//i.test(v)) {
      setDup(null)
      return
    }
    const t = setTimeout(() => {
      checkUrl(v)
        .then((r) => setDup(r.duplicate ? r : null))
        .catch(() => setDup(null))
    }, 400)
    return () => clearTimeout(t)
  }, [url, tab])

  function switchTab(next: "file" | "url") {
    setTab(next)
    setDup(null)
    setError(null)
    setDone(null)
  }

  function choose(f: File | null) {
    setDup(null)
    setError(null)
    setDone(null)
    if (!f) {
      setFile(null)
      return
    }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (!["pdf", "md", "markdown"].includes(ext)) {
      setFile(null)
      setError(`${f.name} — PDF 와 MD 만 받습니다`)
      return
    }
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""))
  }

  async function upload() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      if (tab === "url") {
        await submitUrl({ url: url.trim(), name: title.trim(), reason: reason.trim() || undefined })
        setUrl("")
      } else {
        await submitFile({ file: file as File, name: title.trim(), reason: reason.trim() || undefined })
        setFile(null)
      }
      setTitle("")
      setReason("")
      setDup(null)
      setDone("올렸습니다. 관리자가 확인한 뒤 상태가 바뀝니다.")
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "올리지 못했습니다."
      // 파일 중복은 올린 뒤에 서버가 알려준다
      const d = (e as { data?: DuplicateResult })?.data
      if (d?.duplicate) setDup(d)
      else setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const visible = items.filter((d) => scope === "all" || d.status === scope)
  const canUpload =
    !busy && !dup && title.trim().length > 0 && (tab === "url" ? /^https?:\/\//i.test(url.trim()) : !!file)

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-[600px] items-stretch gap-5 px-5 pb-5 pt-4 max-[640px]:h-auto max-[640px]:flex-col">
      {/* 왼쪽 — 내 투고 */}
      <div className="flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white max-[900px]:w-[240px] max-[640px]:w-full">
        <div className="flex flex-shrink-0 items-center justify-between px-4 pb-2 pt-4">
          <h3 className="text-[14px] font-bold text-[#1A1626]">내 투고</h3>
          <span className="text-[11px] font-medium text-[#999]">{visible.length}건</span>
        </div>
        <p className="px-4 pb-2 text-[11px] text-[#999]">내가 이미 올린 자료인지 확인하는 곳입니다</p>

        <div className="flex flex-shrink-0 border-b border-[#F0F0F0] px-3">
          {([["all", "전체"], ["APPROVED", "승인"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setScope(k)}
              className={cn(
                "cursor-pointer border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors",
                scope === k ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
          {visible.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[#999]">없습니다.</div>
          ) : (
            visible.map((d) => (
              <div key={d.id} className="mb-1 rounded-lg px-2.5 py-2">
                <div className="truncate text-[12px] font-semibold leading-[1.35] text-[#1A1626]">
                  {d.kind === "URL" ? d.url : d.file_name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-[7px] text-[10px] text-[#999]">
                  <span className={cn("font-semibold", d.kind === "URL" ? "text-[#7B5EA7]" : "text-[#A85D2C]")}>
                    {d.kind === "URL" ? "URL" : (d.file_name ?? "").toLowerCase().endsWith(".pdf") ? "PDF" : "MD"}
                  </span>
                  <span>{daysAgoLabel(d.created_at)}</span>
                  <span className={cn("font-semibold", STATE_COLOR[d.status])}>{STATE_LABEL[d.status]}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-1.5 border-t border-[#F0F0F0] px-3 py-2.5 text-[11px] text-[#999]">
          내가 올린 것 {items.length}건 — 남의 투고는 보이지 않습니다
        </div>
      </div>

      {/* 오른쪽 — 자료 투고 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white">
        <div className="flex-shrink-0 border-b border-[#E0E0E0] px-5 pt-4">
          <h3 className="mb-3 text-[14px] font-bold text-[#1A1626]">자료 투고</h3>
          <div className="flex">
            {([["file", "파일"], ["url", "링크"]] as const).map(([k, label], i) => (
              <button
                key={k}
                onClick={() => switchTab(k)}
                className={cn(
                  "cursor-pointer border-b-2 py-[11px] text-[14px] font-semibold transition-colors",
                  i === 0 ? "mr-2 pl-0 pr-5" : "px-5",
                  tab === k ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {dup && (
            <div className="mb-[18px] rounded-lg border border-[#D4854A] bg-[#FFF8F0] px-3 py-2.5 text-[12px] text-[#A85D2C]">
              {dup.mine ? (
                <>
                  <b className="font-bold">내가 이미 올린 자료입니다.</b>
                  <br />
                  {dup.name} — {dup.daysAgo === 0 ? "오늘" : `${dup.daysAgo}일 지남`} · 지금{" "}
                  <b className="font-bold">{dup.state ? STATE_LABEL[dup.state] : ""}</b> 입니다.
                  {tab === "file" && <br />}
                  {tab === "file" && "내용이 같은 파일이라 저장하지 않았습니다."}
                </>
              ) : (
                <>
                  <b className="font-bold">이미 등록됐거나 검토 중인 자료입니다.</b>
                  <br />
                  같은 자료가 이미 들어와 있어 또 올리지 않아도 됩니다.
                  {tab === "file" && <br />}
                  {tab === "file" && "내용이 같은 파일이라 저장하지 않았습니다."}
                </>
              )}
            </div>
          )}

          {tab === "url" ? (
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.6px] text-[#999]">주소</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-[13px] text-[#1A1626] outline-none focus:border-[#D4854A]"
              />
              <div className="mt-1.5 text-[11px] text-[#999]">
                블로그·뉴스레터처럼 글이 계속 올라오는 곳이면 좋습니다
              </div>
            </div>
          ) : (
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.6px] text-[#999]">파일</label>
              <input
                ref={pick}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2.5 rounded-[10px] border border-[#D4854A] bg-[#FFF8F0] px-3 py-3">
                  <span className="flex-shrink-0 rounded bg-[#FFF3E8] px-1.5 py-0.5 text-[9px] font-extrabold tracking-[.4px] text-[#A85D2C]">
                    {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "MD"}
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1A1626]">{file.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#999]">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button
                    onClick={() => choose(null)}
                    className="ml-auto cursor-pointer text-[16px] text-[#888] hover:text-[#C0503C]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                /* 끌어다 놓아도 되고 눌러서 골라도 된다. */
                <div
                  onClick={() => pick.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOver(true)
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setOver(false)
                    choose(e.dataTransfer.files?.[0] ?? null)
                  }}
                  className={cn(
                    "cursor-pointer rounded-[10px] border-[1.5px] border-dashed px-4 py-7 text-center transition-colors",
                    over
                      ? "border-[#D4854A] bg-[#FFF3E8]"
                      : "border-[#E0E0E0] bg-[#FAFAFA] hover:border-[#D4854A] hover:bg-[#FFF8F0]",
                  )}
                >
                  <div className="text-[13px] font-semibold text-[#1A1626]">
                    {over ? "여기에 놓으세요" : "파일을 끌어다 놓거나 눌러서 고르세요"}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#999]">PDF · MD · {MAX_MB} MB까지</div>
                </div>
              )}
            </div>
          )}

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.6px] text-[#999]">제목</label>
            <input
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="자료 이름"
              className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-[13px] text-[#1A1626] outline-none focus:border-[#D4854A]"
            />
          </div>

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.6px] text-[#999]">
              왜 볼 만한가
            </label>
            <textarea
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="한두 줄이면 충분합니다"
              className="min-h-[80px] w-full resize-y rounded-lg border border-[#E0E0E0] px-3 py-2 text-[13px] leading-[1.6] text-[#1A1626] outline-none focus:border-[#D4854A]"
            />
          </div>

          {error && <div className="text-[12px] text-[#C0503C]">{error}</div>}
          {done && <div className="text-[12px] text-[#2D7A5E]">{done}</div>}
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-[#E0E0E0] px-5 py-3">
          <button
            onClick={() => void upload()}
            disabled={!canUpload}
            className="cursor-pointer rounded-lg bg-[#555] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "올리는 중…" : "업로드"}
          </button>
          <span className="ml-auto text-[11px] text-[#999]">
            {dup
              ? "이미 올라온 자료라 등록하지 않았습니다"
              : tab === "file"
                ? "올린 뒤 같은 파일이 있는지 서버가 확인합니다"
                : "관리자가 확인한 뒤 승인 · 유보 · 반려 중 하나로 알려드립니다"}
          </span>
        </div>
      </div>
    </div>
  )
}
