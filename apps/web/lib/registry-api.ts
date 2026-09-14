/**
 * 소스 관리 — API 호출 모음 (관리자 전용)
 * 기획 apps/docs/source-registry/1-work-guidelines.md · 구현서 §5·§6
 */
import { API_URL, fetchWithAuth } from "./auth"

const BASE = `${API_URL}/api/admin/registry`

export type FieldKind = "text" | "url" | "long" | "select" | "multi" | "date"

export const KIND_LABEL: Record<FieldKind, string> = {
  text: "글자", url: "주소", long: "여러 줄", select: "선택", multi: "다중 선택", date: "날짜",
}

export interface RegistryTable { key: string; label: string; url_field: string | null; rows: number }
export interface RegistryField { id: string; key: string; label: string; kind: FieldKind; options: string[] | null; sort: number }
export interface RegistryRow { id: string; cells: Record<string, unknown>; source_id: string | null; origin: string; created_at: string }

export interface TableDetail {
  table: { key: string; label: string; urlField: string | null }
  fields: RegistryField[]
  rows: RegistryRow[]
}

async function body<T>(res: Response): Promise<T> {
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message ?? "요청을 처리하지 못했습니다.")
  return data as T
}
const json = (method: string, payload: unknown) => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
})

export async function listTables(): Promise<RegistryTable[]> {
  return body(await fetchWithAuth(`${BASE}/tables`))
}
export async function getTable(key: string): Promise<TableDetail> {
  return body(await fetchWithAuth(`${BASE}/tables/${key}`))
}
/** 칸 하나만 보낸다 — 행 전체를 보내면 남이 고친 칸을 지운다. */
export async function setCell(rowId: string, key: string, value: unknown): Promise<void> {
  await body(await fetchWithAuth(`${BASE}/rows/${rowId}`, json("PATCH", { key, value })))
}
export async function addRow(tableKey: string): Promise<RegistryRow> {
  return body(await fetchWithAuth(`${BASE}/tables/${tableKey}/rows`, { method: "POST" }))
}
export async function removeRow(rowId: string): Promise<void> {
  await body(await fetchWithAuth(`${BASE}/rows/${rowId}`, { method: "DELETE" }))
}
export async function addField(tableKey: string, input: { label: string; kind: FieldKind }): Promise<RegistryField> {
  return body(await fetchWithAuth(`${BASE}/tables/${tableKey}/fields`, json("POST", input)))
}
export async function updateField(fieldId: string, input: { label?: string; options?: string[] }): Promise<RegistryField> {
  return body(await fetchWithAuth(`${BASE}/fields/${fieldId}`, json("PATCH", input)))
}
