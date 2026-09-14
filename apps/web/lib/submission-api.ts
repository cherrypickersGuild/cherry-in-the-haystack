/**
 * 유저 자료·소스 투고 — API 호출 모음
 * 기획 apps/docs/source-submission/1-work-guidelines.md §9
 *
 * 남의 투고는 서버가 아예 주지 않는다. 화면에서 거르는 게 아니다(기획 §6-E).
 */
import { API_URL, fetchWithAuth } from "./auth"

const BASE = `${API_URL}/api/sources/submissions`

export type SubmissionState = "PENDING" | "ON_HOLD" | "APPROVED" | "REJECTED"

export interface MySubmission {
  id: string
  kind: "URL" | "FILE"
  url: string | null
  name: string
  status: SubmissionState
  file_name: string | null
  file_size: number | null
  created_at: string
}

/** 중복 확인 결과. 남의 것과 겹치면 "있다"는 사실만 온다. */
export interface DuplicateResult {
  duplicate: boolean
  mine?: boolean
  name?: string
  state?: SubmissionState
  daysAgo?: number
}

async function body<T>(res: Response): Promise<T> {
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new SubmissionError(data?.message ?? "요청을 처리하지 못했습니다.", res.status, data)
  return data as T
}

/** 서버가 돌려준 메시지를 그대로 화면에 보여주기 위한 에러. */
export class SubmissionError extends Error {
  constructor(message: string, readonly status: number, readonly data?: unknown) {
    super(message)
    this.name = "SubmissionError"
  }
}

export async function listMySubmissions(): Promise<MySubmission[]> {
  return body(await fetchWithAuth(BASE + "/mine"))
}

export async function checkUrl(url: string): Promise<DuplicateResult> {
  return body(
    await fetchWithAuth(BASE + "/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  )
}

export async function submitUrl(input: { url: string; name: string; reason?: string }): Promise<{ id: string }> {
  return body(
    await fetchWithAuth(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  )
}

/**
 * 파일 투고. 중복은 올린 뒤에야 안다 — 브라우저가 보낸 해시는 믿을 수 없어
 * 서버가 받은 내용으로 직접 계산하기 때문이다(기획 §10-A).
 */
export async function submitFile(input: { file: File; name: string; reason?: string }): Promise<{ id: string }> {
  const form = new FormData()
  form.append("file", input.file)
  form.append("name", input.name)
  if (input.reason) form.append("reason", input.reason)
  return body(await fetchWithAuth(BASE + "/upload", { method: "POST", body: form }))
}

/** 며칠 지났는지. 날짜가 아니라 경과일로 보여준다(기획 §10-A). */
export function daysAgoLabel(iso: string): string {
  const n = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return n <= 0 ? "오늘" : `${n}일 지남`
}

export const STATE_LABEL: Record<SubmissionState, string> = {
  PENDING: "대기",
  ON_HOLD: "유보",
  APPROVED: "승인",
  REJECTED: "반려",
}

export const STATE_COLOR: Record<SubmissionState, string> = {
  PENDING: "text-[#999]",
  ON_HOLD: "text-[#D4854A]",
  APPROVED: "text-[#2D7A5E]",
  REJECTED: "text-[#C0503C]",
}

/* ══════════════════════════════════════════════════════
   관리자 — 기획 §9. 전부 ADMIN 전용이다.
   ══════════════════════════════════════════════════════ */

const ADMIN = `${API_URL}/api/admin/submissions`

export type AnalysisState = "NONE" | "RUNNING" | "DONE" | "FAILED"

export interface AdminSubmission {
  id: string
  kind: "URL" | "FILE"
  url: string | null
  name: string
  reason: string | null
  status: SubmissionState
  file_name: string | null
  file_size: number | null
  file_mime: string | null
  file_sha256?: string | null
  submitted_by_user_id: string | null
  reviewed_at: string | null
  created_at: string
  analysis_state: AnalysisState | null
  analysis?: { state?: AnalysisState; error?: string } | null
}

export async function adminList(kind: "FILE" | "URL", status?: SubmissionState): Promise<AdminSubmission[]> {
  const q = new URLSearchParams({ kind })
  if (status) q.set("status", status)
  return body(await fetchWithAuth(`${ADMIN}?${q}`))
}

export async function adminGet(id: string): Promise<AdminSubmission> {
  return body(await fetchWithAuth(`${ADMIN}/${id}`))
}

/** 원문은 눌렀을 때만 받는다 (기획 §4-A). 토큰이 필요하므로 fetch 로 받아 blob URL 로 연다. */
export async function adminFetchFile(id: string, mode: "view" | "download"): Promise<Blob> {
  const res = await fetchWithAuth(`${ADMIN}/${id}/${mode}`)
  if (!res.ok) throw new SubmissionError("원문을 불러오지 못했습니다.", res.status)
  return res.blob()
}

export async function adminDecide(id: string, verdict: "approve" | "hold" | "reject"): Promise<void> {
  await body(await fetchWithAuth(`${ADMIN}/${id}/${verdict}`, { method: "POST" }))
}

export async function adminExport(ids: string[]): Promise<unknown> {
  return body(
    await fetchWithAuth(`${ADMIN}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  )
}

export const ANALYSIS_LABEL: Record<AnalysisState, string> = {
  NONE: "안 함",
  RUNNING: "진행 중",
  DONE: "완료",
  FAILED: "실패",
}

export interface AnalysisResult {
  struct: { chapters: number; paragraphs: number; pages: number }
  concepts: { total: number; existing: number; fresh: number; freshNames: string[] }
  duplicate: { count: number }
  summary: string[]
  cherries: { text: string; loc: string }[]
  warnings: string[]
}

export interface AnalysisJson {
  state: AnalysisState
  step?: number
  sub?: { done: number; total: number }
  error?: string
  result?: AnalysisResult
}

export const ANALYSIS_STEPS = [
  "글자 뽑기",
  "챕터 나누기",
  "문단 자르기",
  "개념 뽑기 (LLM)",
  "기존 개념과 대조",
  "요약 정리 (LLM)",
]

export async function adminAnalyze(id: string): Promise<{ state: AnalysisState }> {
  return body(await fetchWithAuth(`${ADMIN}/${id}/analyze`, { method: "POST" }))
}

export async function adminAnalysis(id: string): Promise<AnalysisJson> {
  return body(await fetchWithAuth(`${ADMIN}/${id}/analysis`))
}

export interface LoadPreview {
  pipeline: { table: string; rows: number; columns: string }[]
  handbook: {
    table: string
    rows: number
    columns: { name: string; origin: "값" | "기본" | "빈칸" | "생성"; note: string }[]
    warn?: string
    note?: string
  }[]
  notice: string
}

export async function adminLoadPreview(id: string): Promise<LoadPreview> {
  return body(await fetchWithAuth(`${ADMIN}/${id}/load-preview`))
}
