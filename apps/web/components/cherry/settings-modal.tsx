"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { API_URL, authHeaders } from "@/lib/auth"
import {
  fetchBenchKeyStatus,
  putBenchKey,
  deleteBenchKey,
  formatTimeLeft,
  isExpiringSoon,
  type BenchKeyStatus,
} from "@/lib/bench-api"

/**
 * 회원 설정 모달 — 벤치마크용 Claude(Anthropic) API 키 등록/삭제.
 * 키는 서버에서 암호화 저장되고, 화면엔 마스킹만 표시된다.
 */
export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [status, setStatus] = useState<BenchKeyStatus | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setApiKey(""); setMsg(""); setErr(""); setStatus(null); setEmail(null)
    fetchBenchKeyStatus()
      .then(setStatus)
      .catch(() => setErr("키 상태를 불러오지 못했습니다. 로그인 상태를 확인하세요."))
    fetch(`${API_URL}/api/app-user/me`, { headers: { ...authHeaders() }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setEmail(u?.email ?? null))
      .catch(() => { /* noop */ })
  }, [open])

  if (!open) return null

  const timeLeft = formatTimeLeft(status?.expiresAt ?? null)

  const save = async () => {
    setBusy(true); setMsg(""); setErr("")
    try {
      const s = await putBenchKey(apiKey.trim())
      setStatus(s); setApiKey(""); setMsg("저장되었습니다. 72시간 후 자동 삭제됩니다.")
      window.dispatchEvent(new Event("bench-key:change"))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true); setMsg(""); setErr("")
    try {
      await deleteBenchKey()
      setStatus({ hasKey: false, masked: null, expiresAt: null }); setMsg("삭제되었습니다.")
      window.dispatchEvent(new Event("bench-key:change"))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패")
    } finally {
      setBusy(false)
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-[#FDFBF5] p-6"
        style={{ border: "1px solid #E9D1A6", boxShadow: "0 12px 32px rgba(107,79,42,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[18px] font-extrabold text-[#3A2A1C]">Settings</h2>
          <button onClick={onClose} className="text-[#6B4F2A] hover:text-[#3A2A1C] text-[18px]">✕</button>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#6B4F2A] mb-3">
          <span>로그인 계정</span>
          <span className="font-bold text-[#3A2A1C]">{email ?? "…"}</span>
        </div>

        <p className="text-[13px] text-[#6B4F2A] leading-relaxed mb-4">
          벤치마크는 <b>본인 Claude(Anthropic) API 키</b>로 실행됩니다. 키는 암호화되어 저장되고
          화면엔 마스킹만 표시됩니다.
        </p>

        <div className="rounded-xl bg-[#FBF6ED] px-4 py-3 mb-4" style={{ border: "1px solid #E9D1A6" }}>
          <div className="text-[12px] text-[#6B4F2A]">현재 등록 상태</div>
          <div className="text-[14px] font-bold text-[#3A2A1C] mt-0.5">
            {status == null
              ? "…"
              : status.hasKey
              ? `등록됨 · ${status.masked ?? "sk-ant-…"}`
              : "미등록"}
          </div>
          {status?.hasKey && timeLeft && (
            <div
              className="text-[12px] mt-1 font-semibold"
              style={{ color: isExpiringSoon(status.expiresAt) ? "#C8301E" : "#8A6A3A" }}
            >
              {timeLeft} 후 만료
            </div>
          )}
        </div>

        <label className="text-[12px] font-semibold text-[#6B4F2A]">Anthropic API Key</label>
        <input
          type="password"
          placeholder="sk-ant-api03-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full mt-1 px-4 py-3 rounded-xl bg-white text-[14px] text-[#3A2A1C] placeholder:text-[#C9B88A] outline-none focus:ring-2 focus:ring-[#C8301E]/30 transition"
          style={{ border: "1px solid #E9D1A6" }}
        />
        {/* 만료 정책 안내 — 키 입력란 바로 아래 */}
        <div
          className="mt-2 rounded-lg bg-[#FBF6ED] px-3 py-2 text-[12px] text-[#8A6A3A] leading-relaxed"
          style={{ border: "1px solid #EDDCBB" }}
        >
          등록 후 <b>72시간(3일)</b>이 지나면 자동으로 삭제됩니다. 이후 다시 사용하려면 재등록이 필요합니다.
        </div>

        {msg && <p className="text-[12px] text-[#2E7D32] mt-2">{msg}</p>}
        {err && <p className="text-[12px] text-[#C8301E] mt-2">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={save}
            disabled={busy || apiKey.trim().length < 20}
            className="flex-1 py-2.5 rounded-full bg-[#C8301E] text-white text-[13px] font-extrabold disabled:opacity-40 hover:shadow-md transition"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
          {status?.hasKey && (
            <button
              onClick={remove}
              disabled={busy}
              className="px-4 py-2.5 rounded-full border text-[13px] font-bold text-[#6B4F2A] disabled:opacity-40 hover:bg-[#F5E4C2]/40 transition"
              style={{ border: "1px solid #E9D1A6" }}
            >
              삭제
            </button>
          )}
        </div>

        <p className="text-[11px] text-[#9B8A6A] mt-4">
          키는 콘솔 <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a> 에서 발급합니다.
        </p>
      </div>
    </div>
  )

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null
}
