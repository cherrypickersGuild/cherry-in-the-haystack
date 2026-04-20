"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, Plus, Trash2, Upload, Eye, Edit3, FileText, BookOpen, Loader2, EyeOff, Globe, X, ChevronDown } from "lucide-react"
import {
  fetchConceptsAdmin,
  createConceptAdmin,
  updateConceptAdmin,
  deleteConceptAdmin,
  hideConceptAdmin,
  unhideConceptAdmin,
  addEvidenceAdmin,
  updateEvidenceAdmin,
  deleteEvidenceAdmin,
  type AdminConcept,
  type AdminEvidence,
} from "@/lib/api"

/* 컨셉페이지 대시보드 전용 로컬 타입 — 전부 mock, API 연결 없음. */
interface ProgressiveRef {
  concept_id?: string
  external?: string
  title: string
  learn: string
  adds?: string
}
interface ConceptPublication {
  isPublished: boolean
  publishedAt: string | null
  slug: string
  name: string
  existsOnPublicPage: boolean
  relatedConcepts: string[]
  progressiveRefs: ProgressiveRef[]
}
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

/** 카테고리 고정 enum — 자유 타이핑 금지, 목록 통일 */
const CATEGORY_OPTIONS = ["Basic", "Advanced", "Technique"] as const
type Category = typeof CATEGORY_OPTIONS[number]

