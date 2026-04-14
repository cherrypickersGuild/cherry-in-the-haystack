"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, Plus, Trash2, Upload, Eye, Edit3, FileText, BookOpen, Loader2 } from "lucide-react"
import {
  fetchConceptsAdmin,
  fetchConceptAdmin,
  createConceptAdmin,
  updateConceptAdmin,
  deleteConceptAdmin,
  addEvidenceAdmin,
  updateEvidenceAdmin,
  deleteEvidenceAdmin,
  type AdminConcept,
  type AdminEvidence,
} from "@/lib/api"
import { TemplateEditorBody } from "@/app/template/edit/page"

/* ═══════════════════════════════════════════
   Styles
═══════════════════════════════════════════ */
const inputBase =
  "w-full rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] text-[#1A1626] outline-none transition-colors placeholder:text-[#999] focus:border-[#D4854A]"
const labelCls = "text-[10px] font-bold uppercase tracking-[0.6px] text-[#999]"
const btnPrimary =
  "rounded-lg px-4 py-2 text-[13px] font-semibold text-white bg-[#555] hover:bg-[#333] transition-colors"
const btnSecondary =
  "rounded-lg border border-[#E0E0E0] px-3 py-1.5 text-[12px] text-[#666] transition-colors hover:border-[#D4854A] hover:text-[#D4854A]"

const TIER_OPTIONS = ["Bronze", "Silver", "Gold", "Platinum"]

