"use client"

/**
 * Workshop — Agent Execution Flow (hero) + paginated Inventory
 *
 * Layout (no internal scroll — everything fits in the modal):
 *
 *   ┌─ LEFT: Flow (visual hero) ──────┐┌─ RIGHT: Inventory (paged) ──┐
 *   │  ① System Prompt                 ││  Filters  [All][Prompt]...  │
 *   │     ↓                            ││                             │
 *   │  ② MCP Tools                     ││  2 × 3 card grid            │
 *   │     ↓                            ││                             │
 *   │  ③ [Skill A][Skill B][Skill C]   ││                             │
 *   │     ↓ ↓ ↓                        ││  < Page 1 / 3 >             │
 *   │  ④ Orchestration                 │└─────────────────────────────┘
 *   │     ↓                            │
 *   │  ⑤ Memory                        │
 *   │                                  │
 *   │  [Toggle] Register to market     │
 *   └──────────────────────────────────┘
 *
 * Foundation Model is intentionally NOT shown here (user scope decision).
 */

import { useEffect, useMemo, useState } from "react"
import {
  SKILL_TYPE_ORDER,
  SLOT_META,
  WORKSHOP_STORAGE_KEY,
  defaultWorkshopState,
  type AgentBuild,
  type InventoryItem,
  type SkillType,
  type SlotKey,
  type SlotConfig,
  type WorkshopState,
} from "@/lib/workshop-mock"

interface KaasWorkshopPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentAgent?: any
  currentAgentApiKey?: string
}

type FilterKey = "all" | SkillType

const ITEMS_PER_PAGE = 10 // 2 cols × 5 rows — fills visible area

// Per-type color theme
const TYPE_THEME: Record<SkillType, { bg: string; border: string; text: string; badge: string; label: string; dark: string }> = {
  prompt:        { bg: "#F5EDE1", border: "#C9A24A", text: "#8B6C2A", badge: "#FDF8E9", label: "PROMPT", dark: "#C9A24A" },
  mcp:           { bg: "#E3F2EC", border: "#2A5C3E", text: "#1F4430", badge: "#D5EBDC", label: "MCP",    dark: "#2A5C3E" },
  skill:         { bg: "#FBF6EC", border: "#C8301E", text: "#8F1D12", badge: "#FBE8E3", label: "SKILL",  dark: "#C8301E" },
  orchestration: { bg: "#EEF0F7", border: "#4A5FA0", text: "#2D3B66", badge: "#DDE3F0", label: "ORCH",   dark: "#4A5FA0" },
  memory:        { bg: "#EDE5F5", border: "#7B5EA7", text: "#5E3A8A", badge: "#DCD0EC", label: "MEM",    dark: "#7B5EA7" },
}

// All step badges share a single neutral color — color only appears on equipped items
const STEP_BADGE_COLOR = "#1A1626"

