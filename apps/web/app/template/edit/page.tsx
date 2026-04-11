"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, Search, Plus, Check, Clock, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import {
  fetchTemplates,
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
  const label = "text-[11px] font-semibold uppercase tracking-[0.8px] text-[#9E97B3]"
  const inputBase =
    "w-full rounded-lg border border-[#E4E1EE] bg-white px-3 py-2 text-[13px] text-[#1A1626] outline-none transition-colors placeholder:text-[#9E97B3] focus:border-[#C94B6E]"

  return (
    <div className="flex flex-col gap-6">
      {/* 버전 표시 */}
      <div className="flex items-center gap-2 rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] px-3 py-2.5">
        <Clock className="h-3.5 w-3.5 shrink-0 text-[#9E97B3]" />
        <span className="text-[12px] text-[#6B6480]">
          편집 중: <strong className="text-[#1A1626]">버전 {version.version_tag}</strong>
        </span>
        {version.is_active && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#C94B6E]">
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
          <span className="text-[11px] text-[#9E97B3]">{"{article_content}"} 등 변수 사용 가능</span>
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
          <span className="font-normal normal-case tracking-normal text-[#C8C3D8]">— 선택</span>
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
          className={cn(inputBase, "resize-none bg-[#F7F6F9] font-mono leading-relaxed")}
        />
      </div>

      {/* 저장 */}
      <div className="flex items-center justify-end gap-2 border-t border-[#E4E1EE] pt-4">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="rounded-lg border border-[#E4E1EE] px-4 py-2 text-[13px] text-[#6B6480] transition-colors hover:bg-[#F7F6F9] disabled:opacity-50"
        >
          저장 (비활성)
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
          style={{ background: saved ? "#2D7A5E" : "#C94B6E" }}
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
export default function TemplateEditPage() {
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
      <div className="flex h-screen items-center justify-center bg-[#F7F6F9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#9E97B3]" />
      </div>
    )
  }

  // selected가 null이면 오른쪽 영역에서 빈 상태 표시 (사이드바는 유지)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F7F6F9] text-[#1A1626]">
      {/* 헤더 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E4E1EE] bg-white px-5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[#6B6480] transition-colors hover:bg-[#F7F6F9]"
          >
            <ChevronLeft className="h-4 w-4" />
            홈
          </Link>
          <span className="text-[#C8C3D8]">/</span>
          <span className="text-[13px] font-semibold">프롬프트 템플릿</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽 패널 */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#E4E1EE] bg-white">
          <div className="border-b border-[#E4E1EE] p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9E97B3]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 코드"
                className="w-full rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] py-1.5 pl-8 pr-3 text-[13px] outline-none transition-colors placeholder:text-[#9E97B3] focus:border-[#C94B6E] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex flex-col gap-0.5 border-b border-[#E4E1EE] p-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "w-full rounded-md px-3 py-1.5 text-left text-[13px] transition-colors",
                  typeFilter === f.value
                    ? "bg-[#FDF0F3] font-semibold text-[#C94B6E]"
                    : "text-[#6B6480] hover:bg-[#F7F6F9]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-[13px] text-[#9E97B3]">결과 없음</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={cn(
                    "w-full border-b border-[#E4E1EE] px-4 py-3 text-left transition-colors last:border-b-0",
                    selectedId === t.id
                      ? "border-l-2 border-l-[#C94B6E] bg-[#FDF0F3] pl-[14px]"
                      : "hover:bg-[#F7F6F9]",
                  )}
                >
                  <p
                    className={cn(
                      "mb-0.5 text-[13px] font-semibold leading-snug",
                      selectedId === t.id ? "text-[#C94B6E]" : "text-[#1A1626]",
                    )}
                  >
                    {t.name}
                  </p>
                  <p className="text-[11px] text-[#9E97B3]">
                    {TYPE_LABEL[t.type] ?? t.type} · {t.scope}
                    {!t.is_active && <span className="ml-1.5 text-[#C8C3D8]">비활성</span>}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 오른쪽 영역 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#9E97B3]">
              해당 타입의 템플릿이 없습니다.
            </div>
          ) : (
          <>
          {/* 템플릿 정보 바 */}
          <div className="shrink-0 border-b border-[#E4E1EE] bg-white px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[16px] font-bold">{selected.name}</h1>
                  {!selected.is_active && <span className="text-[11px] text-[#9E97B3]">비활성</span>}
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-[#9E97B3]">
                  {TYPE_LABEL[selected.type] ?? selected.type} · {selected.scope} · {selected.code}
                </p>
                {selected.description && (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6B6480]">{selected.description}</p>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3]">
                톤 / 방향
              </span>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#3D3652]">{selected.tone_text}</p>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex shrink-0 gap-0 border-b border-[#E4E1EE] bg-white px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors",
                  activeTab === tab.key
                    ? "border-[#C94B6E] text-[#C94B6E]"
                    : "border-transparent text-[#6B6480] hover:text-[#1A1626]",
                )}
              >
                {tab.label}
                {tab.key === "list" && (
                  <span className="ml-1.5 text-[11px] font-normal text-[#9E97B3]">
                    {visibleVersions.length}
                  </span>
                )}
              </button>
            ))}
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
                          : "border-[#E4E1EE] hover:border-[#C8C3D8] hover:shadow-sm",
                      )}
                    >
                      {/* 상단: 버전 태그 + 활성 표시 */}
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          onClick={() => !v.is_active && handleActivateVersion(selected.id, v.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold transition-colors"
                          style={{
                            background: v.is_active ? "#FDF0F3" : "#F7F6F9",
                            color: v.is_active ? "#C94B6E" : "#9E97B3",
                          }}
                          title={v.is_active ? "현재 활성" : "클릭하여 활성 지정"}
                        >
                          {v.version_tag}
                        </button>

                        {v.is_active ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#C94B6E]">
                            <Check className="h-3 w-3" />
                            활성
                          </span>
                        ) : (
                          !isConfirming && (
                            <button
                              onClick={() => setConfirmDeleteId(v.id)}
                              className="flex items-center gap-1 rounded-md p-1.5 text-[#C8C3D8] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </div>

                      {/* 변경 메모 */}
                      <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#3D3652]">
                        {v.change_note ?? ""}
                      </p>

                      {/* 하단: 날짜 + 편집 버튼 */}
                      <div className="flex items-center justify-between border-t border-[#E4E1EE] pt-3">
                        <span className="text-[11px] text-[#9E97B3]">
                          {new Date(v.created_at).toLocaleDateString("ko-KR")}
                        </span>

                        {!isConfirming ? (
                          <button
                            onClick={() => {
                              setSelectedVersionId(v.id)
                              setActiveTab("editor")
                            }}
                            className="rounded-lg border border-[#E4E1EE] px-3 py-1 text-[12px] text-[#6B6480] transition-colors hover:border-[#C94B6E] hover:text-[#C94B6E]"
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
                              className="rounded px-2 py-0.5 text-[11px] text-[#9E97B3] transition-colors hover:bg-[#F7F6F9]"
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
                  className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E4E1EE] text-[13px] text-[#9E97B3] transition-colors hover:border-[#C94B6E] hover:text-[#C94B6E]"
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
                <div className="rounded-xl border border-[#E4E1EE] bg-white p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3]">
                    활성 버전 ({activeVersion.version_tag}) — 프롬프트 본문
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] p-4 font-mono text-[12px] leading-relaxed text-[#3D3652]">
                    {activeVersion.prompt_text}
                  </pre>
                </div>

                {activeVersion.few_shot_examples && (
                  <div className="rounded-xl border border-[#E4E1EE] bg-white p-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3]">
                      Few-shot 예시
                    </p>
                    <pre className="whitespace-pre-wrap rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] p-4 font-mono text-[12px] leading-relaxed text-[#3D3652]">
                      {activeVersion.few_shot_examples}
                    </pre>
                  </div>
                )}

                <div className="rounded-xl border border-[#E4E1EE] bg-white p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3]">
                    파라미터
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-[#E4E1EE] bg-[#F7F6F9] p-4 font-mono text-[12px] leading-relaxed text-[#3D3652]">
                    {JSON.stringify(activeVersion.parameters_json, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
