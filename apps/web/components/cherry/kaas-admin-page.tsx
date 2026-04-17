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

/** UUID v7 생성 (타임스탬프 기반, 정렬 가능) */
function uuidv7(): string {
  const now = Date.now()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // 48-bit timestamp (ms)
  bytes[0] = (now / 2 ** 40) & 0xff
  bytes[1] = (now / 2 ** 32) & 0xff
  bytes[2] = (now / 2 ** 24) & 0xff
  bytes[3] = (now / 2 ** 16) & 0xff
  bytes[4] = (now / 2 ** 8) & 0xff
  bytes[5] = now & 0xff
  // version 7
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  // variant 10xx
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

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
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button onClick={() => onSave({ source, summary, curator, curator_tier: tier, comment })} disabled={!source || !summary || !curator} className={cn(btnPrimary, "disabled:opacity-40")}>Save</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Knowledge Curation Panel
═══════════════════════════════════════════ */
export function KnowledgeCurationPanel({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const [concepts, setConcepts] = useState<AdminConcept[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [subTab, setSubTab] = useState<"info" | "content" | "evidence">("info")

  // Create mode
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newSummary, setNewSummary] = useState("")

  // Edit state
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editQuality, setEditQuality] = useState(0)
  const [editRelated, setEditRelated] = useState("")
  const [editOnSale, setEditOnSale] = useState(false)
  const [editSaleDiscount, setEditSaleDiscount] = useState(20)

  // Content
  const [contentMd, setContentMd] = useState("")
  const [preview, setPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Evidence
  const [editingEvId, setEditingEvId] = useState<string | null>(null)
  const [addingEvidence, setAddingEvidence] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const showSaved = (key: string) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000)
  }

  // 로그인 유저 ID (JWT에서 추출)
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUserId(payload.id ?? null)
      }
    } catch {}
  }, [])

  const loadConcepts = useCallback(async () => {
    try {
      // 관리자: __ADMIN__ → __SYSTEM__ + 자기 것, 일반 유저: 자기 userId → 자기 것만
      const filter = isAdmin ? '__ADMIN__' : (userId ?? '__NONE__')
      const data = await fetchConceptsAdmin(filter)
      setConcepts(data)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch {
      /* fallback: keep empty */
    } finally {
      setLoading(false)
    }
  }, [selectedId, isAdmin, userId])

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
    setEditOnSale((selected as any).isOnSale ?? false)
    setEditSaleDiscount((selected as any).saleDiscount ?? 20)
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
        is_on_sale: editOnSale,
        sale_discount: editSaleDiscount,
      })
      await loadConcepts()
      showSaved("info")
    } finally { setSaving(false) }
  }

  async function handleSaveContent() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateConceptAdmin(selectedId, { content_md: contentMd })
      await loadConcepts()
      showSaved("content")
    } finally { setSaving(false) }
  }

  async function handleCreate() {
    if (!newTitle || !newCategory || !newSummary) return
    setSaving(true)
    const id = uuidv7()
    try {
      await createConceptAdmin({ id, title: newTitle, category: newCategory, summary: newSummary, created_by: isAdmin ? '__SYSTEM__' : (userId ?? '__SYSTEM__') })
      // 일부러 최소 0.5초 스피닝 — 사용자가 변화를 인지할 수 있도록
      await new Promise((r) => setTimeout(r, 500))
      setShowCreate(false)
      setNewTitle(""); setNewCategory(""); setNewSummary("")
      setSelectedId(id)
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
    { key: "info" as const, label: "Basic Info", icon: FileText },
    { key: "content" as const, label: "Content", icon: BookOpen },
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-[#E0E0E0] bg-[#FBFAF8] py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-[#888] focus:border-[#1A1626] focus:bg-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <BookOpen className="h-8 w-8 text-[#D4854A] mb-3 opacity-60" />
              <p className="text-[13px] font-semibold text-[#3D3652]">No knowledge yet</p>
            </div>
          )}
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
                {!c.isActive && <span className="text-[#E57373]">Inactive</span>}
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
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#FFF3E8] flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-[#D4854A]" />
                </div>
                <h3 className="text-[16px] font-bold text-[#1A1626]">Create New Knowledge</h3>
                <p className="text-[12px] text-[#888] mt-1">Build a concept that agents can purchase. You earn 40% of every sale.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Title</label>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Retrieval-Augmented Generation" className={cn(inputBase, "mt-1")} />
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button key={cat} onClick={() => setNewCategory(cat)} className={cn("rounded-full px-3 py-1 text-[11px] border transition-colors", newCategory === cat ? "border-[#D4854A] bg-[#FFF8F0] text-[#D4854A]" : "border-[#E0E0E0] text-[#666] hover:border-[#D4854A]")}>{cat}</button>
                    ))}
                    <input value={categories.includes(newCategory) ? "" : newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="or new category" className={cn(inputBase, "w-40")} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Summary</label>
                  <textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} rows={3} placeholder="Describe what this knowledge covers and why it's valuable…" className={cn(inputBase, "mt-1 resize-none")} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowCreate(false)} className={btnSecondary}>Cancel</button>
                  <button onClick={handleCreate} disabled={saving || !newTitle || !newCategory || !newSummary} className={cn(btnPrimary, "disabled:opacity-40 inline-flex items-center gap-1.5")}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {saving ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
              <div className="mt-6 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0] p-4">
                <p className="text-[11px] font-semibold text-[#666] mb-2">After creating, you can:</p>
                <ul className="text-[11px] text-[#888] space-y-1">
                  <li>• Upload markdown content for the full knowledge body</li>
                  <li>• Add evidence sources with curator commentary</li>
                  <li>• Set sale pricing and discounts</li>
                  <li>• Publish to the Knowledge Market</li>
                </ul>
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
                  <Trash2 className="h-3 w-3" /> Delete
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#C94B6E]">Sale</label>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => setEditOnSale(!editOnSale)}
                          className={cn("relative w-10 h-5 rounded-full transition-colors", editOnSale ? "bg-[#C94B6E]" : "bg-[#E0E0E0]")}
                        >
                          <span
                            className="absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: `translateX(${editOnSale ? 22 : 2}px)` }}
                          />
                        </button>
                        <span className="text-[12px] text-[#666]">{editOnSale ? "On Sale" : "Off"}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#C94B6E]">Discount %</label>
                      <input type="number" min="1" max="90" value={editSaleDiscount} onChange={(e) => setEditSaleDiscount(Number(e.target.value))} disabled={!editOnSale} className={cn(inputBase, "mt-1", !editOnSale && "bg-[#F9F7F5] opacity-50")} />
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-3">
                    <button onClick={handleSaveInfo} disabled={saving} className={cn(btnPrimary, "disabled:opacity-40")}>저장</button>
                    {savedKey === "info" && <span className="text-[12px] text-[#2D7A5E] font-medium">✓ 저장되었습니다</span>}
                  </div>
                </div>
              )}

              {subTab === "content" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPreview(false)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors", !preview ? "bg-[#FAFAFA] text-[#666]" : "text-[#666] hover:bg-[#FAFAFA]")}>
                        <Edit3 className="mr-1 inline h-3.5 w-3.5" />Edit
                      </button>
                      <button onClick={() => setPreview(true)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors", preview ? "bg-[#FAFAFA] text-[#666]" : "text-[#666] hover:bg-[#FAFAFA]")}>
                        <Eye className="mr-1 inline h-3.5 w-3.5" />Preview
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleFileUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className={cn(btnSecondary, "flex items-center gap-1")}>
                          <Upload className="h-3.5 w-3.5" />Upload .md
                        </button>
                        <button onClick={handleSaveContent} disabled={saving} className={cn(btnPrimary, "disabled:opacity-40")}>저장</button>
                      </div>
                      <div className="h-[18px]">
                        {savedKey === "content" && <span className="text-[12px] text-[#2D7A5E] font-medium">✓ 저장되었습니다</span>}
                      </div>
                    </div>
                  </div>

                  {!preview ? (
                    <textarea
                      value={contentMd}
                      onChange={(e) => setContentMd(e.target.value)}
                      rows={24}
                      className={cn(inputBase, "resize-none font-mono text-[12px] leading-relaxed")}
                      placeholder="Type markdown content or upload a .md file"
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
                    <Upload className="mr-2 h-4 w-4" /> Drag & drop a .md / .txt file
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
                      <Plus className="h-4 w-4" /> Add Evidence
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-8 -mt-16">
            <h3 className="text-[15px] font-bold text-[#1A1626] mb-2">Knowledge Curation Studio</h3>
            <p className="text-[12px] text-[#888] leading-relaxed max-w-xs mb-4">
              Create and curate knowledge that AI agents can purchase from the Market.
              You earn 40% revenue share on every sale.
            </p>
            <button
              onClick={() => { setShowCreate(true); setSelectedId(null) }}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white bg-[#D4854A] hover:bg-[#C07438] transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create your first concept
            </button>
            <div className="mt-6 text-center">
              <div>
                <p className="text-[18px] font-bold text-[#D4854A]">40%</p>
                <p className="text-[10px] text-[#888] -ml-1">Revenue share</p>
              </div>
            </div>
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
    { key: "curation" as const, label: "Knowledge Curation" },
    { key: "template" as const, label: "Prompt Templates" },
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