export function KaasWorkshopPanel({ currentAgent }: KaasWorkshopPanelProps) {
  const [state, setState] = useState<WorkshopState>(defaultWorkshopState)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropRejectedSlot, setDropRejectedSlot] = useState<SlotKey | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [page, setPage] = useState(0)

  // Custom item upload form state
  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState("")
  const [addType, setAddType] = useState<SkillType>("prompt")
  const [addCategory, setAddCategory] = useState("")
  const [addSummary, setAddSummary] = useState("")
  const [addContent, setAddContent] = useState("")
  const [addFileName, setAddFileName] = useState<string | null>(null)

  function resetAddForm() {
    setAddOpen(false)
    setAddTitle("")
    setAddType("prompt")
    setAddCategory("")
    setAddSummary("")
    setAddContent("")
    setAddFileName(null)
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setAddFileName(f.name)
    if (!addTitle) setAddTitle(f.name.replace(/\.[^.]+$/, ""))
    try {
      const text = await f.text()
      setAddContent(text)
      if (!addSummary) setAddSummary(text.slice(0, 140).replace(/\s+/g, " ").trim())
    } catch { /* ignore */ }
  }

  function saveCustomItem() {
    const title = addTitle.trim()
    if (!title) return
    const newItem: InventoryItem = {
      id: `custom-${Date.now()}`,
      title,
      type: addType,
      category: addCategory.trim() || "Custom",
      updatedAt: new Date().toISOString().slice(0, 10),
      source: "custom",
      summary: addSummary.trim() || undefined,
      fileName: addFileName ?? undefined,
      content: addContent || undefined,
    }
    setState((s) => ({ ...s, inventory: [newItem, ...s.inventory] }))
    resetAddForm()
  }

  // Restore from localStorage + migrate any older build rows that are missing
  // `isListedOnMarket` (added later to AgentBuild).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSHOP_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<WorkshopState>
      const merged: WorkshopState = { ...defaultWorkshopState, ...parsed }
      merged.builds = (merged.builds ?? defaultWorkshopState.builds).map((b) => ({
        ...b,
        isListedOnMarket: b.isListedOnMarket ?? false,
      }))
      setState(merged)
    } catch { /* ignore */ }
  }, [])

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  // Reset pagination when filter changes
  useEffect(() => { setPage(0) }, [filter])

  // ── Build (preset) helpers ──
  const activeBuild = useMemo<AgentBuild>(() => {
    return state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0]
  }, [state.builds, state.activeBuildId])

  function updateActiveBuild(patch: (b: AgentBuild) => AgentBuild) {
    setState((s) => ({
      ...s,
      builds: s.builds.map((b) => (b.id === s.activeBuildId ? patch(b) : b)),
    }))
  }
  function setActiveBuildId(id: string) {
    setState((s) => ({ ...s, activeBuildId: id }))
  }
  function renameActiveBuild(name: string) {
    updateActiveBuild((b) => ({ ...b, name }))
  }

  // Equip with slot-type validation (writes to active build only)
  function equip(slot: SlotKey, itemId: string) {
    const item = state.inventory.find((i) => i.id === itemId)
    if (!item) return
    if (!SLOT_META[slot].accept.includes(item.type)) {
      setDropRejectedSlot(slot)
      setTimeout(() => setDropRejectedSlot(null), 600)
      return
    }
    updateActiveBuild((b) => ({ ...b, equipped: { ...b.equipped, [slot]: itemId } }))
  }
  function unequip(slot: SlotKey) {
    updateActiveBuild((b) => ({ ...b, equipped: { ...b.equipped, [slot]: null } }))
  }
  function toggleListing() {
    updateActiveBuild((b) => ({ ...b, isListedOnMarket: !b.isListedOnMarket }))
  }

  // Debug toggles (mock demo only)
  function toggleFollowing() { setState((s) => ({ ...s, isFollowingAny: !s.isFollowingAny })) }
  function toggleCloneFlag() { setState((s) => ({ ...s, cloneSimilarity: (s.cloneSimilarity ?? 0) >= 0.8 ? 0 : 0.9 })) }

  // Exclude items currently equipped in the ACTIVE build (items can be reused
  // across builds — each build has its own equipped state).
  const availableInventory = useMemo(() => {
    const equippedIds = new Set(Object.values(activeBuild.equipped).filter(Boolean) as string[])
    return state.inventory.filter((i) => !equippedIds.has(i.id))
  }, [state.inventory, activeBuild.equipped])

  const filteredInventory = useMemo(
    () => (filter === "all" ? availableInventory : availableInventory.filter((i) => i.type === filter)),
    [availableInventory, filter],
  )

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const pagedInventory = filteredInventory.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  )

  const listingDisabled = state.isFollowingAny || (state.cloneSimilarity ?? 0) >= 0.8
  const listingDisabledReason = state.isFollowingAny
    ? "Cannot register while following other agents"
    : (state.cloneSimilarity ?? 0) >= 0.8
      ? "Cannot register a clone of a followed agent"
      : ""

  function itemById(id: string | null): InventoryItem | null {
    if (!id) return null
    return state.inventory.find((i) => i.id === id) ?? null
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 p-5 lg:p-6 h-full overflow-hidden bg-gradient-to-br from-[#F5EDE1]/30 via-white to-[#EEF0F7]/30">
      {/* ═════════════ LEFT: Flow (hero) ═════════════ */}
      <section className="w-full lg:w-[540px] flex-shrink-0 flex flex-col min-h-0">
        {/* Flow hero container — emphasized frame */}
        <div
          className="flex-1 rounded-2xl border-2 border-[#1A1626] bg-white relative overflow-y-auto flex flex-col"
          style={{ boxShadow: "0 2px 0 rgba(26,22,38,0.10), 0 12px 32px rgba(26,22,38,0.08)" }}
        >
          {/* Build tabs — span the top of the frame */}
          <BuildTabs
            builds={state.builds}
            activeBuildId={state.activeBuildId}
            onSelect={setActiveBuildId}
            onRename={renameActiveBuild}
          />

          <div className="p-5 pt-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[22px] leading-none">🔀</span>
              <h3 className="text-[15px] font-black text-[#1A1626] leading-tight">
                Agent Execution Flow
              </h3>
            </div>

          {/* ① Prompt — single slot, narrow centered */}
          <div className="max-w-[70%] mx-auto">
            <HeroFlowSlot
              stepNumber={1}
              slotKey="prompt"
              config={SLOT_META.prompt}
              item={itemById(activeBuild.equipped.prompt)}
              isRejected={dropRejectedSlot === "prompt"}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedId) equip("prompt", draggedId); setDraggedId(null) }}
              onUnequip={() => unequip("prompt")}
            />
          </div>
          <FlowConnector />

          {/* ② MCP — single slot, narrow centered */}
          <div className="max-w-[70%] mx-auto">
            <HeroFlowSlot
              stepNumber={2}
              slotKey="mcp"
              config={SLOT_META.mcp}
              item={itemById(activeBuild.equipped.mcp)}
              isRejected={dropRejectedSlot === "mcp"}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedId) equip("mcp", draggedId); setDraggedId(null) }}
              onUnequip={() => unequip("mcp")}
            />
          </div>
          <FlowConnector />

          {/* ③ Skills × 3 parallel */}
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-2">
              <StepBadge n={3} />
              <span className="text-[11px] uppercase font-black tracking-[0.8px] text-[#1A1626]">
                Skills
              </span>
              <span className="text-[9px] font-bold text-[#6B6480] uppercase tracking-[1px] px-1.5 py-0.5 rounded bg-gray-100 border border-[#E4E1EE]">
                3 parallel
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["skillA", "skillB", "skillC"] as SlotKey[]).map((sk) => (
                <HeroFlowSlot
                  key={sk}
                  stepNumber={3}
                  slotKey={sk}
                  config={SLOT_META[sk]}
                  item={itemById(activeBuild.equipped[sk])}
                  isRejected={dropRejectedSlot === sk}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (draggedId) equip(sk, draggedId); setDraggedId(null) }}
                  onUnequip={() => unequip(sk)}
                  compact
                  hideStepLabel
                />
              ))}
            </div>
          </div>
          <FlowConnector triple />

          {/* ④ Orchestration — single slot, narrow centered */}
          <div className="max-w-[70%] mx-auto">
            <HeroFlowSlot
              stepNumber={4}
              slotKey="orchestration"
              config={SLOT_META.orchestration}
              item={itemById(activeBuild.equipped.orchestration)}
              isRejected={dropRejectedSlot === "orchestration"}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedId) equip("orchestration", draggedId); setDraggedId(null) }}
              onUnequip={() => unequip("orchestration")}
            />
          </div>
          <FlowConnector />

          {/* ⑤ Memory — single slot, narrow centered */}
          <div className="max-w-[70%] mx-auto">
            <HeroFlowSlot
              stepNumber={5}
              slotKey="memory"
              config={SLOT_META.memory}
              item={itemById(activeBuild.equipped.memory)}
              isRejected={dropRejectedSlot === "memory"}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedId) equip("memory", draggedId); setDraggedId(null) }}
              onUnequip={() => unequip("memory")}
            />
          </div>

          {/* Register toggle — lives INSIDE the flow container so it naturally
              follows the active build (switching tabs swaps the toggle state). */}
          <div className="mt-5 pt-4 border-t border-[#E4E1EE] flex items-center gap-3">
            <button
              onClick={toggleListing}
              disabled={listingDisabled}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                listingDisabled
                  ? "bg-gray-200 cursor-not-allowed"
                  : activeBuild.isListedOnMarket
                    ? "bg-[#2A5C3E]"
                    : "bg-gray-300"
              }`}
              title={listingDisabledReason}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  activeBuild.isListedOnMarket ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-[12px] font-bold ${listingDisabled ? "text-[#9E97B3]" : "text-[#1A1626]"}`}>
                Register <span className="font-extrabold">{activeBuild.name}</span> to Special Agents
              </div>
              <div className="text-[10px] text-[#6B6480] truncate">
                {listingDisabled
                  ? listingDisabledReason
                  : activeBuild.isListedOnMarket
                    ? `${activeBuild.name} listed on marketplace`
                    : "Each build can be registered independently"}
              </div>
            </div>
            <details className="text-[10px] text-[#9E97B3]">
              <summary className="cursor-pointer hover:text-[#6B6480]">debug</summary>
              <div className="mt-1 flex gap-1 flex-wrap">
                <button onClick={toggleFollowing} className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 hover:bg-gray-200 text-[9px]">
                  follow: {String(state.isFollowingAny)}
                </button>
                <button onClick={toggleCloneFlag} className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 hover:bg-gray-200 text-[9px]">
                  clone: {state.cloneSimilarity ?? 0}
                </button>
              </div>
            </details>
          </div>
          </div>
        </div>
      </section>

      {/* ═════════════ RIGHT: Inventory (paginated) ═════════════ */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 rounded-2xl border border-[#E4E1EE] bg-white p-5 shadow-sm flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <span className="text-[20px]">🎒</span>
            <h3 className="text-[15px] font-black text-[#1A1626]">Inventory</h3>
            <span className="text-[11px] text-[#9E97B3]">
              {filteredInventory.length} item{filteredInventory.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setAddOpen((o) => !o)}
              className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors ${
                addOpen
                  ? "border-[#1A1626] bg-[#1A1626] text-white"
                  : "border-[#E4E1EE] text-[#1A1626] bg-white hover:bg-gray-50"
              }`}
            >
              {addOpen ? "Cancel" : "+ Add Custom"}
            </button>
          </div>

          {/* Add Custom form */}
          {addOpen && (
            <div className="mb-4 flex-shrink-0 rounded-lg border border-[#E4E1EE] bg-gray-50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B6480] mb-1">Title *</label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="e.g., My RAG tuning notes"
                    className="w-full text-[12px] px-2 py-1.5 rounded border border-[#E4E1EE] bg-white focus:outline-none focus:border-[#C8301E]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B6480] mb-1">Type</label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as SkillType)}
                    className="w-full text-[12px] px-2 py-1.5 rounded border border-[#E4E1EE] bg-white focus:outline-none focus:border-[#C8301E]"
                  >
                    {SKILL_TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>{TYPE_THEME[t].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B6480] mb-1">Category</label>
                <input
                  type="text"
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  placeholder="e.g., RAG, Reasoning, Tools"
                  className="w-full text-[12px] px-2 py-1.5 rounded border border-[#E4E1EE] bg-white focus:outline-none focus:border-[#C8301E]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B6480] mb-1">
                  Upload File <span className="text-[#9E97B3] font-normal normal-case">(.md / .json / .txt — optional)</span>
                </label>
                <input
                  type="file"
                  accept=".md,.json,.txt,.yaml,.yml,text/*,application/json"
                  onChange={handleFilePick}
                  className="block w-full text-[11px] text-[#1A1626] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-[#E4E1EE] file:bg-white file:text-[11px] file:font-semibold file:cursor-pointer hover:file:bg-gray-50"
                />
                {addFileName && (
                  <div className="text-[10px] text-[#6B6480] mt-1">📎 {addFileName}</div>
                )}
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B6480] mb-1">
                  Summary <span className="text-[#9E97B3] font-normal normal-case">(one line, auto-filled from file)</span>
                </label>
                <input
                  type="text"
                  value={addSummary}
                  onChange={(e) => setAddSummary(e.target.value)}
                  placeholder="Short description shown on the card"
                  className="w-full text-[12px] px-2 py-1.5 rounded border border-[#E4E1EE] bg-white focus:outline-none focus:border-[#C8301E]"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveCustomItem}
                  disabled={!addTitle.trim()}
                  className="flex-1 text-[12px] font-semibold px-3 py-1.5 rounded bg-[#1A1626] text-white hover:bg-[#2A1F42] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add to Inventory
                </button>
                <button
                  onClick={resetAddForm}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded border border-[#E4E1EE] bg-white text-[#6B6480] hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filter buttons */}
          <div className="flex gap-1 mb-4 flex-wrap flex-shrink-0">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterButton>
            {SKILL_TYPE_ORDER.map((t) => (
              <FilterButton key={t} active={filter === t} onClick={() => setFilter(t)} type={t}>
                {TYPE_THEME[t].label}
              </FilterButton>
            ))}
          </div>

          {/* Grid (2×3 = 6 items per page) */}
          <div className="flex-1 min-h-0">
            {pagedInventory.length === 0 ? (
              <div className="text-[12px] italic text-[#9E97B3] py-12 text-center">
                {availableInventory.length === 0
                  ? "All items equipped"
                  : "No matches for this filter"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 content-start">
                {pagedInventory.map((item) => (
                  <InventoryCard
                    key={item.id}
                    item={item}
                    onDragStart={() => setDraggedId(item.id)}
                    onDragEnd={() => setDraggedId(null)}
                    isDragging={draggedId === item.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 flex-shrink-0 pt-3 border-t border-[#E4E1EE]">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1.5 text-[11px] font-semibold rounded border border-[#E4E1EE] bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 text-[11px] font-bold rounded transition-colors ${
                      i === currentPage
                        ? "bg-[#1A1626] text-white"
                        : "bg-white text-[#6B6480] border border-[#E4E1EE] hover:bg-gray-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1.5 text-[11px] font-semibold rounded border border-[#E4E1EE] bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          <p className="mt-3 text-[10px] text-[#9E97B3] flex-shrink-0">
            💡 Drag items onto matching slots on the left.
          </p>
        </div>
      </section>
    </div>
  )
}

/* ═════════════════════════════════════
   Sub-components
   ═════════════════════════════════════ */

interface HeroFlowSlotProps {
  stepNumber: number
  slotKey: SlotKey
  config: SlotConfig
  item: InventoryItem | null
  isRejected: boolean
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onUnequip: () => void
  compact?: boolean
  hideStepLabel?: boolean
}

function HeroFlowSlot({
  stepNumber, slotKey, config, item, isRejected,
  onDragOver, onDrop, onUnequip, compact, hideStepLabel,
}: HeroFlowSlotProps) {
  const theme = item ? TYPE_THEME[item.type] : null
  void slotKey // eslint: slotKey kept in props for future use

  return (
    <div className={compact ? "" : "mb-1"}>
      {!hideStepLabel && (
        <div className="flex items-center gap-2 mb-1.5">
          <StepBadge n={stepNumber} />
          <span className="text-[11px] uppercase font-black tracking-[0.8px] text-[#1A1626]">
            {config.label}
          </span>
        </div>
      )}
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`group rounded-xl border-2 transition-all ${compact ? "p-2 min-h-[68px]" : "p-3 min-h-[68px]"} ${
          isRejected
            ? "border-[#C8301E] bg-[#FBE8E3] animate-pulse"
            : item && theme
              ? "shadow-sm"
              : "border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400 hover:bg-gray-50"
        }`}
        style={item && theme ? { backgroundColor: theme.bg, borderColor: theme.border } : undefined}
        title={config.hint}
      >
        {item && theme ? (
          <div className="flex items-start justify-between gap-2 h-full">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[13px]">{config.icon}</span>
                <span className={`${compact ? "text-[11px]" : "text-[13px]"} font-black truncate`} style={{ color: theme.text }}>
                  {item.title}
                </span>
              </div>
              <div className="text-[9px] text-[#6B6480] truncate pl-5">{item.category}</div>
            </div>
            <button
              onClick={onUnequip}
              className="opacity-40 hover:opacity-100 text-[#6B6480] hover:text-[#C8301E] text-sm leading-none flex-shrink-0 mt-0.5"
              aria-label={`Unequip ${config.label}`}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 h-full">
            <span className="text-[16px] opacity-30">{config.icon}</span>
            <div className="min-w-0 flex-1">
              {hideStepLabel && (
                <div className="text-[9px] uppercase font-black tracking-[0.8px] text-[#9E97B3] leading-tight">
                  {config.label}
                </div>
              )}
              <div className={`${compact ? "text-[10px]" : "text-[11px]"} italic text-[#9E97B3] truncate leading-tight`}>
                {config.emptyLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FlowConnector({ triple }: { triple?: boolean }) {
  if (triple) {
    return (
      <div className="flex justify-center py-1.5">
        <div className="flex gap-10 text-[#C9A24A] text-[16px] leading-none font-bold">
          <span>↓</span>
          <span>↓</span>
          <span>↓</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-center py-1.5">
      <span className="text-[#C9A24A] text-[16px] leading-none font-bold">↓</span>
    </div>
  )
}

function StepBadge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-black flex-shrink-0 shadow-sm"
      style={{ backgroundColor: STEP_BADGE_COLOR }}
    >
      {n}
    </span>
  )
}

// Subtle per-build accent colors (text + underline only; no background fill)
const BUILD_ACCENTS: { border: string; text: string }[] = [
  { border: "#C94B6E", text: "#8F2B4D" }, // Build 1 — cherry
  { border: "#C9A24A", text: "#8B6C2A" }, // Build 2 — gold
  { border: "#7B5EA7", text: "#5E3A8A" }, // Build 3 — purple
]

function BuildTabs({
  builds, activeBuildId, onSelect, onRename,
}: {
  builds: AgentBuild[]
  activeBuildId: string
  onSelect: (id: string) => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const equippedCount = (b: AgentBuild) => Object.values(b.equipped).filter(Boolean).length

  function commitEdit() {
    const name = draft.trim()
    if (name) onRename(name)
    setEditing(false)
  }

  return (
    <div className="flex items-end gap-0 border-b border-[#E4E1EE] px-4 pt-3">
      {builds.map((b, i) => {
        const active = b.id === activeBuildId
        const count = equippedCount(b)
        const accent = BUILD_ACCENTS[i % BUILD_ACCENTS.length]
        return (
          <button
            key={b.id}
            onClick={() => {
              if (active) {
                setDraft(b.name)
                setEditing(true)
              } else {
                setEditing(false)
                onSelect(b.id)
              }
            }}
            className={`px-4 py-2 text-[12px] font-bold transition-colors border-b-2 -mb-px ${
              active ? "" : "border-transparent text-[#9E97B3] hover:text-[#6B6480]"
            }`}
            style={active ? { borderColor: accent.border, color: accent.text } : undefined}
            title={active ? "Click to rename" : `Switch to ${b.name}`}
          >
            {active && editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit()
                  if (e.key === "Escape") setEditing(false)
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none border-b w-28 text-[12px] font-bold"
                style={{ borderColor: accent.border, color: accent.text }}
              />
            ) : (
              <>
                <span>{b.name}</span>
                <span
                  className={`ml-1.5 text-[10px] font-bold ${active ? "" : "text-[#C7BDDB]"}`}
                  style={active ? { color: accent.text, opacity: 0.7 } : undefined}
                >
                  {count}/7
                </span>
                {b.isListedOnMarket && (
                  <span
                    className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
                    style={{ backgroundColor: "#2A5C3E" }}
                    title="Listed on marketplace"
                  />
                )}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

function FilterButton({
  children, active, onClick, type,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  type?: SkillType
}) {
  const theme = type ? TYPE_THEME[type] : null
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.5px] rounded transition-colors border ${
        active
          ? theme
            ? "text-white"
            : "bg-[#1A1626] text-white border-[#1A1626]"
          : "bg-white text-[#6B6480] border-[#E4E1EE] hover:bg-gray-50"
      }`}
      style={active && theme ? { backgroundColor: theme.border, borderColor: theme.border } : undefined}
    >
      {children}
    </button>
  )
}

function InventoryCard({
  item, onDragStart, onDragEnd, isDragging,
}: {
  item: InventoryItem
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const theme = TYPE_THEME[item.type]
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative border rounded-lg p-3 bg-white cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-50 scale-95" : "hover:shadow-md"
      }`}
      style={{ borderLeftWidth: "4px", borderLeftColor: theme.border }}
      title={item.summary ?? `${item.title} · ${item.category}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[#1A1626] truncate">{item.title}</div>
          <div className="text-[10px] text-[#9E97B3] mt-0.5 truncate">
            {item.category} · {item.updatedAt}
          </div>
          {item.summary && (
            <div className="text-[10px] text-[#6B6480] mt-1 line-clamp-2">{item.summary}</div>
          )}
        </div>
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-[0.5px] flex-shrink-0 uppercase"
          style={{ backgroundColor: theme.badge, color: theme.text }}
        >
          {theme.label}
        </span>
      </div>
      {item.source === "followed" && item.sourceAgent && (
        <div className="mt-1.5 text-[9px] font-bold text-[#8F1D12]">
          ▸ via @{item.sourceAgent}
        </div>
      )}
      {item.source === "builtin" && (
        <div className="mt-1.5 text-[9px] font-bold text-[#6B6480]">
          ▸ built-in
        </div>
      )}
      {item.source === "custom" && (
        <div className="mt-1.5 text-[9px] font-bold text-[#C94B6E]">
          ▸ custom{item.fileName ? ` · ${item.fileName}` : ""}
        </div>
      )}
    </div>
  )
}
