"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, Search, Plus, Check, Clock, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import {
  fetchTemplates,
  updateTemplate as apiUpdateTemplate,
  updateVersion as apiUpdateVersion,
  activateVersion as apiActivateVersion,
  deleteVersion as apiDeleteVersion,
  addVersion as apiAddVersion,
  type PromptTemplate,
  type TemplateVersion,
} from "@/lib/api"

/* ─────────────────────────────────────────────
   상수
───────────────────────────────────────────── */
const TYPE_LABEL: Record<string, string> = {
  ARTICLE_AI: "Article AI",
  NEWSLETTER: "Newsletter",
}

const TYPE_FILTERS = [
  { value: "ALL", label: "전체" },
  { value: "ARTICLE_AI", label: "Article AI" },
  { value: "NEWSLETTER", label: "Newsletter" },
]

/* ─────────────────────────────────────────────
   톤 편집기
───────────────────────────────────────────── */
function ToneEditor({
  templateId,
  toneText,
  onSaved,
}: {
  templateId: string
  toneText: string
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(toneText)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(toneText)
    setEditing(false)
  }, [toneText])

  async function handleSave() {
    setSaving(true)
    try {
      await apiUpdateTemplate(templateId, { tone_text: value })
      onSaved()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] px-4 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#888]">
          톤 / 방향
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-[#888] transition-colors hover:text-[#D4854A]"
          >
            편집
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setValue(toneText); setEditing(false) }}
              className="text-[11px] text-[#888] transition-colors hover:text-[#D4854A]"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || value === toneText}
              className="text-[11px] font-semibold text-[#6B727E] transition-colors hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
      </div>
      {!editing ? (
        <p className="mt-0.5 text-[13px] leading-relaxed text-[#3F3F46]">{toneText}</p>
      ) : (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#1A1626] outline-none focus:border-[#D4854A]"
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   버전 편집기
───────────────────────────────────────────── */
function VersionEditor({
  version,
  templateId,
  onSaved,
}: {
  version: TemplateVersion
  templateId: string
  onSaved: () => void
}) {
  const [promptText, setPromptText] = useState(version.prompt_text)
  const [fewShot, setFewShot] = useState(version.few_shot_examples ?? "")
  const [params, setParams] = useState(
    version.parameters_json ? JSON.stringify(version.parameters_json, null, 2) : "{}",
  )
  const [changeNote, setChangeNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(activate: boolean) {
    setSaving(true)
    try {
      let parsedParams: Record<string, unknown> = {}
      try {
        parsedParams = JSON.parse(params)
      } catch {
        /* keep empty */
      }

      await apiUpdateVersion(templateId, version.id, {
        prompt_text: promptText,
        few_shot_examples: fewShot || undefined,
        parameters_json: parsedParams,
        change_note: changeNote || undefined,
      })

      if (activate) {
        await apiActivateVersion(templateId, version.id)
      }

      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const field = "flex flex-col gap-1.5"
  const label = "text-[11px] font-semibold uppercase tracking-[0.8px] text-[#888]"
  const inputBase =
    "w-full rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] text-[#1A1626] outline-none transition-colors placeholder:text-[#888] focus:border-[#D4854A]"

  return (
    <div className="flex flex-col gap-6">
      {/* 버전 표시 */}
      <div className="flex items-center gap-2 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] px-3 py-2.5">
        <Clock className="h-3.5 w-3.5 shrink-0 text-[#888]" />
        <span className="text-[12px] text-[#6B727E]">
          편집 중: <strong className="text-[#1A1626]">버전 {version.version_tag}</strong>
        </span>
        {version.is_active && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#6B727E]">
            <Check className="h-3 w-3" /> 현재 활성
          </span>
        )}
      </div>

      {/* 변경 메모 */}
      <div className={field}>
        <label className={label}>변경 메모</label>
        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="어떤 변경을 했나요?"
          className={inputBase}
        />
      </div>

      {/* 프롬프트 본문 */}
      <div className={field}>
        <div className="flex items-baseline justify-between">
          <label className={label}>프롬프트 본문</label>
          <span className="text-[11px] text-[#888]">{"{article_content}"} 등 변수 사용 가능</span>
        </div>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={10}
          className={cn(inputBase, "resize-none font-mono leading-relaxed")}
        />
      </div>

      {/* Few-shot */}
      <div className={field}>
        <label className={label}>
          Few-shot 예시{" "}
          <span className="font-normal normal-case tracking-normal text-[#AAA]">— 선택</span>
        </label>
        <textarea
          value={fewShot}
          onChange={(e) => setFewShot(e.target.value)}
          rows={5}
          placeholder={`Example 1:\nInput: ...\nOutput: { "ai_summary": "..." }`}
          className={cn(inputBase, "resize-none font-mono leading-relaxed")}
        />
      </div>

      {/* 파라미터 */}
      <div className={field}>
        <label className={label}>파라미터 (JSON)</label>
        <textarea
          value={params}
          onChange={(e) => setParams(e.target.value)}
          rows={4}
          className={cn(inputBase, "resize-none bg-[#FAFAFA] font-mono leading-relaxed")}
        />
      </div>

      {/* 저장 */}
      <div className="flex items-center justify-end gap-2 border-t border-[#E0E0E0] pt-4">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="rounded-lg border border-[#E0E0E0] px-4 py-2 text-[13px] text-[#6B727E] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          저장 (비활성)
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
          style={{ background: saved ? "#2D7A5E" : "#555" }}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saved && <Check className="h-3.5 w-3.5" />}
          {saving ? "저장 중..." : saved ? "저장 완료" : "저장 + 활성 지정"}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   메인 페이지
───────────────────────────────────────────── */
/** 템플릿 에디터 본체 (Admin 모달에서 재사용 가능) */
export function TemplateEditorBody() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState("ALL")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"list" | "editor" | "preview">("list")
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchTemplates()
      setTemplates(data)
      // 첫 로드 시 첫 번째 템플릿 선택
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id)
        const av = data[0].versions.find((v) => v.is_active) ?? data[0].versions[0]
        if (av) setSelectedVersionId(av.id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const filtered = templates.filter((t) => {
    const matchType = typeFilter === "ALL" || t.type === typeFilter
    const matchSearch =
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  // 필터 변경 시: 현재 선택이 필터 결과에 없으면 첫 번째 항목으로 전환
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null)
      setSelectedVersionId(null)
      return
    }
    const stillVisible = filtered.find((t) => t.id === selectedId)
    if (!stillVisible) {
      const first = filtered[0]
      setSelectedId(first.id)
      const av = first.versions.find((v) => v.is_active) ?? first.versions[0]
      setSelectedVersionId(av?.id ?? null)
      setActiveTab("list")
    }
  }, [typeFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null
  const visibleVersions = selected?.versions ?? []
  const activeVersion = visibleVersions.find((v) => v.is_active) ?? visibleVersions[0]
  const selectedVersion = visibleVersions.find((v) => v.id === selectedVersionId) ?? activeVersion

  function selectTemplate(t: PromptTemplate) {
    setSelectedId(t.id)
    const av = t.versions.find((v) => v.is_active) ?? t.versions[0]
    if (av) setSelectedVersionId(av.id)
    setActiveTab("list")
    setConfirmDeleteId(null)
  }

  async function handleDeleteVersion(templateId: string, versionId: string) {
    await apiDeleteVersion(templateId, versionId)
    setConfirmDeleteId(null)
    await loadTemplates()
  }

  async function handleActivateVersion(templateId: string, versionId: string) {
    await apiActivateVersion(templateId, versionId)
    await loadTemplates()
  }

  const tabs = [
    { key: "list" as const, label: "버전 목록" },
    { key: "editor" as const, label: "버전 편집" },
    { key: "preview" as const, label: "미리보기" },
  ]

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-6 w-6 animate-spin text-[#888]" />
      </div>
    )
  }

  // selected가 null이면 오른쪽 영역에서 빈 상태 표시 (사이드바는 유지)

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-5 overflow-hidden bg-[#FAFAFA] p-4 lg:p-5 text-[#1A1626]">
        {/* 왼쪽 패널 — 카드 */}
        <div className="flex w-full lg:w-[300px] shrink-0 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden max-h-[35vh] lg:max-h-none">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-[14px] font-bold text-[#1A1626] mb-2">Templates</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 코드"
                className="w-full rounded-lg border border-[#E0E0E0] bg-[#FBFAF8] py-1.5 pl-8 pr-3 text-[12px] outline-none transition-colors placeholder:text-[#888] focus:border-[#D4854A] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex gap-1 px-3 pb-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                  typeFilter === f.value
                    ? "bg-[#FAFAFA] font-semibold text-[#6B727E]"
                    : "text-[#888] hover:bg-[#FAFAFA]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-[13px] text-[#888]">결과 없음</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 mb-1 text-left transition-all",
                    selectedId === t.id
                      ? "border border-[#D4854A] bg-[#FFF8F0]"
                      : "border border-transparent hover:bg-[#FAFAFA]",
                  )}
                >
                  <p
                    className={cn(
                      "mb-0.5 text-[12px] font-semibold leading-snug truncate",
                      selectedId === t.id ? "text-[#1A1626]" : "text-[#1A1626]",
                    )}
                  >
                    {t.name}
                  </p>
                  <p className="text-[10px] text-[#888]">
                    {TYPE_LABEL[t.type] ?? t.type} · {t.scope}
                    {!t.is_active && <span className="ml-1.5 text-[#AAA]">비활성</span>}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽 영역 — 카드 */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden min-w-0">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#888]">
              해당 타입의 템플릿이 없습니다.
            </div>
          ) : (
          <>
          {/* 템플릿 정보 바 + 탭 */}
          <div className="shrink-0 border-b border-[#E0E0E0] px-5 pt-4 pb-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[14px] font-bold">{selected.name}</h1>
              {!selected.is_active && <span className="text-[11px] text-[#888]">비활성</span>}
            </div>
            {selected.description && (
              <p className="text-[12px] leading-relaxed text-[#6B727E]">{selected.description}</p>
            )}

            <ToneEditor
              templateId={selected.id}
              toneText={selected.tone_text}
              onSaved={loadTemplates}
            />

            {/* 탭 */}
            <div className="flex gap-0 mt-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors",
                    activeTab === tab.key
                      ? "border-[#D4854A] text-[#1A1626]"
                      : "border-transparent text-[#888] hover:text-[#3F3F46]",
                  )}
                >
                  {tab.label}
                  {tab.key === "list" && (
                    <span className="ml-1.5 text-[11px] font-normal text-[#888]">
                      {visibleVersions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 버전 목록 */}
            {activeTab === "list" && (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {visibleVersions.map((v) => {
                  const isConfirming = confirmDeleteId === v.id

                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "group relative flex flex-col rounded-2xl border bg-white p-5 transition-all",
                        isConfirming
                          ? "border-red-200 bg-red-50"
                          : "border-[#E0E0E0] hover:border-[#AAA] hover:shadow-sm",
                      )}
                    >
                      {/* 상단: 버전 태그 + 활성 표시 */}
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          onClick={() => !v.is_active && handleActivateVersion(selected.id, v.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold transition-colors"
                          style={{
                            background: v.is_active ? "#EFF7F3" : "#FFF8F0",
                            color: v.is_active ? "#2D7A5E" : "#D4854A",
                          }}
                          title={v.is_active ? "현재 활성" : "클릭하여 활성 지정"}
                        >
                          {v.version_tag}
                        </button>

                        {v.is_active ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2D7A5E]">
                            <Check className="h-3 w-3" />
                            활성
                          </span>
                        ) : (
                          !isConfirming && (
                            <button
                              onClick={() => setConfirmDeleteId(v.id)}
                              className="flex items-center gap-1 rounded-md p-1.5 text-[#AAA] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </div>

                      {/* 변경 메모 */}
                      <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#3F3F46]">
                        {v.change_note ?? ""}
                      </p>

                      {/* 하단: 날짜 + 편집 버튼 */}
                      <div className="flex items-center justify-between border-t border-[#E0E0E0] pt-3">
                        <span className="text-[11px] text-[#888]">
                          {new Date(v.created_at).toLocaleDateString("ko-KR")}
                        </span>

                        {!isConfirming ? (
                          <button
                            onClick={() => {
                              setSelectedVersionId(v.id)
                              setActiveTab("editor")
                            }}
                            className="rounded-lg border border-[#E0E0E0] px-3 py-1 text-[12px] text-[#6B727E] transition-colors hover:border-[#D4854A] hover:text-[#D4854A]"
                          >
                            편집
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-red-400">삭제할까요?</span>
                            <button
                              onClick={() => handleDeleteVersion(selected.id, v.id)}
                              className="rounded px-2 py-0.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-100"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-0.5 text-[11px] text-[#888] transition-colors hover:bg-[#FAFAFA]"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* 새 버전 카드 */}
                <button
                  onClick={async () => {
                    await apiAddVersion(selected.id, {
                      prompt_text: activeVersion?.prompt_text ?? "",
                      few_shot_examples: activeVersion?.few_shot_examples ?? undefined,
                      parameters_json: activeVersion?.parameters_json ?? undefined,
                      change_note: "새 버전",
                    })
                    await loadTemplates()
                  }}
                  className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E0E0E0] text-[13px] text-[#888] transition-colors hover:border-[#D4854A] hover:text-[#D4854A]"
                >
                  <Plus className="h-5 w-5" />
                  새 버전 만들기
                </button>
              </div>
            )}

            {/* 버전 편집 */}
            {activeTab === "editor" && selectedVersion && (
              <VersionEditor
                key={selectedVersion.id}
                version={selectedVersion}
                templateId={selected.id}
                onSaved={loadTemplates}
              />
            )}

            {/* 미리보기 */}
            {activeTab === "preview" && activeVersion && (
              <div className="flex flex-col gap-5">
                <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#888]">
                    활성 버전 ({activeVersion.version_tag}) — 프롬프트 본문
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-4 font-mono text-[12px] leading-relaxed text-[#3F3F46]">
                    {activeVersion.prompt_text}
                  </pre>
                </div>

                {activeVersion.few_shot_examples && (
                  <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#888]">
                      Few-shot 예시
                    </p>
                    <pre className="whitespace-pre-wrap rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-4 font-mono text-[12px] leading-relaxed text-[#3F3F46]">
                      {activeVersion.few_shot_examples}
                    </pre>
                  </div>
                )}

                <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#888]">
                    파라미터
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-4 font-mono text-[12px] leading-relaxed text-[#3F3F46]">
                    {JSON.stringify(activeVersion.parameters_json, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
    </div>
  )
}

/** 페이지 래퍼 (기존 /template/edit 라우트용) */
export default function TemplateEditPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FAFAFA] text-[#1A1626]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-white px-5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[#6B727E] transition-colors hover:bg-[#FAFAFA]"
          >
            <ChevronLeft className="h-4 w-4" />
            홈
          </Link>
          <span className="text-[#AAA]">/</span>
          <span className="text-[13px] font-semibold">프롬프트 템플릿</span>
        </div>
      </header>
      <TemplateEditorBody />
    </div>
  )
}