/** 신규 concept 기본 품질 점수 (마켓에서 별 4개로 노출) */
const DEFAULT_QUALITY_SCORE = 4

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
  const [listTab, setListTab] = useState<"market" | "user">("market")
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All")
  const [subTab, setSubTab] = useState<"info" | "content" | "evidence">("info")

  // Create mode
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState<Category>("Basic")
  const [newSummary, setNewSummary] = useState("")

  // Edit state
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editQuality, setEditQuality] = useState(0)
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
    setEditOnSale((selected as any).isOnSale ?? false)
    setEditSaleDiscount((selected as any).saleDiscount ?? 20)
    setContentMd(selected.contentMd ?? "")
    setPreview(false)
    setEditingEvId(null)
    setAddingEvidence(false)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 삭제(revoked_at IS NOT NULL)는 항상 제외, hidden은 뒤에
  const nonDeleted = concepts.filter((c) => !c.revokedAt)
  const sortedNonDeleted = [
    ...nonDeleted.filter((c) => c.isActive),
    ...nonDeleted.filter((c) => !c.isActive),
  ]

  const listConcepts = isAdmin
    ? listTab === "market"
      ? sortedNonDeleted.filter((c) => c.createdBy === '__SYSTEM__')
      : sortedNonDeleted.filter((c) => c.createdBy !== '__SYSTEM__')
    : nonDeleted.filter((c) => c.isActive)

  const CATEGORY_FILTERS = ["All", ...CATEGORY_OPTIONS] as const

  const filtered = listConcepts.filter((c) => {
    const matchCat = categoryFilter === "All" || c.category === categoryFilter
    const matchSearch = search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      (c.createdBy ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.createdByLabel ?? "").toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  async function handleSaveInfo() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateConceptAdmin(selectedId, {
        title: editTitle,
        category: editCategory,
        summary: editSummary,
        quality_score: editQuality,
        is_on_sale: editOnSale,
        sale_discount: editSaleDiscount,
      })
      await loadConcepts()
      window.dispatchEvent(new CustomEvent("kaas-catalog-changed"))
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
      await createConceptAdmin({
        id,
        title: newTitle,
        category: newCategory,
        summary: newSummary,
        quality_score: DEFAULT_QUALITY_SCORE, // 신규 concept는 마켓에서 별 4개 기본
        created_by: isAdmin ? '__SYSTEM__' : (userId ?? '__SYSTEM__'),
      })
      // 일부러 최소 0.5초 스피닝 — 사용자가 변화를 인지할 수 있도록
      await new Promise((r) => setTimeout(r, 500))
      setShowCreate(false)
      setNewTitle(""); setNewCategory(""); setNewSummary("")
      setSelectedId(id)
      await loadConcepts()
    } finally { setSaving(false) }
  }

  async function handleToggleHide(id: string, currentlyActive: boolean) {
    if (currentlyActive) {
      await hideConceptAdmin(id)
      setConcepts((prev) => prev.map((c) => c.id === id ? { ...c, isActive: false } : c))
    } else {
      await unhideConceptAdmin(id)
      setConcepts((prev) => prev.map((c) => c.id === id ? { ...c, isActive: true } : c))
    }
  }

  async function handleDelete(id: string) {
    await deleteConceptAdmin(id)
    setSelectedId(null)
    setConcepts((prev) => prev.filter((c) => c.id !== id))
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
        {isAdmin && (
          <div className="flex border-b border-[#F0F0F0] px-3 pb-0">
            {(["market", "user"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setListTab(tab); setSelectedId(null); setSearch("") }}
                className={cn(
                  "border-b-2 px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors",
                  listTab === tab ? "border-[#D4854A] text-[#1A1626]" : "border-transparent text-[#888] hover:text-[#333]"
                )}
              >
                {tab === "market" ? "Market" : "User"}
              </button>
            ))}
          </div>
        )}
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAdmin && listTab === "user" ? "Search title, user ID…" : "Search"} className="w-full rounded-lg border border-[#E0E0E0] bg-[#FBFAF8] py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-[#888] focus:border-[#1A1626] focus:bg-white" />
          </div>
        </div>
        <div className="flex gap-1 px-3 pb-2 flex-wrap">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat as typeof categoryFilter)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors border",
                categoryFilter === cat
                  ? "bg-[#1A1626] text-white border-[#1A1626]"
                  : "border-[#E0E0E0] text-[#888] hover:border-[#999] hover:text-[#555]"
              )}
            >
              {cat}
            </button>
          ))}
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
              <p className={cn(
                "text-[12px] font-semibold leading-snug truncate",
                !c.isActive ? "text-[#BBB]" : (selectedId === c.id && !showCreate ? "text-[#1A1626]" : "text-[#1A1626]")
              )}>{c.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] flex-wrap">
                <span className={cn(c.isActive ? "text-[#7B5EA7]" : "text-[#CCC]")}>{c.category}</span>
                <span className={cn("font-medium", c.isActive ? "text-[#D4854A]" : "text-[#CCC]")}>Q{c.qualityScore}</span>
                {!c.isActive && <span className="text-[#CCC]">Hidden</span>}
                {isAdmin && listTab === "user" && c.createdBy && c.createdBy !== '__SYSTEM__' && (
                  <span className="text-[#999] truncate max-w-[100px]">{c.createdByLabel ?? c.createdBy.slice(0, 8)}</span>
                )}
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
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] border transition-colors",
                          newCategory === cat
                            ? "border-[#D4854A] bg-[#FFF8F0] text-[#D4854A] font-semibold"
                            : "border-[#E0E0E0] text-[#666] hover:border-[#D4854A]"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
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
                <div className="flex items-center gap-1.5">
                  {!selected.revokedAt && (
                    <button
                      onClick={() => handleToggleHide(selected.id, selected.isActive)}
                      className="flex items-center gap-1 rounded-lg border border-[#E0E0E0] px-2.5 py-1 text-[11px] text-[#888] transition-colors hover:border-amber-300 hover:text-amber-500"
                    >
                      {selected.isActive
                        ? <><EyeOff className="h-3 w-3" /> Hide</>
                        : <><Eye className="h-3 w-3" /> Show</>
                      }
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!confirm(`Permanently soft-delete "${selected.title}"? This records revoked_at and cannot be undone.`)) return
                      handleDelete(selected.id)
                    }}
                    disabled={!!selected.revokedAt}
                    title={selected.revokedAt ? `Already deleted at ${selected.revokedAt}` : "Soft-delete (records revoked_at)"}
                    className="flex items-center gap-1 rounded-lg border border-[#E0E0E0] px-2.5 py-1 text-[11px] text-[#888] transition-colors hover:border-red-200 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3 w-3" /> {selected.revokedAt ? "Deleted" : "Delete"}
                  </button>
                </div>
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
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7B5EA7]">Category</label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {CATEGORY_OPTIONS.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setEditCategory(cat)}
                          className={cn(
                            "rounded-full px-3 py-1 text-[11px] border transition-colors",
                            editCategory === cat
                              ? "border-[#D4854A] bg-[#FFF8F0] text-[#D4854A] font-semibold"
                              : "border-[#E0E0E0] text-[#666] hover:border-[#D4854A]"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#666]">Summary</label><textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={3} className={cn(inputBase, "mt-1 resize-none")} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#D4854A]">Quality Score</label><input type="number" step="0.1" min="0" max="5" value={editQuality} onChange={(e) => setEditQuality(Number(e.target.value))} className={cn(inputBase, "mt-1")} /></div>
                    <div><label className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#2D7A5E]">Source Count</label><input type="number" value={selected.sourceCount} disabled className={cn(inputBase, "mt-1 bg-[#F9F7F5]")} /></div>
                  </div>
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
   Concept Page Publish Panel
   (content.concept_page + content.concept_changelog)
═══════════════════════════════════════════ */

/* Mock graph-baseline data — simulates what ontology graph would return.
   Once GraphDB is wired, replace with API fetch. */
const MOCK_GRAPH_CHILDREN: Array<{ id: string; type: "SUBTOPIC" | "PREREQUISITE" | "EXTENDS" | "RELATED"; label: string; desc: string; color: string }> = [
  { id: "graph:vector-db", type: "SUBTOPIC", label: "Vector Databases", desc: "Stores and retrieves embeddings for similarity search", color: "#7B5EA7" },
  { id: "graph:hybrid-search", type: "SUBTOPIC", label: "Hybrid Search", desc: "Combines dense vector + sparse BM25 retrieval", color: "#7B5EA7" },
  { id: "graph:embeddings", type: "PREREQUISITE", label: "Embeddings", desc: "Text → dense vector representation", color: "#9E97B3" },
  { id: "graph:reranking", type: "EXTENDS", label: "Reranking", desc: "Post-retrieval re-scoring for relevance", color: "#2D7A5E" },
  { id: "graph:chunking", type: "RELATED", label: "Chunking Strategies", desc: "How to split documents for retrieval", color: "#D4854A" },
  { id: "graph:contextual-retrieval", type: "EXTENDS", label: "Contextual Retrieval", desc: "Adds context prefix before embedding each chunk", color: "#2D7A5E" },
]

const MOCK_GRAPH_REFS: Array<{ id: string; label: string; labelColor: string; title: string; learn: string; adds: string; depth: number }> = [
  { id: "graph:ref-1", label: "START HERE", labelColor: "#C94B6E", title: "Chip Huyen — AI Engineering, Chapter 6", learn: "Broadest accessible overview. Retrieval-first mental model. Use as your first RAG reference.", adds: "Foundational mental model", depth: 0 },
  { id: "graph:ref-2", label: "NEXT →", labelColor: "#9E97B3", title: "LlamaIndex Documentation — Production RAG Patterns", learn: "Operational depth: chunking, hybrid search, reranking. Hands-on.", adds: "Production gap knowledge", depth: 1 },
  { id: "graph:ref-3", label: "THEN →", labelColor: "#9E97B3", title: "Anthropic Cookbook — Contextual Retrieval", learn: "State-of-the-art technique adding context prefix. -67% retrieval failures.", adds: "Latest SOTA technique", depth: 2 },
  { id: "graph:ref-4", label: "DEEP DIVE →", labelColor: "#9E97B3", title: "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction", learn: "Academic foundation for late interaction retrieval. For building custom retrievers.", adds: "Research-level depth", depth: 3 },
]

/* Mock concept list — 컨셉페이지 대시보드 전용 가상 데이터. API 연결 없음. */
const MOCK_CONCEPTS: AdminConcept[] = [
  {
    id: "mock-rag",
    title: "Retrieval Augmented Generation",
    category: "Advanced",
    summary: "Retrieve relevant documents, then generate answers grounded in them.",
    contentMd: `RAG combines a retriever with a generator.
The retriever fetches top-k passages from a knowledge base.
The generator (an LLM) conditions its output on those passages.
This lets the model answer questions beyond its training cutoff.
Typical pipeline: query → embed → vector search → rerank → prompt → generate.
Quality depends on chunking, embedding model, and retrieval recall.
Failure modes: irrelevant context, stale index, hallucination despite context.
Hybrid search (dense + BM25) often beats dense-only.
Reranking lifts precision at top-k.
Contextual retrieval adds prefix context per chunk before embedding.`,
    qualityScore: 4,
    sourceCount: 5,
    updatedAt: "2026-04-15T10:00:00Z",
    relatedConcepts: [],
    isActive: true,
    createdBy: "admin",
    createdByLabel: "Admin",
    revokedAt: null,
    evidence: [
      { id: "ev-rag-1", source: "Chip Huyen — AI Engineering Ch.6", summary: "Retrieval-first mental model; RAG as default for production LLMs.", curator: "Admin", curatorTier: "Gold", comment: "Great first read." },
      { id: "ev-rag-2", source: "Anthropic Cookbook — Contextual Retrieval", summary: "Prefix each chunk with doc-level context before embedding. -67% retrieval failures.", curator: "Admin", curatorTier: "Gold", comment: "" },
    ],
  },
  {
    id: "mock-embeddings",
    title: "Embeddings",
    category: "Basic",
    summary: "Dense vector representations of text for similarity search.",
    contentMd: `Embeddings map text to fixed-dimensional vectors.
Semantically similar inputs produce geometrically close vectors.
Cosine similarity and dot product measure closeness.
Modern models: text-embedding-3-small/large, voyage-3, bge-large.
Embedding dim typically 384–3072.
Used for retrieval, clustering, classification, deduplication.
Quality is task-dependent — benchmark on your data (MTEB ≠ your domain).
Normalize vectors if using cosine or IP indices that assume unit length.
Re-embed when you upgrade the model — old vectors are incompatible.
Cost scales with token count; batch aggressively.`,
    qualityScore: 4,
    sourceCount: 3,
    updatedAt: "2026-04-10T10:00:00Z",
    relatedConcepts: [],
    isActive: true,
    createdBy: "admin",
    createdByLabel: "Admin",
    revokedAt: null,
    evidence: [],
  },
  {
    id: "mock-vector-db",
    title: "Vector Databases",
    category: "Technique",
    summary: "Specialized stores for high-dimensional vector similarity search.",
    contentMd: `Vector DBs index embeddings for fast approximate nearest-neighbor (ANN) search.
Popular engines: Pinecone, Weaviate, Qdrant, Milvus, pgvector.
Indexing algorithms: HNSW (graph), IVF (partitioning), ScaNN.
Tradeoff: recall vs. latency vs. memory — tune ef_construction, ef_search.
Support filtered search (metadata predicates + ANN) for production workloads.
Hybrid search blends dense vectors with sparse (BM25) scores.
Serverless options shift cost model from instance hours to query volume.
pgvector gives you ANN inside Postgres — simpler ops, tighter transactional story.
Schema design matters: store chunk text + metadata alongside the vector.
Rebuild indices periodically as data drifts.`,
    qualityScore: 4,
    sourceCount: 4,
    updatedAt: "2026-04-05T10:00:00Z",
    relatedConcepts: [],
    isActive: true,
    createdBy: "admin",
    createdByLabel: "Admin",
    revokedAt: null,
    evidence: [],
  },
]

const MOCK_PUBLICATIONS: Record<string, ConceptPublication> = {
  "mock-rag": {
    isPublished: true,
    publishedAt: "2026-04-16T12:00:00Z",
    slug: "rag",
    name: "Retrieval Augmented Generation",
    existsOnPublicPage: true,
    relatedConcepts: ["mock-embeddings"],
    progressiveRefs: [],
  },
  "mock-embeddings": {
    isPublished: false,
    publishedAt: null,
    slug: "embeddings",
    name: "Embeddings",
    existsOnPublicPage: false,
    relatedConcepts: [],
    progressiveRefs: [],
  },
  "mock-vector-db": {
    isPublished: false,
    publishedAt: null,
    slug: "vector-databases",
    name: "Vector Databases",
    existsOnPublicPage: false,
    relatedConcepts: [],
    progressiveRefs: [],
  },
}

/* Progressive Reference phase label — 편집 시 드롭다운으로 선택. */
const PHASE_OPTIONS = ["START HERE", "NEXT →", "THEN →", "DEEP DIVE →"] as const
type Phase = typeof PHASE_OPTIONS[number]
type LocalRef = ProgressiveRef & { phase?: Phase }

const PHASE_COLOR: Record<Phase, string> = {
  "START HERE": "#C94B6E",
  "NEXT →": "#9E97B3",
  "THEN →": "#9E97B3",
  "DEEP DIVE →": "#9E97B3",
}

/* Contributors — 홈페이지 concept-reader "Knowledge Team" 카드와 동일 구조. */
type Contributor = { id: string; initials: string; name: string; role: string }

const MOCK_CONTRIBUTORS: Record<string, Contributor[]> = {
  "mock-rag": [
    { id: "c-1", initials: "KJ", name: "Keanu J.", role: "Lead reviewer" },
    { id: "c-2", initials: "SY", name: "Soyeon Y.", role: "Evidence sourcing" },
    { id: "c-3", initials: "MH", name: "Min H.", role: "Concept mapping" },
    { id: "c-4", initials: "JP", name: "Jiwon P.", role: "Editor" },
  ],
  "mock-embeddings": [
    { id: "c-1", initials: "KJ", name: "Keanu J.", role: "Lead reviewer" },
    { id: "c-2", initials: "SY", name: "Soyeon Y.", role: "Evidence sourcing" },
  ],
  "mock-vector-db": [
    { id: "c-1", initials: "MH", name: "Min H.", role: "Concept mapping" },
  ],
}

export function ConceptPagePublishPanel() {
  const [concepts, setConcepts] = useState<AdminConcept[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All")

  const [publication, setPublicationState] = useState<ConceptPublication | null>(null)
  const [publicationLoading, setPublicationLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Overview editor — binds to kaas.concept.content_md (same source as Content tab)
  const [overviewDraft, setOverviewDraft] = useState("")
  const [overviewMode, setOverviewMode] = useState<"edit" | "preview">("edit")
  const [overviewSaving, setOverviewSaving] = useState(false)
  const [overviewSavedFlash, setOverviewSavedFlash] = useState(false)

  // Child Concepts editor — stores concept IDs in content.concept_page.related_concepts
  const [childIds, setChildIds] = useState<string[]>([])
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [childPickerSearch, setChildPickerSearch] = useState("")
  const [childSaving, setChildSaving] = useState(false)
  const [childSavedFlash, setChildSavedFlash] = useState(false)
  // Hidden graph-baseline children (local-only until hide-override column exists)
  const [hiddenBaselineChildren, setHiddenBaselineChildren] = useState<string[]>([])

  // Progressive References editor — content.concept_page.progressive_refs
  const [refsDraft, setRefsDraft] = useState<LocalRef[]>([])
  const [refsSaving, setRefsSaving] = useState(false)
  const [refsSavedFlash, setRefsSavedFlash] = useState(false)
  // Hidden graph-baseline refs (local-only until hide-override column exists)
  const [hiddenBaselineRefs, setHiddenBaselineRefs] = useState<string[]>([])

  // Slug input — visual only (no API call)
  const [slugDraft, setSlugDraft] = useState("")
  const [slugSaving] = useState(false)
  const [slugSavedFlash, setSlugSavedFlash] = useState(false)

  // Cherries (kaas.evidence) CRUD — same backend as Evidence tab, inline here
  const [addingCherry, setAddingCherry] = useState(false)
  const [editingCherryId, setEditingCherryId] = useState<string | null>(null)

  // Contributors (Knowledge Team) — 홈페이지 concept-reader의 Contributors 카드에 노출.
  const [contributorsDraft, setContributorsDraft] = useState<Contributor[]>([])
  const [contributorsSavedFlash, setContributorsSavedFlash] = useState(false)

  // Preview mode — renders using concept-reader style
  const [previewMode, setPreviewMode] = useState(false)

  // Mock 초기화 — API 호출 없음. 마운트 시 1회만.
  useEffect(() => {
    setConcepts(MOCK_CONCEPTS)
    setSelectedId((prev) => prev ?? MOCK_CONCEPTS[0]?.id ?? null)
    setLoading(false)
  }, [])

  const selected = concepts.find((c) => c.id === selectedId) ?? null

  // Sync overview draft when selection changes
  useEffect(() => {
    setOverviewDraft(selected?.contentMd ?? "")
    setOverviewMode("edit")
    setOverviewSavedFlash(false)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveOverview() {
    if (!selectedId) return
    // Mock: 로컬 state만 업데이트
    setConcepts((prev) => prev.map((c) => (c.id === selectedId ? { ...c, contentMd: overviewDraft } : c)))
    setOverviewSavedFlash(true)
    setTimeout(() => setOverviewSavedFlash(false), 2000)
  }

  // Mock publication 로드 — selection 바뀔 때마다 로컬 맵에서 읽기. API 호출 없음.
  useEffect(() => {
    if (!selectedId) {
      setPublicationState(null)
      setChildIds([])
      setRefsDraft([])
      setSlugDraft("")
      setContributorsDraft([])
      return
    }
    const pub = MOCK_PUBLICATIONS[selectedId] ?? {
      isPublished: false,
      publishedAt: null,
      slug: "",
      name: concepts.find((c) => c.id === selectedId)?.title ?? "",
      existsOnPublicPage: false,
      relatedConcepts: [],
      progressiveRefs: [],
    }
    setPublicationState(pub)
    setChildIds(pub.relatedConcepts ?? [])
    setRefsDraft(pub.progressiveRefs ?? [])
    setSlugDraft(pub.slug ?? "")
    setContributorsDraft(MOCK_CONTRIBUTORS[selectedId] ?? [])
    setChildPickerOpen(false)
    setChildPickerSearch("")
    setPublicationLoading(false)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slug Save — visual only, no API call
  function handleSaveSlug() {
    setSlugSavedFlash(true)
    setTimeout(() => setSlugSavedFlash(false), 2000)
  }

  function handleTogglePublish(nextPublished: boolean) {
    if (!selectedId) return
    // Mock: 로컬 publication state만 업데이트
    setPublicationState((prev) => {
      const base = prev ?? {
        isPublished: false,
        publishedAt: null,
        slug: slugDraft,
        name: concepts.find((c) => c.id === selectedId)?.title ?? "",
        existsOnPublicPage: false,
        relatedConcepts: childIds,
        progressiveRefs: refsDraft,
      }
      return {
        ...base,
        isPublished: nextPublished,
        publishedAt: nextPublished ? (base.publishedAt ?? new Date().toISOString()) : base.publishedAt,
        existsOnPublicPage: true,
      }
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  function handleSaveChildren() {
    if (!selectedId) return
    setPublicationState((prev) => (prev ? { ...prev, relatedConcepts: childIds } : prev))
    setChildSavedFlash(true)
    setTimeout(() => setChildSavedFlash(false), 2000)
  }

  function handleSaveRefs() {
    if (!selectedId) return
    setPublicationState((prev) => (prev ? { ...prev, progressiveRefs: refsDraft } : prev))
    setRefsSavedFlash(true)
    setTimeout(() => setRefsSavedFlash(false), 2000)
  }

  // Cherry CRUD — Mock: 로컬 concepts state만 업데이트. API 호출 없음.
  function handleAddCherry(data: { source: string; summary: string; curator: string; curator_tier: string; comment: string }) {
    if (!selectedId) return
    const newEv: AdminEvidence = {
      id: `ev-mock-${Date.now()}`,
      source: data.source,
      summary: data.summary,
      curator: data.curator,
      curatorTier: data.curator_tier,
      comment: data.comment,
    }
    setConcepts((prev) => prev.map((c) => (c.id === selectedId ? { ...c, evidence: [...(c.evidence ?? []), newEv], sourceCount: (c.sourceCount ?? 0) + 1 } : c)))
    setAddingCherry(false)
  }
  function handleUpdateCherry(evidenceId: string, data: { source: string; summary: string; curator: string; curator_tier: string; comment: string }) {
    if (!selectedId) return
    setConcepts((prev) => prev.map((c) => {
      if (c.id !== selectedId) return c
      return {
        ...c,
        evidence: (c.evidence ?? []).map((ev) => ev.id === evidenceId ? {
          ...ev,
          source: data.source,
          summary: data.summary,
          curator: data.curator,
          curatorTier: data.curator_tier,
          comment: data.comment,
        } : ev),
      }
    }))
    setEditingCherryId(null)
  }
  function handleDeleteCherry(evidenceId: string) {
    if (!selectedId) return
    if (!confirm("Delete this cherry? This cannot be undone.")) return
    setConcepts((prev) => prev.map((c) => {
      if (c.id !== selectedId) return c
      const nextEv = (c.evidence ?? []).filter((ev) => ev.id !== evidenceId)
      return { ...c, evidence: nextEv, sourceCount: Math.max(0, (c.sourceCount ?? 0) - 1) }
    }))
  }

  function toggleChild(id: string) {
    setChildIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function updateRef(idx: number, patch: Partial<LocalRef>) {
    setRefsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function removeRef(idx: number) {
    setRefsDraft((prev) => prev.filter((_, i) => i !== idx))
  }
  function moveRef(idx: number, dir: -1 | 1) {
    setRefsDraft((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  function addRef() {
    setRefsDraft((prev) => [...prev, { title: "", learn: "", adds: "" }])
  }

  // Contributors (Mock: 로컬 state만)
  function addContributor() {
    setContributorsDraft((prev) => [...prev, { id: `c-${Date.now()}`, initials: "", name: "", role: "" }])
  }
  function updateContributor(id: string, patch: Partial<Omit<Contributor, "id">>) {
    setContributorsDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  function removeContributor(id: string) {
    setContributorsDraft((prev) => prev.filter((c) => c.id !== id))
  }
  function handleSaveContributors() {
    // Mock: 실제 저장 없음, flash만
    setContributorsSavedFlash(true)
    setTimeout(() => setContributorsSavedFlash(false), 2000)
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
  }

  const CATEGORY_FILTERS = ["All", ...CATEGORY_OPTIONS] as const
  const nonDeleted = concepts.filter((c) => !c.revokedAt && c.isActive)
  const filtered = nonDeleted.filter((c) => {
    const matchCat = categoryFilter === "All" || c.category === categoryFilter
    const matchSearch = search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-5 overflow-hidden p-4 lg:p-5">
      {/* Left panel — concept list */}
      <div className="flex w-full lg:w-[300px] shrink-0 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden max-h-[40vh] lg:max-h-none">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Globe className="h-4 w-4 text-[#7B5EA7]" />
          <h3 className="text-[14px] font-bold text-[#1A1626]">Concept Pages</h3>
        </div>
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-[#E0E0E0] bg-[#FBFAF8] py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-[#888] focus:border-[#1A1626] focus:bg-white"
            />
          </div>
        </div>
        <div className="flex gap-1 px-3 pb-2 flex-wrap">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat as typeof categoryFilter)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors border",
                categoryFilter === cat
                  ? "bg-[#1A1626] text-white border-[#1A1626]"
                  : "border-[#E0E0E0] text-[#888] hover:border-[#999] hover:text-[#555]",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <BookOpen className="h-8 w-8 text-[#D4854A] mb-3 opacity-60" />
              <p className="text-[13px] font-semibold text-[#3D3652]">No concepts</p>
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "group w-full rounded-lg px-3 py-2 text-left transition-colors",
                selectedId === c.id ? "bg-[#FFF8F0]" : "hover:bg-[#FAFAFA]",
              )}
            >
              <p className={cn("text-[12.5px] font-semibold", selectedId === c.id ? "text-[#D4854A]" : "text-[#1A1626]")}>
                {c.title}
              </p>
              <p className="mt-0.5 text-[10px] text-[#888] truncate">{c.category} · {c.id.slice(0, 8)}…</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — publish controls + preview */}
      <div className="flex flex-1 flex-col rounded-xl border border-[#E0E0E0] bg-white overflow-hidden">
        {selected ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Status bar */}
            <div className="rounded-xl border border-[#E0E0E0] bg-[#FBFAF8] p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#7B5EA7]" />
                    <span className={labelCls}>Public Concept Page</span>
                    {publicationLoading && <Loader2 className="h-3 w-3 animate-spin text-[#888]" />}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {publication?.isPublished ? (
                      <span className="rounded-full bg-[#E8F4EC] px-2 py-0.5 text-[11px] font-semibold text-[#2D7A5E]">● Published</span>
                    ) : (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#888] border border-[#E0E0E0]">○ Not published</span>
                    )}
                    {publication?.publishedAt && (
                      <span className="text-[11px] text-[#888]">
                        first published: {new Date(publication.publishedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-[#888] mb-1">URL slug</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-[#888] font-mono">/concepts/</span>
                      <input
                        value={slugDraft}
                        onChange={(e) => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9가-힣-]/g, ""))}
                        placeholder="rag"
                        className={cn(inputBase, "flex-1 min-w-[180px] text-[12px] py-1 font-mono")}
                      />
                      <button
                        onClick={handleSaveSlug}
                        disabled={slugSaving || slugDraft.trim() === (publication?.slug ?? "") || !slugDraft.trim()}
                        className={cn(btnPrimary, "disabled:opacity-40 text-[11px] py-1 px-3")}
                      >
                        {slugSaving ? "Saving…" : "Save"}
                      </button>
                      {slugSavedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ saved</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewMode((v) => !v)}
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors border",
                        previewMode
                          ? "bg-[#1A1626] text-white border-[#1A1626]"
                          : "bg-white text-[#555] border-[#E0E0E0] hover:border-[#1A1626] hover:text-[#1A1626]",
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {previewMode ? "Exit Preview" : "Preview"}
                    </button>
                    {publication?.isPublished ? (
                      <button
                        onClick={() => handleTogglePublish(false)}
                        disabled={publishing}
                        className={cn(btnSecondary, "disabled:opacity-40")}
                      >
                        {publishing ? "Updating…" : "Unpublish"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTogglePublish(true)}
                        disabled={publishing}
                        className={cn(btnPrimary, "disabled:opacity-40")}
                      >
                        {publishing ? "Publishing…" : "Publish"}
                      </button>
                    )}
                  </div>
                  {savedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ changelog recorded</span>}
                </div>
              </div>
            </div>

            {/* Preview mode — mirrors public concept-reader-page layout */}
            {previewMode && (
              <div className="rounded-xl border border-[#E0E0E0] bg-white overflow-hidden">
                <div className="border-b border-[#F0F0F0] bg-[#FBFAF8] px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7B5EA7]">Preview — public concept page</span>
                  <span className="text-[10px] text-[#888]">
                    {publication?.isPublished ? "rendering published + current drafts" : "rendering drafts (not yet published)"}
                  </span>
                </div>
                <article className="px-6 lg:px-12 py-8 lg:py-10" style={{ maxWidth: "720px", margin: "0 auto" }}>
                  {/* Category badge */}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3EFFA] text-[#7B5EA7] mb-3">
                    {selected.category}
                  </span>

                  {/* Title */}
                  <h1 className="text-[22px] lg:text-[28px] font-extrabold text-[#1A1626] tracking-[-0.5px] leading-[1.2] mb-4">
                    {selected.title}
                  </h1>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#9E97B3] mb-8">
                    <span>Updated {selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString() : "—"}</span>
                    <span className="text-[#E4E1EE]">·</span>
                    <span>{selected.sourceCount ?? 0} sources</span>
                    <span className="text-[#E4E1EE]">·</span>
                    <span>Quality {selected.qualityScore ?? 0}/5</span>
                    {publication?.isPublished && (
                      <>
                        <span className="text-[#E4E1EE]">·</span>
                        <span className="text-[#2D7A5E] font-medium">Published</span>
                      </>
                    )}
                  </div>

                  {/* 01 — Overview */}
                  <section className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">01 — Overview</span>
                      <div className="flex-1 h-px bg-[#E4E1EE]" />
                    </div>
                    <div className="text-[14px] text-[#3D3652] leading-[1.75] whitespace-pre-wrap">
                      {(overviewDraft || selected.contentMd)?.trim() || <span className="italic text-[#9E97B3]">(empty — write overview in edit mode)</span>}
                    </div>
                  </section>

                  {/* 02 — Cherries */}
                  <section className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">02 — Cherries</span>
                      <div className="flex-1 h-px bg-[#E4E1EE]" />
                    </div>
                    {(selected.evidence ?? []).length === 0 ? (
                      <p className="text-[12px] italic text-[#9E97B3]">(no cherries yet)</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(selected.evidence ?? []).map((ev) => (
                          <div
                            key={ev.id}
                            className="bg-white border border-[#E4E1EE] rounded-[8px] p-4"
                            style={{ borderLeftWidth: "3px", borderLeftColor: "#C94B6E" }}
                          >
                            <p className="text-[12px] font-bold text-[#1A1626] mb-1.5 flex items-center gap-1.5">
                              <span>🍒</span>
                              {ev.source}
                            </p>
                            <p className="text-[12px] text-[#6B6480] leading-[1.6]">{ev.summary}</p>
                            {ev.comment && <p className="mt-1 text-[11px] italic text-[#9E97B3]">&ldquo;{ev.comment}&rdquo;</p>}
                            <p className="mt-1.5 text-[10px] text-[#9E97B3]">— {ev.curator} · {ev.curatorTier}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* 03 — Child Concepts : graph baseline (visible) + manually pinned */}
                  {(() => {
                    const visibleBaseline = MOCK_GRAPH_CHILDREN.filter((x) => !hiddenBaselineChildren.includes(x.id))
                    const totalCount = visibleBaseline.length + childIds.length
                    return (
                      <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">03 — Child Concepts</span>
                          <div className="flex-1 h-px bg-[#E4E1EE]" />
                        </div>
                        {totalCount === 0 ? (
                          <p className="text-[12px] italic text-[#9E97B3]">(no child concepts)</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {visibleBaseline.map((item) => (
                              <div key={item.id} className="bg-white border border-[#E4E1EE] rounded-[8px] p-3 transition-colors hover:border-[#C94B6E]">
                                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: item.color }}>{item.type}</span>
                                <p className="text-[13px] font-semibold text-[#1A1626] mt-0.5">{item.label}</p>
                                <p className="text-[11px] text-[#9E97B3] mt-0.5">{item.desc}</p>
                              </div>
                            ))}
                            {childIds.map((cid) => {
                              const child = concepts.find((c) => c.id === cid)
                              if (!child) {
                                return (
                                  <div key={cid} className="bg-[#FAFAFA] border border-[#E4E1EE] rounded-[8px] p-3 opacity-60">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#9E97B3]">ORPHANED</span>
                                    <p className="text-[13px] font-semibold text-[#9E97B3] mt-0.5">{cid.slice(0, 8)}…</p>
                                  </div>
                                )
                              }
                              return (
                                <div key={cid} className="bg-white border border-[#E4E1EE] rounded-[8px] p-3 transition-colors hover:border-[#C94B6E]">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B5EA7]">RELATED</span>
                                  <p className="text-[13px] font-semibold text-[#1A1626] mt-0.5">{child.title}</p>
                                  <p className="text-[11px] text-[#9E97B3] mt-0.5">{child.summary}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    )
                  })()}

                  {/* 04 — Progressive References : graph baseline (visible) + manually authored */}
                  {(() => {
                    const visibleGraphRefs = MOCK_GRAPH_REFS.filter((x) => !hiddenBaselineRefs.includes(x.id))
                    const totalCount = visibleGraphRefs.length + refsDraft.length
                    return (
                      <section className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">04 — Progressive References</span>
                          <div className="flex-1 h-px bg-[#E4E1EE]" />
                        </div>
                        {totalCount === 0 ? (
                          <p className="text-[12px] italic text-[#9E97B3]">(no references)</p>
                        ) : (
                          <div className="space-y-4">
                            {visibleGraphRefs.map((item, i) => {
                              const isFirst = i === 0
                              const borderColor = isFirst ? "#C94B6E" : "#E4E1EE"
                              return (
                                <div key={item.id} className="pl-4 relative" style={{ borderLeft: `2px solid ${borderColor}` }}>
                                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: borderColor }} />
                                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: item.labelColor }}>{item.label}</span>
                                  <p className="text-[13px] font-bold text-[#1A1626] mt-0.5">{item.title}</p>
                                  <p className="text-[12px] text-[#6B6480] leading-[1.5] mt-1">
                                    <strong className="text-[#3D3652]">What you&rsquo;ll learn:</strong> {item.learn}
                                  </p>
                                  <p className="text-[11px] italic text-[#7B5EA7] mt-1">Adds: {item.adds}</p>
                                </div>
                              )
                            })}
                            {refsDraft.map((ref, j) => {
                              const globalIdx = visibleGraphRefs.length + j
                              // ref.phase 선택값이 있으면 우선 사용, 없으면 인덱스 기반 폴백
                              const fallbackLabel: Phase = globalIdx === 0 ? "START HERE" : globalIdx === 1 ? "NEXT →" : globalIdx === 2 ? "THEN →" : "DEEP DIVE →"
                              const label: Phase = ref.phase ?? fallbackLabel
                              const color = PHASE_COLOR[label]
                              const borderColor = label === "START HERE" ? "#C94B6E" : "#E4E1EE"
                              const refConcept = ref.concept_id ? concepts.find((c) => c.id === ref.concept_id) : null
                              return (
                                <div key={`manual-${j}`} className="pl-4 relative" style={{ borderLeft: `2px solid ${borderColor}` }}>
                                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: borderColor }} />
                                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
                                  <p className="text-[13px] font-bold text-[#1A1626] mt-0.5">
                                    {ref.title || <em className="italic text-[#9E97B3]">(no title)</em>}
                                    {refConcept && <span className="ml-1 text-[10px] font-normal text-[#2D7A5E]">→ {refConcept.title}</span>}
                                    {ref.external && (
                                      <a href={ref.external} target="_blank" rel="noopener noreferrer" className="ml-1 text-[10px] font-normal text-[#7B5EA7] underline">
                                        link ↗
                                      </a>
                                    )}
                                  </p>
                                  {ref.learn && (
                                    <p className="text-[12px] text-[#6B6480] leading-[1.5] mt-1">
                                      <strong className="text-[#3D3652]">What you&rsquo;ll learn:</strong> {ref.learn}
                                    </p>
                                  )}
                                  {ref.adds && <p className="text-[11px] italic text-[#7B5EA7] mt-1">Adds: {ref.adds}</p>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    )
                  })()}

                  {/* 05 — Learning Roadmap (auto-drawn from Progressive References) */}
                  {(() => {
                    const PHASE_IDX: Record<Phase, number> = { "START HERE": 0, "NEXT →": 1, "THEN →": 2, "DEEP DIVE →": 3 }
                    const visibleBaseline = MOCK_GRAPH_REFS.filter((x) => !hiddenBaselineRefs.includes(x.id))
                    // baseline + manual을 합쳐 phase 순서로 정렬. manual은 phase 없으면 순서 fallback.
                    const baselineRows = visibleBaseline.map((b) => ({
                      phase: b.label as Phase,
                      title: b.title,
                      origin: "baseline" as const,
                    }))
                    const manualRows = refsDraft.map((r, i) => {
                      const fallback: Phase = i === 0 ? "START HERE" : i === 1 ? "NEXT →" : i === 2 ? "THEN →" : "DEEP DIVE →"
                      return {
                        phase: (r.phase ?? fallback) as Phase,
                        title: r.title || "(untitled)",
                        origin: "manual" as const,
                      }
                    })
                    const allRows = [...baselineRows, ...manualRows].sort((a, b) => PHASE_IDX[a.phase] - PHASE_IDX[b.phase])
                    return (
                      <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">05 — Learning Roadmap</span>
                          <div className="flex-1 h-px bg-[#E4E1EE]" />
                        </div>
                        <div className="bg-white border border-[#E4E1EE] rounded-[12px] p-5 max-w-[360px] mx-auto">
                          <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-4">
                            Learning Roadmap
                          </p>

                          {/* Current concept — 가장 위, cherry border */}
                          <div className="rounded-[8px] border-2 border-[#C94B6E] bg-white px-3 py-2 text-center">
                            <p className="text-[12px] font-bold text-[#C94B6E] truncate">{selected.title}</p>
                            <p className="text-[9px] text-[#9E97B3] mt-0.5">(you are here)</p>
                          </div>

                          {allRows.length === 0 ? (
                            <p className="mt-3 text-[11px] italic text-center text-[#9E97B3]">(no references — add in 04)</p>
                          ) : (
                            allRows.map((row, i) => (
                              <div key={i} className="flex flex-col items-center">
                                {/* Arrow */}
                                <div className="my-1 flex flex-col items-center">
                                  <div className="w-px h-3 bg-[#E4E1EE]" />
                                  <div className="text-[#E4E1EE] text-[10px] leading-none">▼</div>
                                </div>
                                {/* Phase label */}
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wide mb-1"
                                  style={{ color: PHASE_COLOR[row.phase] }}
                                >
                                  {row.phase}
                                </span>
                                {/* Box */}
                                <div
                                  className={cn(
                                    "w-full rounded-[6px] border px-3 py-1.5 text-center",
                                    row.phase === "START HERE"
                                      ? "border-[#C94B6E]/40 bg-[#FDF0F3]"
                                      : "border-[#E4E1EE] bg-[#F2F0F7]",
                                  )}
                                >
                                  <p className="text-[11px] font-medium text-[#3D3652] truncate" title={row.title}>
                                    {row.title}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}

                          {/* Legend */}
                          <div className="mt-5 space-y-1 text-[9px] text-[#9E97B3]">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-sm border-2 border-[#C94B6E] bg-white" />
                              <span>Cherry border = Current</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-sm border border-[#C94B6E]/40 bg-[#FDF0F3]" />
                              <span>Pink = Start here</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-sm border border-[#E4E1EE] bg-[#F2F0F7]" />
                              <span>Gray = Next steps</span>
                            </div>
                          </div>
                        </div>
                      </section>
                    )
                  })()}

                  {/* 06 — Knowledge Team (contributors card) */}
                  <section className="mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] whitespace-nowrap">06 — Knowledge Team</span>
                      <div className="flex-1 h-px bg-[#E4E1EE]" />
                    </div>
                    {contributorsDraft.length === 0 ? (
                      <p className="text-[12px] italic text-[#9E97B3]">(no contributors)</p>
                    ) : (
                      <div className="bg-white border border-[#E4E1EE] rounded-[12px] p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#9E97B3] mb-3">
                          Knowledge Team
                        </p>
                        <div className="space-y-2.5">
                          {contributorsDraft.slice(0, 3).map((contrib) => (
                            <div key={contrib.id} className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#F3EFFA] flex items-center justify-center text-[10px] font-bold text-[#6B6480]">
                                {contrib.initials || "?"}
                              </div>
                              <div>
                                <p className="text-[12px] font-medium text-[#1A1626]">{contrib.name || <em className="italic text-[#9E97B3]">(unnamed)</em>}</p>
                                <p className="text-[10px] text-[#9E97B3]">{contrib.role || <em className="italic">(no role)</em>}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {contributorsDraft.length > 3 && (
                          <a href="#" className="block mt-3 text-[11px] font-medium text-[#C94B6E] hover:underline">
                            + {contributorsDraft.length - 3} contributors
                          </a>
                        )}
                      </div>
                    )}
                  </section>
                </article>
              </div>
            )}

            {/* Edit mode — only when NOT previewing */}
            {!previewMode && (
            <div className="rounded-xl border border-[#E0E0E0] bg-white p-6">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[#FFF8F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#D4854A]">{selected.category}</span>
                <span className="text-[10px] text-[#888]">Preview</span>
              </div>
              <h2 className="text-[20px] font-bold text-[#1A1626]">{selected.title}</h2>
              <p className="mt-1 text-[12px] text-[#888]">
                updated {selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString() : "—"}
                {" · "}sources {selected.sourceCount ?? 0}
                {" · "}quality {selected.qualityScore ?? 0}/5
              </p>

              <section className="mt-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#7B5EA7]">01 — Overview</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 rounded-lg bg-[#FAFAFA] p-0.5">
                      <button
                        onClick={() => setOverviewMode("edit")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          overviewMode === "edit" ? "bg-white text-[#1A1626] shadow-sm" : "text-[#888] hover:text-[#333]",
                        )}
                      >
                        <Edit3 className="mr-1 inline h-3 w-3" />Edit
                      </button>
                      <button
                        onClick={() => setOverviewMode("preview")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          overviewMode === "preview" ? "bg-white text-[#1A1626] shadow-sm" : "text-[#888] hover:text-[#333]",
                        )}
                      >
                        <Eye className="mr-1 inline h-3 w-3" />Preview
                      </button>
                    </div>
                    <button
                      onClick={handleSaveOverview}
                      disabled={overviewSaving || overviewDraft === (selected.contentMd ?? "")}
                      className={cn(btnPrimary, "disabled:opacity-40 text-[11px] py-1 px-3")}
                    >
                      {overviewSaving ? "Saving…" : "Save"}
                    </button>
                    {overviewSavedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ saved</span>}
                  </div>
                </div>
                {overviewMode === "edit" ? (
                  <textarea
                    value={overviewDraft}
                    onChange={(e) => setOverviewDraft(e.target.value)}
                    rows={16}
                    className={cn(inputBase, "mt-2 resize-none font-mono text-[12px] leading-relaxed")}
                    placeholder="Write the public concept page overview in markdown. Saves to kaas.concept.content_md."
                  />
                ) : (
                  <div className="mt-2 rounded-lg bg-[#FBFAF8] p-4">
                    <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#333]">
                      {overviewDraft.trim() || "(empty)"}
                    </pre>
                  </div>
                )}
              </section>

              <section className="mt-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#D4854A]">
                    02 — Cherries
                    <span className="ml-2 text-[10px] font-normal text-[#888]">({(selected.evidence ?? []).length})</span>
                  </h3>
                  <span className="text-[10px] text-[#888] italic">Manually curated — also editable in Evidence tab</span>
                </div>

                <div className="mt-2 space-y-2">
                  {(selected.evidence ?? []).map((ev) => (
                    editingCherryId === ev.id ? (
                      <EvidenceForm
                        key={ev.id}
                        initial={ev}
                        onSave={(data) => handleUpdateCherry(ev.id, data)}
                        onCancel={() => setEditingCherryId(null)}
                      />
                    ) : (
                      <div key={ev.id} className="group rounded-lg border border-[#E0E0E0] bg-white p-3 transition-colors hover:border-[#CCC]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#1A1626] flex items-center gap-1">
                              <span>🍒</span>
                              {ev.source}
                            </p>
                            <p className="mt-1 text-[12px] leading-relaxed text-[#555]">{ev.summary}</p>
                            {ev.comment && <p className="mt-1 text-[11px] italic text-[#888]">&ldquo;{ev.comment}&rdquo;</p>}
                            <p className="mt-1 text-[10px] text-[#888]">— {ev.curator} · {ev.curatorTier}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => setEditingCherryId(ev.id)} className="rounded p-1 text-[#888] hover:bg-[#FAFAFA] hover:text-[#D4854A]" title="Edit cherry">
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleDeleteCherry(ev.id)} className="rounded p-1 text-[#888] hover:bg-red-50 hover:text-red-400" title="Delete cherry">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  ))}

                  {addingCherry ? (
                    <EvidenceForm
                      onSave={handleAddCherry}
                      onCancel={() => setAddingCherry(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingCherry(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#E0E0E0] py-2.5 text-[12px] text-[#888] transition-colors hover:border-[#D4854A] hover:text-[#D4854A]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add cherry
                    </button>
                  )}
                </div>
              </section>

              {/* 03 — Child Concepts : concept picker, stores IDs on content.concept_page.related_concepts */}
              <section className="mt-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#2D7A5E]">03 — Child Concepts</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveChildren}
                      disabled={childSaving || JSON.stringify(childIds) === JSON.stringify(publication?.relatedConcepts ?? [])}
                      className={cn(btnPrimary, "disabled:opacity-40 text-[11px] py-1 px-3")}
                    >
                      {childSaving ? "Saving…" : "Save"}
                    </button>
                    {childSavedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ saved</span>}
                  </div>
                </div>

                {/* Auto-suggested baseline from graph DB (mock until wired) */}
                <div className="mt-3 rounded-lg border border-dashed border-[#7B5EA7]/40 bg-[#FBFAFE] p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B5EA7]">🔗 Auto-suggested by ontology graph</span>
                    <span className="text-[10px] text-[#888]">
                      ({MOCK_GRAPH_CHILDREN.length - hiddenBaselineChildren.length}/{MOCK_GRAPH_CHILDREN.length})
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {MOCK_GRAPH_CHILDREN.map((item) => {
                      const hidden = hiddenBaselineChildren.includes(item.id)
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md border border-[#E4E1EE] bg-white p-2",
                            hidden && "opacity-40",
                          )}
                        >
                          <span
                            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: item.color }}
                          >
                            {item.type}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-semibold text-[#1A1A1A] truncate">{item.label}</div>
                            <div className="text-[10.5px] text-[#666] leading-tight">{item.desc}</div>
                          </div>
                          <button
                            onClick={() =>
                              setHiddenBaselineChildren((prev) =>
                                hidden ? prev.filter((x) => x !== item.id) : [...prev, item.id],
                              )
                            }
                            className="shrink-0 rounded p-1 text-[#888] hover:bg-[#FAFAFA] hover:text-[#C94B6E]"
                            title={hidden ? "Re-include" : "Hide"}
                          >
                            {hidden ? <Plus className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Manually pinned */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#2D7A5E]">📌 Manually pinned</span>
                    <span className="text-[10px] text-[#888]">({childIds.length})</span>
                  </div>
                  {childIds.length === 0 ? (
                    <p className="text-[11px] italic text-[#888]">None pinned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {childIds.map((cid) => {
                        const child = concepts.find((c) => c.id === cid)
                        return (
                          <span
                            key={cid}
                            className="flex items-center gap-1 rounded-full border border-[#2D7A5E]/30 bg-[#E8F4EC] px-2 py-0.5 text-[11px] text-[#2D7A5E]"
                          >
                            {child?.title ?? <em className="italic text-[#888]">{cid.slice(0, 8)}… (orphaned)</em>}
                            <button onClick={() => toggleChild(cid)} className="hover:text-red-500" title="Unpin">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Picker */}
                <div className="mt-3">
                  <button
                    onClick={() => setChildPickerOpen((v) => !v)}
                    className={cn(btnSecondary, "flex items-center gap-1")}
                  >
                    <Plus className="h-3 w-3" /> Pin a concept
                    <ChevronDown className={cn("h-3 w-3 transition-transform", childPickerOpen && "rotate-180")} />
                  </button>
                  {childPickerOpen && (
                    <div className="mt-2 rounded-lg border border-[#E0E0E0] bg-white p-2">
                      <input
                        value={childPickerSearch}
                        onChange={(e) => setChildPickerSearch(e.target.value)}
                        placeholder="Search concepts…"
                        className={cn(inputBase, "mb-2 text-[12px] py-1.5")}
                      />
                      <div className="max-h-48 overflow-y-auto">
                        {concepts
                          .filter((c) => c.id !== selectedId && c.isActive && !c.revokedAt)
                          .filter((c) => c.title.toLowerCase().includes(childPickerSearch.toLowerCase()))
                          .map((c) => {
                            const checked = childIds.includes(c.id)
                            return (
                              <label
                                key={c.id}
                                className={cn(
                                  "flex items-center gap-2 rounded px-2 py-1 text-[12px] cursor-pointer",
                                  checked ? "bg-[#E8F4EC]" : "hover:bg-[#FAFAFA]",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleChild(c.id)}
                                  className="accent-[#2D7A5E]"
                                />
                                <span className="flex-1 truncate">{c.title}</span>
                                <span className="text-[10px] text-[#888]">{c.category}</span>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 04 — Progressive References : progressive_refs JSONB editor */}
              <section className="mt-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#C94B6E]">04 — Progressive References</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveRefs}
                      disabled={refsSaving || JSON.stringify(refsDraft) === JSON.stringify(publication?.progressiveRefs ?? [])}
                      className={cn(btnPrimary, "disabled:opacity-40 text-[11px] py-1 px-3")}
                    >
                      {refsSaving ? "Saving…" : "Save"}
                    </button>
                    {refsSavedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ saved</span>}
                  </div>
                </div>

                {/* Auto-derived baseline from graph DB (mock until wired) */}
                <div className="mt-3 rounded-lg border border-dashed border-[#7B5EA7]/40 bg-[#FBFAFE] p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B5EA7]">🔗 Auto-derived from prerequisite chain</span>
                    <span className="text-[10px] text-[#888]">
                      ({MOCK_GRAPH_REFS.length - hiddenBaselineRefs.length}/{MOCK_GRAPH_REFS.length})
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {MOCK_GRAPH_REFS.map((item) => {
                      const hidden = hiddenBaselineRefs.includes(item.id)
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md border border-[#E4E1EE] bg-white p-2",
                            hidden && "opacity-40",
                          )}
                        >
                          <span
                            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: item.labelColor }}
                          >
                            {item.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-semibold text-[#1A1A1A] truncate">{item.title}</div>
                            <div className="text-[10.5px] text-[#666] leading-tight">{item.learn}</div>
                            <div className="mt-0.5 text-[10px] italic text-[#888]">adds: {item.adds}</div>
                          </div>
                          <button
                            onClick={() =>
                              setHiddenBaselineRefs((prev) =>
                                hidden ? prev.filter((x) => x !== item.id) : [...prev, item.id],
                              )
                            }
                            className="shrink-0 rounded p-1 text-[#888] hover:bg-[#FAFAFA] hover:text-[#C94B6E]"
                            title={hidden ? "Re-include" : "Hide"}
                          >
                            {hidden ? <Plus className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Manually authored */}
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#C94B6E]">📌 Manually authored</span>
                  <span className="text-[10px] text-[#888]">({refsDraft.length})</span>
                </div>

                {refsDraft.length === 0 && (
                  <p className="mt-1 text-[11px] italic text-[#888]">None authored yet.</p>
                )}

                <ul className="mt-2 space-y-2">
                  {refsDraft.map((ref, idx) => {
                    const refConcept = ref.concept_id ? concepts.find((c) => c.id === ref.concept_id) : null
                    return (
                      <li key={idx} className="rounded-lg border border-[#E0E0E0] bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold text-[#C94B6E]">#{idx + 1}</span>
                          <div className="flex gap-0.5">
                            <button onClick={() => moveRef(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-[#888] hover:bg-[#FAFAFA] disabled:opacity-30" title="Move up">↑</button>
                            <button onClick={() => moveRef(idx, 1)} disabled={idx === refsDraft.length - 1} className="rounded p-0.5 text-[#888] hover:bg-[#FAFAFA] disabled:opacity-30" title="Move down">↓</button>
                            <button onClick={() => removeRef(idx)} className="rounded p-0.5 text-[#888] hover:bg-red-50 hover:text-red-400" title="Remove">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className={labelCls}>Phase</label>
                          <select
                            value={ref.phase ?? ""}
                            onChange={(e) => updateRef(idx, { phase: (e.target.value || undefined) as Phase | undefined })}
                            className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                          >
                            <option value="">— auto (by order) —</option>
                            {PHASE_OPTIONS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Title</label>
                            <input
                              value={ref.title}
                              onChange={(e) => updateRef(idx, { title: e.target.value })}
                              placeholder="RAG"
                              className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Concept (optional)</label>
                            <select
                              value={ref.concept_id ?? ""}
                              onChange={(e) => updateRef(idx, { concept_id: e.target.value || undefined })}
                              className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                            >
                              <option value="">— none (external) —</option>
                              {concepts
                                .filter((c) => c.id !== selectedId && c.isActive && !c.revokedAt)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className={labelCls}>External URL (optional)</label>
                          <input
                            value={ref.external ?? ""}
                            onChange={(e) => updateRef(idx, { external: e.target.value || undefined })}
                            placeholder="https://…"
                            className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                            disabled={!!ref.concept_id}
                          />
                        </div>
                        <div className="mt-2">
                          <label className={labelCls}>Learn</label>
                          <input
                            value={ref.learn}
                            onChange={(e) => updateRef(idx, { learn: e.target.value })}
                            placeholder="what the reader gains from this step"
                            className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                          />
                        </div>
                        <div className="mt-2">
                          <label className={labelCls}>Adds (optional)</label>
                          <input
                            value={ref.adds ?? ""}
                            onChange={(e) => updateRef(idx, { adds: e.target.value || undefined })}
                            placeholder="what this specifically adds over prior steps"
                            className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                          />
                        </div>
                        {refConcept && (
                          <p className="mt-1 text-[10px] text-[#2D7A5E]">→ links to concept &ldquo;{refConcept.title}&rdquo;</p>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <button
                  onClick={addRef}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#E0E0E0] py-2 text-[12px] text-[#888] transition-colors hover:border-[#C94B6E] hover:text-[#C94B6E]"
                >
                  <Plus className="h-3 w-3" /> Add reference
                </button>
              </section>

              {/* 05 — Contributors (Knowledge Team) */}
              <section className="mt-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#7B5EA7]">
                    05 — Contributors
                    <span className="ml-2 text-[10px] font-normal text-[#888]">({contributorsDraft.length})</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveContributors}
                      className={cn(btnPrimary, "disabled:opacity-40 text-[11px] py-1 px-3")}
                    >
                      Save
                    </button>
                    {contributorsSavedFlash && <span className="text-[11px] text-[#2D7A5E] font-medium">✓ saved</span>}
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {contributorsDraft.map((contrib) => (
                    <li key={contrib.id} className="rounded-lg border border-[#E0E0E0] bg-white p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-[#F3EFFA] flex items-center justify-center text-[11px] font-bold text-[#6B6480]">
                          {contrib.initials || "?"}
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className={labelCls}>Initials</label>
                            <input
                              value={contrib.initials}
                              onChange={(e) => updateContributor(contrib.id, { initials: e.target.value.toUpperCase().slice(0, 3) })}
                              placeholder="KJ"
                              className={cn(inputBase, "mt-1 text-[12px] py-1.5 font-mono")}
                              maxLength={3}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Name</label>
                            <input
                              value={contrib.name}
                              onChange={(e) => updateContributor(contrib.id, { name: e.target.value })}
                              placeholder="Keanu J."
                              className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Role</label>
                            <input
                              value={contrib.role}
                              onChange={(e) => updateContributor(contrib.id, { role: e.target.value })}
                              placeholder="Lead reviewer"
                              className={cn(inputBase, "mt-1 text-[12px] py-1.5")}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeContributor(contrib.id)}
                          className="rounded p-1 text-[#888] hover:bg-red-50 hover:text-red-400"
                          title="Remove contributor"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={addContributor}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#E0E0E0] py-2 text-[12px] text-[#888] transition-colors hover:border-[#7B5EA7] hover:text-[#7B5EA7]"
                >
                  <Plus className="h-3 w-3" /> Add contributor
                </button>
              </section>
            </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-8">
            <Globe className="h-10 w-10 text-[#7B5EA7] opacity-40 mb-3" />
            <h3 className="text-[15px] font-bold text-[#1A1626] mb-2">Pick a concept to publish</h3>
            <p className="text-[12px] text-[#888] leading-relaxed max-w-xs">
              Choose from the list on the left to preview its public concept page and toggle publication.
            </p>
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
  const [topTab, setTopTab] = useState<"curation" | "concept-page" | "template">("curation")

  const topTabs = [
    { key: "curation" as const, label: "Knowledge Curation" },
    { key: "concept-page" as const, label: "Concept Page" },
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
        {topTab === "concept-page" && <ConceptPagePublishPanel />}
        {topTab === "template" && <TemplateEditorBody />}
      </div>
    </div>
  )
}