/* ═══════════════════════════════════════════
   Evidence Form (inline)
═══════════════════════════════════════════ */
function EvidenceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: AdminEvidence
  onSave: (data: { source: string; summary: string; curator: string; curator_tier: string; comment: string }) => void
  onCancel: () => void
}) {
  const [source, setSource] = useState(initial?.source ?? "")
  const [summary, setSummary] = useState(initial?.summary ?? "")
  const [curator, setCurator] = useState(initial?.curator ?? "")
  const [tier, setTier] = useState(initial?.curatorTier ?? "Bronze")
  const [comment, setComment] = useState(initial?.comment ?? "")

  return (
    <div className="space-y-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} className={cn(inputBase, "mt-1")} placeholder="Chip Huyen — AI Engineering" /></div>
        <div><label className={labelCls}>Curator</label><input value={curator} onChange={(e) => setCurator(e.target.value)} className={cn(inputBase, "mt-1")} placeholder="Hyejin Kim" /></div>
      </div>
      <div><label className={labelCls}>Summary</label><textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={cn(inputBase, "mt-1 resize-none")} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Tier</label><select value={tier} onChange={(e) => setTier(e.target.value)} className={cn(inputBase, "mt-1")}>{TIER_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className={labelCls}>Comment</label><input value={comment} onChange={(e) => setComment(e.target.value)} className={cn(inputBase, "mt-1")} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className={btnSecondary}>취소</button>
        <button onClick={() => onSave({ source, summary, curator, curator_tier: tier, comment })} disabled={!source || !summary || !curator} className={cn(btnPrimary, "disabled:opacity-40")} className={cn(btnPrimary, "disabled:opacity-40")}>저장</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Knowledge Curation Panel
═══════════════════════════════════════════ */
export function KnowledgeCurationPanel() {
  const [concepts, setConcepts] = useState<AdminConcept[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [subTab, setSubTab] = useState<"info" | "content" | "evidence">("info")

  // Create mode
  const [showCreate, setShowCreate] = useState(false)
  const [newId, setNewId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newSummary, setNewSummary] = useState("")

  // Edit state
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editQuality, setEditQuality] = useState(0)
  const [editRelated, setEditRelated] = useState("")

  // Content
  const [contentMd, setContentMd] = useState("")
  const [preview, setPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Evidence
  const [editingEvId, setEditingEvId] = useState<string | null>(null)
  const [addingEvidence, setAddingEvidence] = useState(false)

  const [saving, setSaving] = useState(false)

  const loadConcepts = useCallback(async () => {
    try {
      const data = await fetchConceptsAdmin()
      setConcepts(data)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch {
      /* fallback: keep empty */
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { loadConcepts() }, [loadConcepts])

  // Load detail when selected
  const selected = concepts.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setEditTitle(selected.title)
    setEditCategory(selected.category)
    setEditSummary(selected.summary)
    setEditQuality(selected.qualityScore)
    setEditRelated((selected.relatedConcepts ?? []).join(", "))
    setContentMd(selected.contentMd ?? "")
    setPreview(false)
    setEditingEvId(null)
    setAddingEvidence(false)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = concepts.filter((c) =>
    search === "" || c.title.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()),
  )

  const categories = [...new Set(concepts.map((c) => c.category))]

  async function handleSaveInfo() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateConceptAdmin(selectedId, {
        title: editTitle,
        category: editCategory,
        summary: editSummary,
        quality_score: editQuality,
        related_concepts: editRelated.split(",").map((s) => s.trim()).filter(Boolean),
      })
      await loadConcepts()
    } finally { setSaving(false) }
  }

  async function handleSaveContent() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateConceptAdmin(selectedId, { content_md: contentMd })
      await loadConcepts()
    } finally { setSaving(false) }
  }

  async function handleCreate() {
    if (!newId || !newTitle || !newCategory || !newSummary) return
    setSaving(true)
    try {
      await createConceptAdmin({ id: newId, title: newTitle, category: newCategory, summary: newSummary })
      setShowCreate(false)
      setNewId(""); setNewTitle(""); setNewCategory(""); setNewSummary("")
      setSelectedId(newId)
      await loadConcepts()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await deleteConceptAdmin(id)
    setSelectedId(null)
    await loadConcepts()
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContentMd(ev.target?.result as string)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  async function handleAddEvidence(data: { source: string; summary: string; curator: string; curator_tier: string; comment: string }) {
    if (!selectedId) return
    await addEvidenceAdmin(selectedId, data)
    setAddingEvidence(false)
    await loadConcepts()
  }

  async function handleUpdateEvidence(evidenceId: string, data: Record<string, unknown>) {
    if (!selectedId) return
    await updateEvidenceAdmin(selectedId, evidenceId, data)
    setEditingEvId(null)
    await loadConcepts()
  }

  async function handleDeleteEvidence(evidenceId: string) {
    if (!selectedId) return
    await deleteEvidenceAdmin(selectedId, evidenceId)
    await loadConcepts()
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
  }

  const subTabs = [
    { key: "info" as const, label: "기본 정보", icon: FileText },
    { key: "content" as const, label: "콘텐츠", icon: BookOpen },
    { key: "evidence" as const, label: `Evidence`, count: selected?.evidence?.length ?? 0, icon: Edit3 },
  ]

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-5 overflow-hidden p-4 lg:p-5">
      {/* Left panel — 카드 */}
      <div className="flex w-full lg:w-[300px] shrink-0 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden max-h-[40vh] lg:max-h-none">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-[14px] font-bold text-[#1A1626]">Knowledge</h3>
          <button
            onClick={() => { setShowCreate(true); setSelectedId(null) }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E0E0E0] text-[#666] transition-colors hover:border-[#999] hover:text-[#333] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색" className="w-full rounded-lg border border-[#E0E0E0] bg-[#FBFAF8] py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-[#888] focus:border-[#1A1626] focus:bg-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedId(c.id); setShowCreate(false); setSubTab("info") }}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 mb-1 text-left transition-all",
                selectedId === c.id && !showCreate
                  ? "border border-[#D4854A] bg-[#FFF8F0]"
                  : "border border-transparent hover:bg-[#FAFAFA]",
              )}
            >
              <p className={cn("text-[12px] font-semibold leading-snug truncate", selectedId === c.id && !showCreate ? "text-[#1A1626]" : "text-[#1A1626]")}>{c.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                <span className="text-[#7B5EA7]">{c.category}</span>
                <span className="text-[#D4854A] font-medium">Q{c.qualityScore}</span>
                {!c.isActive && <span className="text-[#E57373]">비활성</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — 카드 */}
      <div className="flex flex-1 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden">
        {showCreate ? (
          /* ── Create form ── */
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="mb-4 text-[15px] font-bold">새 개념 생성</h3>
            <div className="space-y-4 max-w-lg">
              <div><label className={labelCls}>ID (slug)</label><input value={newId} onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="rag" className={cn(inputBase, "mt-1")} /></div>
              <div><label className={labelCls}>Title</label><input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); if (!newId) setNewId(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) }} placeholder="Retrieval-Augmented Generation" className={cn(inputBase, "mt-1")} /></div>
              <div><label className={labelCls}>Category</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setNewCategory(cat)} className={cn("rounded-full px-3 py-1 text-[11px] border transition-colors", newCategory === cat ? "border-[#666] bg-[#FAFAFA] text-[#666]" : "border-[#E0E0E0] text-[#666] hover:border-[#666]")}>{cat}</button>
                  ))}
                  <input value={categories.includes(newCategory) ? "" : newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="또는 새 카테고리" className={cn(inputBase, "w-40")} />
                </div>
              </div>
              <div><label className={labelCls}>Summary</label><textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} rows={3} className={cn(inputBase, "mt-1 resize-none")} /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className={btnSecondary}>취소</button>
                <button onClick={handleCreate} disabled={saving || !newId || !newTitle || !newCategory || !newSummary} className={cn(btnPrimary, "disabled:opacity-40")} >{saving ? "생성 중..." : "생성"}</button>
              </div>
            </div>
          </div>
        ) : selected ? (
          /* ── Detail view ── */
          <>
            {/* Header + Sub-tabs */}
            <div className="shrink-0 border-b border-[#E0E0E0] px-5 pt-4 pb-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[14px] font-bold">{selected.title}</h3>
                  <p className="text-[10px]"><span className="text-[#999]">{selected.id}</span> · <span className="text-[#7B5EA7]">{selected.category}</span></p>
                </div>
                <button onClick={() => handleDelete(selected.id)} className="flex items-center gap-1 rounded-lg border border-[#E0E0E0] px-2.5 py-1 text-[11px] text-[#888] transition-colors hover:border-red-200 hover:text-red-400">
                  <Trash2 className="h-3 w-3" /> 삭제
                </button>
              </div>
              <div className="flex gap-0">
                {subTabs.map((t) => (
                  <button key={t.key} onClick={() => setSubTab(t.key)} className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors", subTab === t.key ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]")}>
                    <t.icon className="h-3.5 w-3.5" />{t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {subTab === "info" && (
                <div className="space-y-4 max-w-lg">
                  <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#1A1626]">Title</label><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={cn(inputBase, "mt-1")} /></div>
                  <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7B5EA7]">Category</label><input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className={cn(inputBase, "mt-1")} /></div>
                  <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#666]">Summary</label><textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={3} className={cn(inputBase, "mt-1 resize-none")} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#D4854A]">Quality Score</label><input type="number" step="0.1" min="0" max="5" value={editQuality} onChange={(e) => setEditQuality(Number(e.target.value))} className={cn(inputBase, "mt-1")} /></div>
                    <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#2D7A5E]">Source Count</label><input type="number" value={selected.sourceCount} disabled className={cn(inputBase, "mt-1 bg-[#F9F7F5]")} /></div>
                  </div>
                  <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#999]">Related Concepts (comma-separated)</label><input value={editRelated} onChange={(e) => setEditRelated(e.target.value)} placeholder="chain-of-thought, embeddings" className={cn(inputBase, "mt-1")} /></div>
                  <div className="pt-2">
                    <button onClick={handleSaveInfo} disabled={saving} className={cn(btnPrimary, "disabled:opacity-40")} >{saving ? "저장 중..." : "저장"}</button>
                  </div>
                </div>
              )}

              {subTab === "content" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPreview(false)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors", !preview ? "bg-[#FAFAFA] text-[#666]" : "text-[#666] hover:bg-[#FAFAFA]")}>
                        <Edit3 className="mr-1 inline h-3.5 w-3.5" />편집
                      </button>
                      <button onClick={() => setPreview(true)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors", preview ? "bg-[#FAFAFA] text-[#666]" : "text-[#666] hover:bg-[#FAFAFA]")}>
                        <Eye className="mr-1 inline h-3.5 w-3.5" />미리보기
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleFileUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className={cn(btnSecondary, "flex items-center gap-1")}>
                        <Upload className="h-3.5 w-3.5" />.md 업로드
                      </button>
                      <button onClick={handleSaveContent} disabled={saving} className={cn(btnPrimary, "disabled:opacity-40")} >{saving ? "저장 중..." : "저장"}</button>
                    </div>
                  </div>

                  {!preview ? (
                    <textarea
                      value={contentMd}
                      onChange={(e) => setContentMd(e.target.value)}
                      rows={24}
                      className={cn(inputBase, "resize-none font-mono text-[12px] leading-relaxed")}
                      placeholder="마크다운 콘텐츠를 입력하거나 .md 파일을 업로드하세요"
                    />
                  ) : (
                    <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
                      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#333]">{contentMd || "(비어있음)"}</pre>
                    </div>
                  )}

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file && (file.name.endsWith(".md") || file.name.endsWith(".txt"))) {
                        const reader = new FileReader()
                        reader.onload = (ev) => setContentMd(ev.target?.result as string)
                        reader.readAsText(file)
                      }
                    }}
                    className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#E0E0E0] p-6 text-[13px] text-[#888] transition-colors hover:border-[#999]"
                  >
                    <Upload className="mr-2 h-4 w-4" /> .md / .txt 파일을 드래그 앤 드롭
                  </div>
                </div>
              )}

              {subTab === "evidence" && (
                <div className="space-y-3">
                  {(selected.evidence ?? []).map((ev) => (
                    editingEvId === ev.id ? (
                      <EvidenceForm key={ev.id} initial={ev} onSave={(data) => handleUpdateEvidence(ev.id, data)} onCancel={() => setEditingEvId(null)} />
                    ) : (
                      <div key={ev.id} className="group rounded-xl border border-[#E0E0E0] bg-white p-4 transition-colors hover:border-[#CCC]">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-[13px] font-semibold text-[#1A1626]">{ev.source}</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-[#666]">{ev.summary}</p>
                            {ev.comment && <p className="mt-1 text-[11px] italic text-[#888]">&ldquo;{ev.comment}&rdquo;</p>}
                          </div>
                          <div className="ml-3 flex flex-col items-end gap-1">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: ev.curatorTier === "Gold" ? "#FFF3E0" : ev.curatorTier === "Silver" ? "#FAFAFA" : "#FAFAFA", color: ev.curatorTier === "Gold" ? "#D4854A" : "#888" }}>{ev.curator} · {ev.curatorTier}</span>
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button onClick={() => setEditingEvId(ev.id)} className="rounded p-1 text-[#888] hover:bg-[#FAFAFA] hover:text-[#D4854A]"><Edit3 className="h-3 w-3" /></button>
                              <button onClick={() => handleDeleteEvidence(ev.id)} className="rounded p-1 text-[#888] hover:bg-red-50 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}

                  {addingEvidence ? (
                    <EvidenceForm onSave={handleAddEvidence} onCancel={() => setAddingEvidence(false)} />
                  ) : (
                    <button onClick={() => setAddingEvidence(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#E0E0E0] py-4 text-[13px] text-[#888] transition-colors hover:border-[#D4854A] hover:text-[#D4854A]">
                      <Plus className="h-4 w-4" /> Evidence 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[14px] text-[#888]">
            좌측에서 개념을 선택하세요
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Main Admin Page
═══════════════════════════════════════════ */
export default function KaasAdminPage() {
  const [topTab, setTopTab] = useState<"curation" | "template">("curation")

  const topTabs = [
    { key: "curation" as const, label: "지식 큐레이팅" },
    { key: "template" as const, label: "프롬프트 템플릿" },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden text-[#1A1626]">
      {/* Header — Dashboard 스타일: 제목 + 탭 나란히 */}
      <div className="shrink-0 border-b border-[#E0E0E0] bg-white px-6 pt-5 pb-0">
        <div className="flex items-center gap-6 mb-3">
          <h2 className="text-[18px] font-bold">Admin</h2>
        </div>
        <div className="flex gap-0">
          {topTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTopTab(t.key)}
              className={cn(
                "border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors",
                topTab === t.key
                  ? "border-[#D4854A] text-[#1A1626]"
                  : "border-transparent text-[#888] hover:text-[#333]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden bg-[#FAFAFA]">
        {topTab === "curation" && <KnowledgeCurationPanel />}
        {topTab === "template" && <TemplateEditorBody />}
      </div>
    </div>
  )
}
