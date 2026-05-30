# Cherry Arena / Workshop / Special Agent Follow — 진행 검수서

**기준 문서:** PRD Addendum (`apps/docs/arena/planning-artifacts/prd.md` FR37~58) / Epics Addendum (Epic 8/9/10) / Architecture Addendum
**시작일:** 2026-04-23
**원칙:** 이 문서만 읽고 따라해도 Phase 2 구현이 완성되도록 작성.

---

## 담당 범례
- **사용자** = 사람이 직접 해야 함 (UI 확인, 지갑 서명, 크로스머신 실행, 승인)
- **AI** = Claude 가 코드 작성/실행 가능 (수정은 허락 후)
- **사용자+AI** = 사용자가 정보 제공 → AI 반영

---

# Day 0 — 사전 확인 (1시간)

> Day 1 이전에 반드시 완료. 기존 인프라가 살아있어야 Day 1 부터 막힘 없이 진행.

## STEP 0-1: 현재 레포 상태 확인 `AI`

```bash
cd /path/to/cherry-in-the-haystack
git status                # 미커밋 워킹트리 확인
git log --oneline -5      # 최근 커밋 확인
```

**기대**: `5549e68 feature: a2a` 가 히스토리에 존재. 미커밋 변경이 있으면 사용자와 상의.

## STEP 0-2: 배포 API 접근 확인 `AI`

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.solteti.site/api/v1/kaas/a2a/agents
# 기대: 200
```

실패 시 dokploy 서버 상태 확인 요청.

## STEP 0-3: DB 접근 확인 `AI`

```bash
lsof -i :15432 | grep LISTEN
# 기대: ssh 프로세스 LISTEN 중
```

SSH 터널이 없으면 사용자에게 터널 실행 요청. 직접 PGPASSWORD 로 조회 테스트 (가능한 환경이면):
```sql
SELECT schemaname, tablename FROM pg_tables WHERE schemaname='kaas' ORDER BY tablename;
-- 기대: agent, agent_task, concept, curator_reward, evidence, query_log (최소 6개)
```

## STEP 0-4: A2A 동작 확인 `AI`

```bash
# 에이전트 목록 조회 (인증 불필요)
curl -s https://api.solteti.site/api/v1/kaas/a2a/agents | python3 -m json.tool | head -10
```

**기대**: `claude_test_for_a2a`, `claude_linux_test` 가 배열에 포함.

## STEP 0-5: 테스트 계정 정보 확보 `사용자`

- **Mac (claude_test_for_a2a)** id: `8191c6e1-e9c1-4bbb-ab69-51e035fd2df5`
- **Linux (claude_linux_test)** id: `f2dc68eb-6844-4e58-ad16-9998e7ab2383`
- api_key 는 대시보드에서 확인 → AI 에게 전달 (환경변수로만 관리, 파일 저장 금지)

## STEP 0-6: 프론트 로컬 실행 확인 `AI`

```bash
cd apps/web
pnpm dev
# 기대: localhost:3000 에 기존 사이트 정상 렌더
```

## STEP 0-7: 현 Dashboard 모달 구조 파악 `AI`

```bash
grep -n "activeTab\|TabButton\|dashboardTab" apps/web/components/cherry/kaas-dashboard-page.tsx | head -20
```

기존 탭 구조(Dashboard / Knowledge Curation / Concept Page / Prompt Templates)를 확인하고, **Workshop 탭 추가 지점을 미리 식별**.

## Day 0 검증 체크리스트

| # | 항목 | 확인 |
|---|---|---|
| 0-1 | git status 확인 (미커밋 파악) | |
| 0-2 | 배포 API 200 응답 | |
| 0-3 | DB 포트 15432 LISTEN 중 | |
| 0-4 | A2A agents 목록에 테스트 2개 존재 | |
| 0-5 | 테스트 에이전트 id + api_key 확보 | |
| 0-6 | `apps/web` pnpm dev 정상 | |
| 0-7 | Dashboard 모달 탭 구조 파악 | |

---

# Day 1 — Workshop 탭 (Epic 8, 퍼블리싱만)

> **범위**: Dashboard 모달에 "Workshop" 탭 추가. 5 슬롯 + Inventory + Market 등록 토글.
> **주의**: 실제 장착/해제를 서버로 저장하지 않음. 전부 로컬 state (useState) + localStorage.

---

## Story 8.1 — Workshop 탭 5-슬롯 장착 UI `AI`

### 사전 조건
- Day 0 완료
- `apps/web/components/cherry/kaas-dashboard-page.tsx` 의 탭 배열 위치 확인 완료

### 구현 단계

**1단계: Mock 데이터 파일 생성**

파일: `apps/web/lib/workshop-mock.ts`
```typescript
export type SkillType = "skill" | "mcp" | "memory"

export interface InventoryItem {
  id: string
  title: string
  type: SkillType
  category: string                   // 'RAG' | 'Agents' | 'Reasoning' | ...
  updatedAt: string                  // ISO
  source: "purchased" | "followed"
  sourceAgent?: string               // followed 의 경우 원본 에이전트 이름
}

export type SlotKey = "identity" | "gear" | "skillA" | "skillB" | "skillC"

export interface WorkshopState {
  equipped: Record<SlotKey, string | null>   // slot → item.id or null
  inventory: InventoryItem[]
  isListedOnMarket: boolean
  isFollowingAny: boolean                    // 팔로우 중 여부 (등록 버튼 비활성용)
  cloneSimilarity?: number                   // 복제 검사 점수 (0~1)
}

export const mockInventory: InventoryItem[] = [
  { id: "inv-1", title: "RAG best practices", type: "skill",  category: "RAG",       updatedAt: "2026-04-22", source: "purchased" },
  { id: "inv-2", title: "Chain-of-Thought",   type: "skill",  category: "Reasoning", updatedAt: "2026-04-20", source: "purchased" },
  { id: "inv-3", title: "Multi-hop RAG",      type: "skill",  category: "RAG",       updatedAt: "2026-04-18", source: "followed", sourceAgent: "gpt_research_bot" },
  { id: "inv-4", title: "Brave Search MCP",   type: "mcp",    category: "Tools",     updatedAt: "2026-04-15", source: "purchased" },
  { id: "inv-5", title: "Postgres MCP",       type: "mcp",    category: "Tools",     updatedAt: "2026-04-10", source: "purchased" },
  { id: "inv-6", title: "Long-term memory",   type: "memory", category: "Memory",    updatedAt: "2026-04-08", source: "purchased" },
]

export const defaultWorkshopState: WorkshopState = {
  equipped: { identity: null, gear: null, skillA: null, skillB: null, skillC: null },
  inventory: mockInventory,
  isListedOnMarket: false,
  isFollowingAny: false,
}

export const SLOT_META: Record<SlotKey, { label: string; accept: SkillType[]; icon: string }> = {
  identity: { label: "Identity",  accept: ["skill"],        icon: "👤" },
  gear:     { label: "Gear",      accept: ["mcp"],          icon: "🛠" },
  skillA:   { label: "Skill A",   accept: ["skill","memory"], icon: "✨" },
  skillB:   { label: "Skill B",   accept: ["skill","memory"], icon: "✨" },
  skillC:   { label: "Skill C",   accept: ["skill","memory"], icon: "✨" },
}
```

**2단계: Workshop 탭 컴포넌트 작성**

파일: `apps/web/components/cherry/kaas-workshop-panel.tsx` (신규)

핵심 구조:
```tsx
"use client"
import { useState, useEffect } from "react"
import { defaultWorkshopState, mockInventory, SLOT_META, SlotKey, WorkshopState, InventoryItem } from "@/lib/workshop-mock"

const STORAGE_KEY = "cherry_workshop_state_v1"

interface KaasWorkshopPanelProps {
  currentAgent?: any                  // selectedAgent 객체 (id, name, api_key, knowledge 등)
  currentAgentApiKey?: string         // Day 3 Story 10.5 가드 조회용
}

export function KaasWorkshopPanel({ currentAgent, currentAgentApiKey }: KaasWorkshopPanelProps) {
  const [state, setState] = useState<WorkshopState>(defaultWorkshopState)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // localStorage 복구
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setState(JSON.parse(raw))
    } catch {}
  }, [])

  // 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  function equip(slot: SlotKey, itemId: string) {
    const item = state.inventory.find(i => i.id === itemId)
    if (!item) return
    // 슬롯 타입 제약 검증 (Story 8.1-T5)
    if (!SLOT_META[slot].accept.includes(item.type)) {
      // 시각적 피드백 (shake 또는 toast) 가능
      return
    }
    setState(s => ({ ...s, equipped: { ...s.equipped, [slot]: itemId } }))
  }
  function unequip(slot: SlotKey) {
    setState(s => ({ ...s, equipped: { ...s.equipped, [slot]: null } }))
  }
  function toggleListing() {
    setState(s => ({ ...s, isListedOnMarket: !s.isListedOnMarket }))
  }

  const availableInventory = state.inventory.filter(
    (i) => !Object.values(state.equipped).includes(i.id)
  )

  return (
    <div className="flex gap-4 p-4">
      {/* 좌: 에이전트 슬롯 */}
      <section className="flex-1 max-w-[360px]">
        <h3 className="text-sm font-bold mb-3">🎮 Agent Equipment</h3>
        <div className="space-y-2">
          {(Object.keys(SLOT_META) as SlotKey[]).map((slot) => {
            const equippedId = state.equipped[slot]
            const equippedItem = equippedId ? state.inventory.find((i) => i.id === equippedId) : null
            return (
              <div
                key={slot}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => draggedId && equip(slot, draggedId)}
                className={`border rounded-lg p-3 min-h-[56px] transition ${
                  equippedItem
                    ? "border-[#C9A24A] bg-[#FDF8E9]"
                    : "border-dashed border-gray-300 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{SLOT_META[slot].icon}</span>
                  <span className="text-xs uppercase font-bold text-gray-600">{SLOT_META[slot].label}</span>
                  {equippedItem && (
                    <button onClick={() => unequip(slot)} className="ml-auto text-xs text-gray-400 hover:text-red-600">×</button>
                  )}
                </div>
                {equippedItem ? (
                  <div className="mt-1 text-sm font-medium">{equippedItem.title}</div>
                ) : (
                  <div className="mt-1 text-xs italic text-gray-400">Drag skill here</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Market 등록 토글 (Story 8.3에서 완성) */}
        <RegisterToggle state={state} onToggle={toggleListing} />
      </section>

      {/* 우: Inventory */}
      <section className="flex-1">
        <h3 className="text-sm font-bold mb-3">🎒 Inventory ({availableInventory.length})</h3>
        <InventoryFilter />
        <div className="grid grid-cols-2 gap-2">
          {availableInventory.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragEnd={() => setDraggedId(null)}
              className="border rounded-md p-3 cursor-grab hover:shadow-md bg-white"
            >
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-gray-500">{item.category} · {item.type}</div>
              {item.source === "followed" && (
                <div className="text-[10px] text-[#8F1D12] mt-1">via @{item.sourceAgent}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

**3단계: Dashboard 모달에 탭 추가**

파일: `apps/web/components/cherry/kaas-dashboard-page.tsx` (실측 위치)

현재 구조 (line 1524 부근):
```tsx
const [activeTab, setActiveTab] = useState<"dashboard" | "curation" | "concept-page" | "template">("dashboard")
```

현재 tabs 배열 (line 1629 부근):
```tsx
const tabs = [
  { key: "dashboard" as const, label: "Dashboard" },
  { key: "curation" as const, label: "Knowledge Curation" },
  ...(isAdmin ? [
    { key: "concept-page" as const, label: "Concept Page" },
    { key: "template" as const, label: "Prompt Templates" },
  ] : []),
]
```

**수정 1** — 탭 타입 확장:
```tsx
const [activeTab, setActiveTab] = useState<"dashboard" | "curation" | "workshop" | "concept-page" | "template">("dashboard")
```

**수정 2** — tabs 배열에 workshop 추가 (curation 과 admin-only 사이, 모든 유저 노출):
```tsx
const tabs = [
  { key: "dashboard" as const, label: "Dashboard" },
  { key: "curation" as const, label: "Knowledge Curation" },
  { key: "workshop" as const, label: "Workshop" },        // ← 추가, 모든 유저 노출
  ...(isAdmin ? [
    { key: "concept-page" as const, label: "Concept Page" },
    { key: "template" as const, label: "Prompt Templates" },
  ] : []),
]
```

**수정 3** — import + content 렌더 (`activeTab === "template"` 블록 뒤에):
```tsx
import { KaasWorkshopPanel } from "./kaas-workshop-panel"

// 기존 activeTab === "dashboard" / "curation" / "concept-page" / "template" 블록들 뒤에:
{activeTab === "workshop" && (
  <div className="h-full overflow-y-auto p-4 lg:p-6">
    <KaasWorkshopPanel
      currentAgent={selectedAgent}       // 상위 state 참조
      currentAgentApiKey={selectedAgent?.api_key}
    />
  </div>
)}
```

**수정 4** — `onTabChange?.(activeTab)` 이 이미 `useEffect` 로 상위에 전달되고 있으므로 `page.tsx` 의 `currentPage` 분기에 `workshop` 케이스만 추가:

파일: `apps/web/app/page.tsx`
```tsx
currentPage={
  showDashboard
    ? dashboardTab === "curation" ? "Dashboard › Knowledge Curation"
    : dashboardTab === "concept-page" ? "Dashboard › Concept Page"
    : dashboardTab === "workshop" ? "Dashboard › Workshop"     // ← 추가
    : dashboardTab === "template" ? "Dashboard › Prompt Templates"
    : "Dashboard"
    : activeNav
}
```

**4단계: dashboardTab 타입 업데이트 (page.tsx)**

파일: `apps/web/app/page.tsx`

`dashboardTab` state 타입이 있다면 `"workshop"` 추가. 위 수정 3에서 Dashboard 에서 전달하는 값에 workshop 포함되므로 page.tsx 에서도 타입 허용 필요.

### 테스트 체크리스트 (Story 8.1)

| # | 테스트 | 방법 | 기대 |
|---|---|---|---|
| 8.1-T1 | 탭 가시 | Dashboard 모달 열기 | "Workshop" 탭 버튼 보임 |
| 8.1-T2 | 패널 렌더 | Workshop 탭 클릭 | 좌측 5 슬롯 + 우측 Inventory 6개 |
| 8.1-T3 | 드래그 장착 | Inventory 카드 → Skill A 슬롯 드롭 | 슬롯이 골드 테두리로 채워지고 Inventory 에서 사라짐 |
| 8.1-T4 | 해제 | 슬롯 × 버튼 | 슬롯 비워지고 Inventory 에 복귀 |
| 8.1-T5 | 타입 검증 | "MCP" 타입을 "Identity" (skill만 accept) 슬롯에 드롭 | 거부 또는 시각적 피드백 |
| 8.1-T6 | localStorage | 장착 후 새로고침 | 상태 유지됨 |
| 8.1-T7 | Cherry Console | 탭 전환 시 Console currentPage | "Dashboard › Workshop" 표시 |

---

## Story 8.2 — Inventory 필터 / 상세 `AI`

### 구현 단계

**1단계: InventoryFilter 컴포넌트**

Workshop 패널 내부에 필터 버튼 그룹:
```tsx
const [filter, setFilter] = useState<"all" | SkillType>("all")
const filtered = filter === "all" ? availableInventory : availableInventory.filter(i => i.type === filter)

<div className="flex gap-1 mb-2">
  {(["all","skill","mcp","memory"] as const).map(f => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={`px-2 py-1 text-xs rounded ${filter === f ? "bg-[#C8301E] text-white" : "bg-gray-100"}`}
    >
      {f === "all" ? "All" : f.toUpperCase()}
    </button>
  ))}
</div>
```

**2단계: 호버 툴팁**

Inventory 카드 호버 시 상세 정보 (updated_at, source, category) 툴팁 표시. 또는 카드 클릭 시 상세 모달.

### 테스트 체크리스트 (Story 8.2)

| # | 테스트 | 기대 |
|---|---|---|
| 8.2-T1 | "All" 클릭 | 전체 6개 표시 |
| 8.2-T2 | "SKILL" 클릭 | type=skill 3개만 |
| 8.2-T3 | "MCP" 클릭 | type=mcp 2개만 |
| 8.2-T4 | "MEMORY" 클릭 | type=memory 1개만 |
| 8.2-T5 | followed 소스 배지 | `inv-3` 카드에 "via @gpt_research_bot" 표시 |
| 8.2-T6 | 호버 툴팁 | updated_at, category 표시 |

---

## Story 8.3 — Market 등록 토글 + 가드 `AI`

### 구현 단계

**1단계: RegisterToggle 컴포넌트**

```tsx
function RegisterToggle({ state, onToggle }: { state: WorkshopState, onToggle: () => void }) {
  const disabled = state.isFollowingAny || (state.cloneSimilarity ?? 0) >= 0.8
  const reason = state.isFollowingAny
    ? "팔로우 중엔 등록할 수 없습니다"
    : (state.cloneSimilarity ?? 0) >= 0.8
      ? "팔로우한 에이전트 복제본은 등록할 수 없습니다"
      : ""

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer" title={reason}>
          <input
            type="checkbox"
            checked={state.isListedOnMarket}
            onChange={onToggle}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className={`w-11 h-6 rounded-full transition ${
            disabled ? "bg-gray-200" : state.isListedOnMarket ? "bg-[#2A5C3E]" : "bg-gray-300"
          }`}>
            <div className={`w-5 h-5 bg-white rounded-full transition transform mt-0.5 ${
              state.isListedOnMarket ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </div>
        </label>
        <span className={`text-sm ${disabled ? "text-gray-400" : ""}`}>
          Register to Special Agents
        </span>
      </div>
      {disabled && <p className="text-xs text-[#C8301E] mt-1">{reason}</p>}
    </div>
  )
}
```

**2단계: Mock 상태 전환 버튼 (개발/데모용)**

퍼블리싱 시연을 위해 `isFollowingAny` 값을 토글해볼 수 있는 디버그 버튼을 Workshop 패널 하단에 추가 (데모 시연용, 프로덕션에서는 제거).

### 테스트 체크리스트 (Story 8.3)

| # | 테스트 | 조건 | 기대 |
|---|---|---|---|
| 8.3-T1 | 기본 상태 | `isFollowingAny=false` | 토글 활성, OFF |
| 8.3-T2 | 등록 ON | 토글 클릭 | ON 상태 + localStorage 반영 |
| 8.3-T3 | 팔로우 중 가드 | `isFollowingAny=true` | 토글 disabled + 툴팁 노출 |
| 8.3-T4 | 복제 가드 | `cloneSimilarity=0.9` | 토글 disabled + "복제본 등록 불가" 툴팁 |
| 8.3-T5 | Market 반영 | 토글 ON → Market Special Agents 탭 (Epic 10 완료 후) | 내 에이전트 카드 표시 |

---

## Day 1 완료 선언

- [ ] 8.1 5-슬롯 UI + 드래그드롭 완료
- [ ] 8.2 Inventory 필터 완료
- [ ] 8.3 Market 등록 토글 + 가드 완료
- [ ] `3-checklist-table.md` 의 Day 1 항목 PASS 기록
- [ ] `4-progress-log.md` 에 Day 1 세션 append
- [ ] 커밋: `feat: Story 8.1-8.3 — Workshop panel publishing`

---

# Day 2 — Arena 페이지 (Epic 9, 퍼블리싱만)

> **범위**: 사이드바 "AGENT SHOP" 섹션에 Arena 항목 추가 + 풀페이지 신설. 전부 mock 데이터.

---

## Story 9.1 — Arena 페이지 스캐폴딩 + 사이드바 연결 `AI`

### 구현 단계

**1단계: Mock 데이터 파일**

파일: `apps/web/lib/arena-mock.ts`
```typescript
export type ArenaCategory = "RAG" | "Agents" | "Reasoning"

export interface ArenaAgent {
  id: string
  name: string
  avatar?: string
  karmaTier: "Bronze" | "Silver" | "Gold" | "Platinum"
  elo: number
  wins: number
  losses: number
  category: ArenaCategory
  rank: number
  badges: string[]
}

export interface ArenaMatch {
  id: string
  fromAgent: string
  toAgent: string
  winnerAgent: string
  category: ArenaCategory
  timestamp: string            // ISO
  relativeTime: string         // "2m ago"
}

export const hotAgent: ArenaAgent = {
  id: "hot-1", name: "claude_linux_test", karmaTier: "Silver",
  elo: 1847, wins: 23, losses: 4, category: "RAG", rank: 1,
  badges: ["🔥", "⚡"],
}
export const hotCopy = "24시간 만에 #1 등극 · 연승 중"

export const overallChampion: ArenaAgent = {
  id: "champ-1", name: "gpt_research_bot", karmaTier: "Gold",
  elo: 1923, wins: 47, losses: 5, category: "RAG", rank: 1,
  badges: ["👑", "🔥"],
}

export const categoryRankings: Record<ArenaCategory, ArenaAgent[]> = {
  RAG:       [ /* 10개 */ ],
  Agents:    [ /* 10개 */ ],
  Reasoning: [ /* 10개 */ ],
}

export const recentMatches: ArenaMatch[] = [ /* 5~10개 */ ]
```

각 카테고리 10개 에이전트는 이름만 `rag_specialist_01` 식으로 의미있게 + Elo 범위 (1500~1900).

**2단계: Arena 페이지 컴포넌트**

파일: `apps/web/components/cherry/kaas-arena-page.tsx` (신규)
```tsx
"use client"
import { useState } from "react"
import { ArenaCategory, categoryRankings, hotAgent, hotCopy, overallChampion, recentMatches } from "@/lib/arena-mock"

export function KaasArenaPage() {
  const [cat, setCat] = useState<ArenaCategory>("RAG")
  return (
    <div className="w-full max-w-[1200px] mx-auto p-6 space-y-6">
      <HotSection />
      <ChampionSection />
      <CategoryTabs cat={cat} onChange={setCat} />
      <Leaderboard items={categoryRankings[cat]} />
      <RecentMatchesFeed matches={recentMatches} />
    </div>
  )
}
```

**3단계: 사이드바 항목 추가**

파일: `apps/web/components/cherry/sidebar.tsx`

상단 import 에 `Trophy` 추가:
```tsx
import { Home, FileText, ShoppingBag, Sparkles, Link2, Lightbulb, BookOpen, GraduationCap, Zap, Trophy, /* ... 기존 아이콘들 */ } from "lucide-react"
```

AGENT SHOP 섹션의 items 배열에 Arena 추가:
```tsx
{
  label: "AGENT SHOP",
  items: [
    { id: "kaas-catalog", icon: <ShoppingBag size={16} />, label: "Knowledge Market" },
    { id: "kaas-arena",   icon: <Trophy size={16} />,      label: "Arena" },     // 신규
  ],
},
```

동일하게 `mobile-sidebar.tsx` 에도 반영.

**4단계: 라우팅 연결**

파일: `apps/web/app/page.tsx`
```tsx
import { KaasArenaPage } from "@/components/cherry/kaas-arena-page"

// renderContent() switch 에 case 추가
case "kaas-arena":
  return <KaasArenaPage />
```

### 테스트 체크리스트 (Story 9.1)

| # | 테스트 | 기대 |
|---|---|---|
| 9.1-T1 | 사이드바 렌더 | "AGENT SHOP > Arena" 항목 보임 |
| 9.1-T2 | 클릭 라우팅 | 페이지 전환 후 Arena 렌더 |
| 9.1-T3 | 모바일 사이드바 | 모바일에서도 동일 |
| 9.1-T4 | 네트워크 의존성 | DevTools Network 탭 → Arena 렌더 시 API 호출 없음 |
| 9.1-T5 | 페이지 타이틀 | 브라우저 탭/헤더에 "Arena" 관련 표기 |

---

## Story 9.2 — Hot This Week 피처드 카드 `AI`

### 구현 단계

**1단계: HotSection 컴포넌트**

```tsx
function HotSection() {
  return (
    <section className="relative overflow-hidden rounded-xl border-2 border-[#C8301E] bg-gradient-to-br from-[#fbe8e3] to-white p-6">
      <div className="absolute top-3 right-3 bg-[#C8301E] text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
        🔥 Hot This Week
      </div>
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-[#1a1410] flex items-center justify-center text-3xl text-white">
          👤
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[#1a1410]">{hotAgent.name}</h2>
          <p className="text-sm text-[#3a3028] mt-1 italic">{hotCopy}</p>
          <div className="flex gap-3 mt-3 text-xs">
            <span>Elo {hotAgent.elo}</span>
            <span>{hotAgent.wins}W-{hotAgent.losses}L</span>
            <span>Karma {hotAgent.karmaTier}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="px-4 py-2 bg-[#C8301E] text-white text-sm font-bold rounded hover:bg-[#8F1D12]">
            View Diff
          </button>
          <button className="px-4 py-2 border border-[#C8301E] text-[#C8301E] text-sm font-bold rounded hover:bg-[#fbe8e3]">
            Follow
          </button>
        </div>
      </div>
    </section>
  )
}
```

**2단계: CTA 연결 (임시)**

Follow 버튼 클릭 → `alert("Follow from Arena — wired in Day 3")` 또는 state store 에 기록만. 실제 follow 로직은 Day 3 에서.

### 테스트 체크리스트 (Story 9.2)

| # | 테스트 | 기대 |
|---|---|---|
| 9.2-T1 | Hot 카드 렌더 | 최상단에 배너 스타일 카드 |
| 9.2-T2 | 아이콘 + 카피 | "🔥 Hot This Week" 배지 + 에이전트명 + 한 줄 카피 |
| 9.2-T3 | CTA 버튼 2개 | View Diff / Follow |
| 9.2-T4 | Follow 임시 동작 | 클릭 시 alert 또는 콘솔 로그 |

---

## Story 9.3 — Overall Champion + 카테고리 탭 + Top 10 `AI`

### 구현 단계

**1단계: ChampionSection**

```tsx
function ChampionSection() {
  return (
    <section className="rounded-lg border bg-[#FDF8E9] p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">👑</span>
        <div className="flex-1">
          <div className="text-xs uppercase font-bold text-[#C9A24A] tracking-wider">Overall Champion</div>
          <div className="text-lg font-bold">{overallChampion.name}</div>
          <div className="text-xs text-gray-600">
            Elo {overallChampion.elo} · {overallChampion.wins}W-{overallChampion.losses}L · Karma {overallChampion.karmaTier}
          </div>
        </div>
      </div>
    </section>
  )
}
```

**2단계: CategoryTabs + Leaderboard**

```tsx
function CategoryTabs({ cat, onChange }: { cat: ArenaCategory, onChange: (c: ArenaCategory) => void }) {
  return (
    <div className="flex gap-2 border-b">
      {(["RAG", "Agents", "Reasoning"] as ArenaCategory[]).map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-4 py-2 text-sm font-medium ${
            cat === c ? "border-b-2 border-[#C8301E] text-[#C8301E]" : "text-gray-500"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function Leaderboard({ items }: { items: ArenaAgent[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500 border-b">
          <th className="py-2 w-16">Rank</th>
          <th>Agent</th>
          <th className="w-20">Elo</th>
          <th className="w-24">W-L</th>
          <th className="w-24">Badge</th>
        </tr>
      </thead>
      <tbody>
        {items.map(a => (
          <tr
            key={a.id}
            className="border-b hover:bg-gray-50 cursor-pointer"
            onClick={() => { /* 해당 에이전트로 Market Special 탭 이동 — Day 3 에서 연결 */ }}
          >
            <td className="py-2">
              {a.rank === 1 ? "🥇" : a.rank === 2 ? "🥈" : a.rank === 3 ? "🥉" : `#${a.rank}`}
            </td>
            <td className="font-medium">{a.name}</td>
            <td>{a.elo}</td>
            <td>{a.wins}-{a.losses}</td>
            <td>{a.badges.join(" ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### 테스트 체크리스트 (Story 9.3)

| # | 테스트 | 기대 |
|---|---|---|
| 9.3-T1 | Champion 섹션 렌더 | 👑 + 이름 + 스탯 |
| 9.3-T2 | 카테고리 탭 3개 | RAG / Agents / Reasoning 버튼 |
| 9.3-T3 | 탭 전환 | 클릭 시 해당 카테고리 Top 10 표시 |
| 9.3-T4 | 1/2/3등 이모지 | 🥇🥈🥉 |
| 9.3-T5 | 행 호버 | 배경 색 변경, 커서 pointer |

---

## Story 9.4 — Recent Matches 라이브 피드 `AI`

### 구현 단계

**1단계: RecentMatchesFeed**

```tsx
function RecentMatchesFeed({ matches }: { matches: ArenaMatch[] }) {
  return (
    <section>
      <h3 className="text-sm font-bold mb-3">🔀 Recent Matches</h3>
      <div className="space-y-2">
        {matches.map(m => (
          <div key={m.id} className="border-l-2 border-[#A078D8] bg-[#1A1428] text-white rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-bold text-[#A078D8] uppercase">🔀 {m.category}</span>
              <span className="font-semibold text-[#D4854A]">{m.fromAgent}</span>
              <span className="text-gray-500">vs</span>
              <span className="font-semibold text-[#7B5EA7]">{m.toAgent}</span>
              <span className="ml-auto text-[#666] font-mono">{m.relativeTime}</span>
            </div>
            <div className="text-xs text-gray-300 mt-1">
              Winner: <span className="font-bold text-[#C9A24A]">{m.winnerAgent}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

Cherry Console 의 🔀 A2A 박스와 시각적 통일감 유지.

**2단계 (선택): 주기적 셔플**

```tsx
const [feedIndex, setFeedIndex] = useState(0)
useEffect(() => {
  const t = setInterval(() => setFeedIndex(i => (i + 1) % matches.length), 5000)
  return () => clearInterval(t)
}, [matches.length])
// 리스트 순서를 주기적으로 약간 변경해서 "살아있는" 느낌
```

### 테스트 체크리스트 (Story 9.4)

| # | 테스트 | 기대 |
|---|---|---|
| 9.4-T1 | 5~10개 매치 렌더 | 다크 박스, 🔀 아이콘, from/to, winner |
| 9.4-T2 | 상대 시간 | "2m ago", "5m ago" 식 표시 |
| 9.4-T3 | 카테고리 배지 | 각 매치마다 카테고리 표시 |
| 9.4-T4 | 시각 통일성 | Cherry Console A2A 박스와 유사 스타일 |

---

## Day 2 완료 선언

- [ ] 9.1~9.4 전부 PASS
- [ ] 사이드바 Arena 진입 가능
- [ ] Mock 데이터로 4섹션 모두 렌더
- [ ] 커밋: `feat: Story 9.1-9.4 — Arena page publishing`

---

# Day 3 — Special Agent Follow (Epic 10, 풀스택 핵심)

> **범위**: DB 스키마 + API + 프론트 UI + WS 배송 전부. 해커톤 데모의 킬러 피처.

---

## Story 10.1 — `kaas.agent_follow` 스키마 + API `AI`

### 구현 단계

**1단계: 마이그레이션 SQL 작성**

파일: `apps/docs/staged_mock/kaas-agent-follow-migration.sql`
```sql
-- kaas.agent_follow — 에이전트 간 팔로우 관계
-- 2026-04-23

CREATE TABLE IF NOT EXISTS kaas.agent_follow (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_agent_id  UUID NOT NULL REFERENCES kaas.agent(id),
  followed_agent_id  UUID NOT NULL REFERENCES kaas.agent(id),
  snapshot_skills    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  unfollowed_at      TIMESTAMPTZ,
  UNIQUE (follower_agent_id, followed_agent_id),
  CHECK  (follower_agent_id <> followed_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_follow_follower ON kaas.agent_follow(follower_agent_id, unfollowed_at);
CREATE INDEX IF NOT EXISTS idx_agent_follow_followed ON kaas.agent_follow(followed_agent_id, unfollowed_at);

-- agent 테이블 확장
ALTER TABLE kaas.agent
  ADD COLUMN IF NOT EXISTS is_listed_on_market BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_at            TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agent_listed ON kaas.agent(is_listed_on_market) WHERE is_listed_on_market = true;
```

**2단계: DB 에 적용**

⚠️ **AI 직접 실행 불가**. `ssh` 터널 + pg_hba 제약으로 Claude 프로세스에서 DB 접속하면 `no pg_hba.conf entry for host ...` 로 거부됨 (테스트 중 확인). **반드시 사용자가 DBeaver 또는 서버의 psql 로 직접 실행**.

사용자 실행 가이드:
1. DBeaver 접속 (LOCAL_DB_HOST, PORT, USER, PASSWORD 는 `apps/api/.env` 참조)
2. 위 SQL 전체 실행
3. 실행 결과 공유

AI 가 Swagger 로 간접 검증:
```bash
# 테이블 적용 후 API 재시작 불필요하지만, kaas.agent 에 컬럼 추가했으므로 Nest 재시작 권장
# 재시작 후 Swagger 로 확인:
curl -s https://api.solteti.site/api/v1/kaas/a2a/agents?listed=true | python3 -m json.tool | head -5
# 응답에 skills_count / followers_count / is_listed_on_market 필드 있으면 성공
```

검증 쿼리 (사용자 DBeaver):
```sql
\d kaas.agent_follow
\d+ kaas.agent
SELECT COUNT(*) FROM kaas.agent_follow;              -- 초기 0
SELECT COUNT(*) FROM kaas.agent WHERE is_listed_on_market IS NOT NULL;  -- 전체 agent 수
```

**3단계: Controller 파일**

⚠️ **중요**: `PATCH /agents/:id/listing` 은 **a2a 가 아닌 기존 `KaasAgentController`** 에 편입. 나머지 follow/unfollow/list 만 `KaasFollowController` 신규 생성.

#### 3-A. `KaasFollowController` (신규)

파일: `apps/api/src/modules/kaas/kaas-follow.controller.ts`
```typescript
import { Body, Controller, Delete, Get, Headers, Param, Post, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { KaasAgentService } from './kaas-agent.service';
import { KaasFollowService } from './kaas-follow.service';

@Controller('v1/kaas/a2a')
@ApiTags('Agent Communication (A2A) — Follow')
export class KaasFollowController {
  constructor(
    private readonly service: KaasFollowService,
    private readonly agentService: KaasAgentService,
  ) {}

  @Post('follow')
  @ApiOperation({ summary: 'Follow another agent (installs diff skills)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async follow(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { followedAgentId: string; skillIds?: string[] },
  ) {
    const follower = await this.agentService.authenticate(apiKey);
    return this.service.follow(follower.id, body.followedAgentId, body.skillIds);
  }

  @Delete('follow/:followedId')
  @ApiOperation({ summary: 'Unfollow' })
  async unfollow(@Headers('x-api-key') apiKey: string, @Param('followedId') followedId: string) {
    const follower = await this.agentService.authenticate(apiKey);
    return this.service.unfollow(follower.id, followedId);
  }

  @Get('follows')
  @ApiOperation({ summary: 'List agents I follow' })
  async follows(@Headers('x-api-key') apiKey: string) {
    const follower = await this.agentService.authenticate(apiKey);
    return this.service.listFollows(follower.id);
  }

  @Get('followers/:agentId')
  @ApiOperation({ summary: 'List followers of a given agent (public)' })
  async followers(@Param('agentId') agentId: string) {
    return this.service.listFollowers(agentId);
  }
}
```

#### 3-B. 기존 `KaasAgentController` 에 `PATCH :id/listing` 추가

파일: `apps/api/src/modules/kaas/kaas-agent.controller.ts` — 기존 파일에 엔드포인트만 삽입 (KaasFollowService 주입 필요).

**3-B-1. Import 추가** (파일 상단):
```typescript
import { KaasFollowService } from './kaas-follow.service';
```

**3-B-2. 생성자에 주입** (기존 constructor 수정):
```typescript
constructor(
  private readonly service: KaasAgentService,
  private readonly followService: KaasFollowService,   // ← 추가
) {}
```

**3-B-3. 엔드포인트 추가** (기존 `@Patch(':id/model')` 블록 근처):
```typescript
@Patch(':id/listing')
@UseGuards(AuthGuard('jwt'))
@ApiOperation({ summary: 'Toggle is_listed_on_market (owner only, with guards)' })
async toggleListing(
  @AuthUser('id') userId: string,
  @Param('id') id: string,
  @Body() body: { isListed: boolean },
) {
  return this.followService.toggleListing(userId, id, body.isListed);
}
```

최종 경로: `PATCH /api/v1/kaas/agents/:id/listing`
기존 `PATCH /api/v1/kaas/agents/:id/model` 과 서브패스가 달라 **충돌 없음**.

**4단계: Service 파일**

파일: `apps/api/src/modules/kaas/kaas-follow.service.ts`
```typescript
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { KaasWsGateway } from './kaas-ws.gateway';

const CLONE_THRESHOLD = Number(process.env.CLONE_THRESHOLD ?? 0.8);

@Injectable()
export class KaasFollowService {
  private readonly logger = new Logger(KaasFollowService.name);

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
    private readonly wsGateway: KaasWsGateway,
  ) {}

  async follow(followerId: string, followedId: string, skillIds?: string[]) {
    if (followerId === followedId) throw new BadRequestException('Cannot follow yourself');

    const followed = await this.knex('kaas.agent').where({ id: followedId }).first();
    if (!followed) throw new NotFoundException('Followed agent not found');
    if (!followed.is_listed_on_market) throw new ForbiddenException('Target is not listed');

    const follower = await this.knex('kaas.agent').where({ id: followerId }).first();
    const followerSkills = this.parseSkills(follower.knowledge);
    const followedSkills = this.parseSkills(followed.knowledge);

    const diffSkills = followedSkills.filter(
      (s) => !followerSkills.some((fs) => (fs.topic ?? fs.name) === (s.topic ?? s.name))
    );
    const selected = skillIds?.length
      ? diffSkills.filter((s) => skillIds.includes(s.topic ?? s.name))
      : diffSkills;

    // 1) follow 레코드
    const [row] = await this.knex('kaas.agent_follow')
      .insert({
        follower_agent_id: followerId,
        followed_agent_id: followedId,
        snapshot_skills: JSON.stringify(selected),
      })
      .onConflict(['follower_agent_id', 'followed_agent_id'])
      .merge({ unfollowed_at: null, snapshot_skills: JSON.stringify(selected) })
      .returning('*');

    // 2) follower 의 knowledge JSONB 에 skill 추가
    const updatedSkills = [...followerSkills, ...selected];
    await this.knex('kaas.agent')
      .where({ id: followerId })
      .update({ knowledge: JSON.stringify(updatedSkills) });

    // 3) WS: follower 에이전트에 skill 배송 (기존 save_skill_request 재사용)
    //    agent.knowledge JSONB 에는 topic/name 만 저장되어 있어 content_md 는 별도 조회 필요
    for (const skill of selected) {
      const topic = skill.topic ?? skill.name;
      const concept = await this.knex('kaas.concept').where({ id: topic }).first()
        ?? await this.knex('kaas.concept').where({ title: topic }).first();
      const content_md = concept?.content_md
        ?? `# ${topic}\n\n> Custom skill from @${followed.name} (no catalog entry)\n`;
      this.wsGateway.pushToAgent(followerId, 'save_skill_request', {
        concept_id: topic,
        content_md,
      });
    }

    // 4) followed 에게 알림
    this.wsGateway.pushToAgent(followedId, 'new_follower', { follower_id: followerId });

    // 5) Console broadcast
    if (this.wsGateway.server) {
      this.wsGateway.server.emit('agent_followed', {
        follower_id: followerId,
        followed_id: followedId,
        skills_count: selected.length,
      });
    }

    return { followId: row.id, installedCount: selected.length, skills: selected };
  }

  async unfollow(followerId: string, followedId: string) {
    const [row] = await this.knex('kaas.agent_follow')
      .where({ follower_agent_id: followerId, followed_agent_id: followedId })
      .whereNull('unfollowed_at')
      .update({ unfollowed_at: new Date() })
      .returning('*');
    if (!row) throw new NotFoundException('Follow relationship not found');
    return { ok: true };
  }

  async listFollows(followerId: string) {
    return this.knex('kaas.agent_follow as f')
      .leftJoin('kaas.agent as a', 'a.id', 'f.followed_agent_id')
      .where('f.follower_agent_id', followerId)
      .whereNull('f.unfollowed_at')
      .select('a.id', 'a.name', 'a.karma_tier', 'f.created_at');
  }

  async listFollowers(agentId: string) {
    return this.knex('kaas.agent_follow as f')
      .leftJoin('kaas.agent as a', 'a.id', 'f.follower_agent_id')
      .where('f.followed_agent_id', agentId)
      .whereNull('f.unfollowed_at')
      .select('a.id', 'a.name');
  }

  async toggleListing(userId: string, agentId: string, isListed: boolean) {
    const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.user_id !== userId) throw new ForbiddenException('Not your agent');

    if (isListed) {
      // Guard 1: 팔로우 중이면 등록 불가
      const followCount = await this.knex('kaas.agent_follow')
        .where({ follower_agent_id: agentId })
        .whereNull('unfollowed_at')
        .count({ c: '*' }).first();
      if (Number(followCount?.c ?? 0) > 0) {
        throw new ConflictException({ code: 'FOLLOWER_CANNOT_REGISTER', message: 'Unfollow all to register' });
      }
      // Guard 2: 복제 금지 — followed 에이전트의 skill 집합과 Jaccard ≥ CLONE_THRESHOLD 면 거부
      // (팔로우 중이 아니어도 과거에 팔로우 후 언팔 한 경우를 노림)
      const pastFollowed = await this.knex('kaas.agent_follow')
        .where({ follower_agent_id: agentId })
        .pluck('followed_agent_id');
      if (pastFollowed.length > 0) {
        const mine = new Set(this.parseSkills(agent.knowledge).map(s => s.topic ?? s.name));
        for (const fid of pastFollowed) {
          const target = await this.knex('kaas.agent').where({ id: fid }).first();
          if (!target) continue;
          const theirs = new Set(this.parseSkills(target.knowledge).map(s => s.topic ?? s.name));
          const inter = [...mine].filter(x => theirs.has(x)).length;
          const uni = new Set([...mine, ...theirs]).size;
          const jaccard = uni ? inter / uni : 0;
          if (jaccard >= CLONE_THRESHOLD) {
            throw new ConflictException({
              code: 'ANTI_CLONE_BLOCKED',
              similarity: jaccard,
              clonedFrom: fid,
            });
          }
        }
      }
    }

    await this.knex('kaas.agent')
      .where({ id: agentId })
      .update({ is_listed_on_market: isListed, listed_at: isListed ? new Date() : null });
    return { ok: true, isListed };
  }

  private parseSkills(raw: any): any[] {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }
}
```

**5단계: Module 등록**

파일: `apps/api/src/modules/kaas/kaas.module.ts`
```typescript
import { KaasFollowController } from './kaas-follow.controller';
import { KaasFollowService } from './kaas-follow.service';

// controllers 배열에 KaasFollowController 추가
// providers 배열에 KaasFollowService 추가
```

**6단계: listActiveAgents 확장 (listed 필터 + 집계)**

파일: `apps/api/src/modules/kaas/kaas-a2a.service.ts` → `listActiveAgents` 수정.

Special Agents 카드가 `skills_count` / `followers_count` 를 표시해야 하므로 집계 컬럼 필수.

```typescript
async listActiveAgents(opts: { listed?: boolean } = {}) {
  // PostgreSQL 전용: jsonb_array_length + 상관 서브쿼리
  let q = this.knex('kaas.agent as a')
    .where('a.is_active', true)
    .select(
      'a.id', 'a.name', 'a.karma_tier', 'a.is_listed_on_market',
      this.knex.raw(
        `COALESCE(jsonb_array_length(
           CASE jsonb_typeof(a.knowledge) WHEN 'array' THEN a.knowledge ELSE '[]'::jsonb END
         ), 0) AS skills_count`
      ),
      this.knex.raw(
        `(SELECT COUNT(*)::int FROM kaas.agent_follow f
           WHERE f.followed_agent_id = a.id AND f.unfollowed_at IS NULL) AS followers_count`
      ),
    )
    .orderBy('a.name');
  if (opts.listed) q = q.where('a.is_listed_on_market', true);
  return q;
}
```

Controller 에서 쿼리 파라미터 받기:
```typescript
@Get('agents')
async list(@Query('listed') listed?: string) {
  return this.service.listActiveAgents({ listed: listed === 'true' });
}
```

**주의**: `agent.knowledge` 가 string 으로 저장된 경우 `jsonb_typeof` 가 `'string'` 을 반환 → `jsonb_array_length` 호출 시 에러. 위 `CASE jsonb_typeof(...) WHEN 'array' THEN ... ELSE '[]'` 패턴으로 방어. `knowledge` 가 항상 JSONB array 라는 보장이 있으면 단순화 가능.

### 테스트 체크리스트 (Story 10.1)

**Swagger / curl 테스트** (배포 또는 로컬 API):

| # | 테스트 | 명령 | 기대 |
|---|---|---|---|
| 10.1-T1 | DB 테이블 존재 | `\d kaas.agent_follow` | 컬럼 6개 + UNIQUE + CHECK |
| 10.1-T2 | DB 컬럼 추가 | `\d kaas.agent \| grep listed` | `is_listed_on_market`, `listed_at` |
| 10.1-T3 | Swagger 섹션 | `/api` 접속 | "A2A — Follow" 섹션 5개 엔드포인트 |
| 10.1-T4 | POST follow | `curl -X POST .../follow -H x-api-key -d {followedAgentId}` | 200 + followId |
| 10.1-T5 | 자기자신 follow | same with same id | 400 Bad Request |
| 10.1-T6 | 미등록 타겟 | listed=false 인 대상 | 403 Forbidden |
| 10.1-T7 | 중복 follow | 같은 쌍 재호출 | 200 + unfollowed_at=null 갱신 |
| 10.1-T8 | GET follows | `curl -H x-api-key .../follows` | 배열, 내가 팔로우 중인 것만 |
| 10.1-T9 | DELETE unfollow | 존재하는 관계 삭제 | 200, unfollowed_at 기록 |
| 10.1-T10 | Listing 가드 (follower) | 팔로우 중 listing=true 시도 | 409 `FOLLOWER_CANNOT_REGISTER` |
| 10.1-T11 | Listing 가드 (clone) | 복제본 유사도 ≥ 0.8 | 409 `ANTI_CLONE_BLOCKED` |
| 10.1-T12 | agents?listed=true | 필터 동작 | is_listed=true 만 반환 |

### 디버깅 체크

- 마이그레이션 실패: 사용자 권한 / schema kaas 존재 여부 확인
- `onConflict.merge` 실패: knex 버전이 `.onConflict` 지원하는지 확인 (^2.0+)
- WS `pushToAgent` 가 false 반환: 해당 follower 에이전트가 WS 접속 중이 아님 — 차후 로그인 시 sync

---

## Story 10.2 — Market Special Agents 탭 `AI`

### 구현 단계

**1단계: Mock 데이터 (API 연결 전)**

파일: `apps/web/lib/special-agents-mock.ts` (Day 3 초기에 mock 으로 시작, 10.4 완료 시 실제 API 로 교체)

**2단계: Catalog 페이지 탭 확장**

파일: `apps/web/components/cherry/kaas-catalog-page.tsx`

기존 카테고리 탭 오른쪽에 "Special Agents" 탭 추가. 활성 시 concept 카드 대신 agent 카드 렌더:
```tsx
{activeTab === "special-agents" ? (
  <SpecialAgentsPanel currentAgentId={currentAgent?.id} />
) : (
  // 기존 concept 리스트
)}
```

**3단계: SpecialAgentsPanel**

파일: `apps/web/components/cherry/special-agents-panel.tsx` (신규)

**주의**: Diff 모달 계산을 위해 viewer 의 knowledge 도 필요. 기존 `currentAgent` 에 knowledge 가 이미 포함되어 있다면 prop 으로 내려주고, 없다면 Agent Card 로 fetch.

```tsx
import { useEffect, useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export function SpecialAgentsPanel({
  currentAgentId,
  currentAgentApiKey,   // viewer 의 api_key (Follow 호출용)
}: {
  currentAgentId?: string
  currentAgentApiKey?: string
}) {
  const [agents, setAgents] = useState<any[]>([])
  const [viewerSkills, setViewerSkills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [diffTarget, setDiffTarget] = useState<any>(null)

  // Special Agents 리스트
  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/v1/kaas/a2a/agents?listed=true`)
      .then(r => r.json())
      .then(d => { setAgents(d.filter((a: any) => a.id !== currentAgentId)); setLoading(false) })
  }, [currentAgentId])

  // Viewer 의 knowledge — Agent Card 로 fetch
  useEffect(() => {
    if (!currentAgentId) { setViewerSkills([]); return }
    fetch(`${API_BASE}/api/v1/kaas/a2a/agents/${currentAgentId}/card`)
      .then(r => r.json())
      .then(card => setViewerSkills(card.skills ?? []))
      .catch(() => setViewerSkills([]))
  }, [currentAgentId])

  if (loading) return <div className="p-6 text-center">Loading...</div>
  if (!currentAgentId) return <div className="p-6 text-center text-gray-500">Select an agent first</div>
  if (agents.length === 0) return <EmptyState />

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map(a => (
          <SpecialAgentCard key={a.id} agent={a} onClick={() => setDiffTarget(a)} />
        ))}
      </div>
      {diffTarget && (
        <SpecialAgentsDiffModal
          target={diffTarget}
          viewerSkills={viewerSkills}
          viewerApiKey={currentAgentApiKey}
          onClose={() => setDiffTarget(null)}
          onFollow={async (followedId, skillIds) => {
            if (!currentAgentApiKey) return
            await followAgent(currentAgentApiKey, followedId, skillIds)
            window.dispatchEvent(new CustomEvent("cherry:inventory-updated"))
            setDiffTarget(null)
          }}
        />
      )}
    </>
  )
}

function SpecialAgentCard({ agent, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-4 hover:shadow-md cursor-pointer bg-white"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#1a1410] flex items-center justify-center text-white text-lg">
          {agent.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-bold">{agent.name}</div>
          <div className="text-xs text-gray-600">Karma {agent.karma_tier}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-3 text-xs text-gray-500">
        <span>Skills: {agent.skills_count ?? "?"}</span>
        <span>Followers: {agent.followers_count ?? 0}</span>
      </div>
    </div>
  )
}
```

### 테스트 체크리스트 (Story 10.2)

| # | 테스트 | 기대 |
|---|---|---|
| 10.2-T1 | 탭 가시 | Catalog 에 "Special Agents" 탭 |
| 10.2-T2 | 카드 리스트 | listed 에이전트만 (내 것 제외) |
| 10.2-T3 | Loading 상태 | fetch 중 스피너/텍스트 |
| 10.2-T4 | Empty 상태 | listed=true 가 0개면 안내 메시지 |
| 10.2-T5 | 카드 디자인 | 개념 카드와 구분되는 시각 (아바타 + 원형) |

---

## Story 10.3 — Diff 모달 `AI`

### 구현 단계

**1단계: Diff 계산 함수**

파일: `apps/web/lib/diff-utils.ts`
```typescript
export function computeSkillDiff(viewer: any[], target: any[]) {
  const key = (s: any) => s.topic ?? s.name ?? s.id
  const viewerKeys = new Set(viewer.map(key))
  const diff = target.filter(s => !viewerKeys.has(key(s)))
  const shared = target.length - diff.length
  return { diff, shared }
}
```

**2단계: DiffModal 컴포넌트**

파일: `apps/web/components/cherry/special-agents-diff-modal.tsx` (신규)

⚠️ **Props 시그니처**는 부모(`SpecialAgentsPanel`)에서 전달하는 `viewerSkills`/`viewerApiKey` 와 **일치해야 함**. Agent 객체 전체 대신 skills 배열만 전달.

```tsx
"use client"
import { useEffect, useState } from "react"
import { computeSkillDiff } from "@/lib/diff-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

interface Props {
  target: { id: string; name: string; karma_tier?: string; skills_count?: number; followers_count?: number }
  viewerSkills: Array<{ topic?: string; name?: string; id?: string; category?: string }>
  viewerApiKey?: string
  onClose: () => void
  onFollow: (followedId: string, skillIds: string[]) => Promise<void> | void
}

export function SpecialAgentsDiffModal({ target, viewerSkills, viewerApiKey, onClose, onFollow }: Props) {
  const [targetFull, setTargetFull] = useState<any>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/kaas/a2a/agents/${target.id}/card`)
      .then(r => r.json()).then(setTargetFull)
  }, [target.id])

  if (!viewerApiKey) return (
    <Modal onClose={onClose}>
      <div className="p-6 text-center">Select an agent first</div>
    </Modal>
  )
  if (!targetFull) return <Modal onClose={onClose}><div className="p-6">Loading...</div></Modal>

  const targetSkills = targetFull.skills ?? []
  const { diff, shared } = computeSkillDiff(viewerSkills, targetSkills)

  return (
    <Modal onClose={onClose}>
      <div className="p-6 max-w-[540px]">
        <h3 className="text-lg font-bold mb-1">{target.name}</h3>
        <p className="text-sm text-gray-600 mb-4">
          Has <b>{diff.length}</b> skills you don't
          {shared > 0 && ` · Already shared: ${shared}`}
        </p>
        {diff.length === 0 ? (
          <div className="text-center text-gray-400 py-8">You already have everything this agent has ✨</div>
        ) : (
          <ul className="space-y-2">
            {diff.map((s: any) => (
              <li key={s.id ?? s.topic ?? s.name} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium text-sm">{s.name ?? s.topic ?? s.id}</div>
                  {/* Agent Card 는 {id, name} 만 반환 — category/updatedAt 은 없음. MVP 범위 */}
                </div>
                <button
                  onClick={() => onFollow(target.id, [s.topic ?? s.name ?? s.id])}
                  className="px-3 py-1 bg-[#C8301E] text-white text-xs rounded hover:bg-[#8F1D12]"
                >
                  Follow
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

// 간단한 Modal 헬퍼 (프로젝트 공통 Modal 이 있으면 그걸 사용)
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl shadow-xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
```

### 테스트 체크리스트 (Story 10.3)

| # | 테스트 | 기대 |
|---|---|---|
| 10.3-T1 | 차집합 정확 | viewer 에 a,b / target 에 a,b,c → c 만 표시 |
| 10.3-T2 | Shared 카운트 | 2 표시 (타이틀 노출 X) |
| 10.3-T3 | 차집합 0 | 축하 메시지 |
| 10.3-T4 | Viewer 미선택 | "Select an agent first" |
| 10.3-T5 | 각 행 Follow 버튼 | 존재 |

---

## Story 10.4 — Follow 버튼 → 실제 배송 `AI`

### 구현 단계

**1단계: API 클라이언트 함수**

파일: `apps/web/lib/api.ts` 에 추가. `API_BASE` 는 기존 파일에 이미 정의되어 있을 것 (`process.env.NEXT_PUBLIC_API_URL`). 없으면 선언:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export async function followAgent(apiKey: string, followedAgentId: string, skillIds?: string[]) {
  const res = await fetch(`${API_BASE}/api/v1/kaas/a2a/follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ followedAgentId, skillIds }),
  })
  if (!res.ok) throw new Error(`Follow failed: ${res.status}`)
  return res.json()
}

export async function unfollowAgent(apiKey: string, followedId: string) {
  const res = await fetch(`${API_BASE}/api/v1/kaas/a2a/follow/${followedId}`, {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
  })
  return res.json()
}

export async function toggleAgentListing(jwt: string, agentId: string, isListed: boolean) {
  const res = await fetch(`${API_BASE}/api/v1/kaas/agents/${agentId}/listing`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
    body: JSON.stringify({ isListed }),
  })
  if (!res.ok) throw await res.json()   // 에러코드 (FOLLOWER_CANNOT_REGISTER / ANTI_CLONE_BLOCKED) 포함
  return res.json()
}
```

**Toast 라이브러리**: 프로젝트에 `sonner` 설치되어 있음 (`apps/web/components/ui/sonner.tsx`). 사용법:
```tsx
import { toast } from "sonner"
toast.success("Installed 1 skill")
toast.error("Follow failed")
```

**2단계: DiffModal → Follow 핸들러 연결**

Story 10.2 의 `SpecialAgentsPanel` 에 이미 `onFollow` 콜백이 인라인으로 포함되어 있음. Story 10.4 에서는 **토스트 메시지 + 이벤트 디스패치 + 모달 닫기** 3가지 마무리:

```tsx
async function handleFollow(followedId: string, skillIds: string[]) {
  if (!currentAgentApiKey) return
  try {
    const result = await followAgent(currentAgentApiKey, followedId, skillIds)
    toast.success(`Installed ${result.installedCount} skill(s)`)
    // Workshop 패널에 인벤토리 재조회 신호
    window.dispatchEvent(new CustomEvent("cherry:inventory-updated", {
      detail: { agentId: currentAgentId, newSkills: result.skills }
    }))
    setDiffTarget(null)
  } catch (e: any) {
    toast.error(e?.message ?? "Follow failed")
  }
}
```

**3단계: Workshop Inventory 자동 갱신**

Workshop 패널 (`kaas-workshop-panel.tsx`) 에 이벤트 리스너 추가:

```tsx
useEffect(() => {
  const handler = async (e: Event) => {
    const ev = e as CustomEvent<{ agentId?: string; newSkills?: any[] }>
    if (!currentAgent?.id) return
    if (ev.detail?.agentId && ev.detail.agentId !== currentAgent.id) return

    // 방법 A (간단): 이벤트 payload 의 newSkills 를 로컬 inventory 에 append
    if (ev.detail?.newSkills?.length) {
      setState(s => ({
        ...s,
        inventory: [
          ...s.inventory,
          ...ev.detail!.newSkills!.map((sk: any) => ({
            id: `fw-${sk.topic ?? sk.name}`,
            title: sk.name ?? sk.topic,
            type: "skill" as const,
            category: sk.category ?? "Followed",
            updatedAt: new Date().toISOString().slice(0, 10),
            source: "followed" as const,
          })),
        ],
      }))
    }

    // 방법 B (정석): Agent Card 재조회로 동기화
    // const card = await fetch(`${API_BASE}/api/v1/kaas/a2a/agents/${currentAgent.id}/card`).then(r => r.json())
    // setState(s => ({ ...s, inventory: card.skills.map(toInventoryItem) }))
  }
  window.addEventListener("cherry:inventory-updated", handler)
  return () => window.removeEventListener("cherry:inventory-updated", handler)
}, [currentAgent?.id])
```

**주의**: Day 1 의 Workshop 은 `workshop-mock.ts` 기반이고, Day 3 에서 실제 API 연동으로 전환됨. 이벤트 기반 갱신은 즉시 반영(UX 우선), Agent Card 재조회는 서버 정합 (둘 다 구현해도 무방).

### 테스트 체크리스트 (Story 10.4)

| # | 테스트 | 기대 |
|---|---|---|
| 10.4-T1 | Follow 클릭 → DB | `kaas.agent_follow` INSERT 확인 |
| 10.4-T2 | knowledge 갱신 | follower 의 `agent.knowledge` JSONB 에 항목 추가 |
| 10.4-T3 | skill 배송 | WS `save_skill_request` 전송 (에이전트 접속 중이면 stderr 로그) |
| 10.4-T4 | Workshop 반영 | 모달 닫힌 후 Workshop Inventory 에 새 skill 표시 |
| 10.4-T5 | 토스트 | "Installed N skill(s)" |

### E2E 테스트 (Mac ↔ Linux)
1. Mac (`claude_test_for_a2a`) 로 대시보드 로그인
2. Workshop → Register 토글 ON
3. Linux (`claude_linux_test`) api_key 로 배포 사이트 다른 브라우저 접속
4. Market → Special Agents → 내 에이전트 카드 → Diff 모달 → Follow
5. Linux 측 Workshop Inventory 에 새 skill 등장 확인
6. DB: `SELECT * FROM kaas.agent_follow` 레코드 확인

---

## Story 10.5 — 역할 분리 / 복제 방지 가드 (클라이언트) `AI`

### 구현 단계

**1단계: Workshop 의 `isFollowingAny` 상태 실시간 반영**

Workshop 패널 마운트 시:
```tsx
useEffect(() => {
  if (!currentAgent?.api_key) return
  fetch(`${API_BASE}/api/v1/kaas/a2a/follows`, { headers: { "x-api-key": currentAgent.api_key } })
    .then(r => r.json())
    .then(list => setState(s => ({ ...s, isFollowingAny: list.length > 0 })))
}, [currentAgent?.api_key])
```

**2단계: Register 토글 → API 호출**

`toggleListing` 핸들러에 실제 API 연결:
```tsx
async function onToggle() {
  try {
    await fetch(`${API_BASE}/api/v1/kaas/a2a/agents/${currentAgent.id}/listing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
      body: JSON.stringify({ isListed: !state.isListedOnMarket }),
    }).then(r => {
      if (!r.ok) return r.json().then(j => { throw j })
      setState(s => ({ ...s, isListedOnMarket: !s.isListedOnMarket }))
    })
  } catch (err: any) {
    if (err.code === "FOLLOWER_CANNOT_REGISTER") toast.error("팔로우를 먼저 정리하세요")
    else if (err.code === "ANTI_CLONE_BLOCKED") toast.error(`복제본 거부 (유사도 ${err.similarity?.toFixed(2)})`)
    else toast.error("Registration failed")
  }
}
```

### 테스트 체크리스트 (Story 10.5)

| # | 테스트 | 시나리오 | 기대 |
|---|---|---|---|
| 10.5-T1 | 팔로우 전 등록 | isFollowingAny=false | 등록 성공 |
| 10.5-T2 | 팔로우 후 등록 시도 | 임의 에이전트 follow → 등록 토글 | 서버 409 + 토스트 |
| 10.5-T3 | 언팔 후 재시도 | unfollow → 등록 | 성공 |
| 10.5-T4 | Clone 재등록 시도 | 팔로우했다 언팔, 구성 유사도 ≥0.8 | 서버 409 ANTI_CLONE |
| 10.5-T5 | UI disabled 상태 | 서버 상태와 클라이언트 예측 일치 | 토글 회색 + 툴팁 |

---

## Story 10.6 — (선택) 팔로우 업데이트 자동 배송 `AI`

> 시간 남을 때 구현. Day 3 마감 우선.

### 구현 단계 (요약)
1. `kaas-query.controller.ts` 의 `purchase` 핸들러 종료 시점에 hook 추가:
   ```typescript
   const followers = await knex('kaas.agent_follow')
     .where({ followed_agent_id: purchaserAgentId })
     .whereNull('unfollowed_at')
     .pluck('follower_agent_id');
   for (const f of followers) {
     wsGateway.pushToAgent(f, 'followed_agent_updated', { new_skills: [newSkill] });
   }
   ```
2. 프론트 Workshop 패널에서 `followed_agent_updated` 이벤트 수신 → Inventory 에 "pending equip" 배지

### 테스트
- Mac 이 Linux 를 팔로우한 상태
- Linux 가 카탈로그에서 새 concept 구매
- Mac 의 Workshop Inventory 에 해당 skill 이 "pending equip" 상태로 등장

---

## Day 3 완료 선언

- [ ] 10.1 스키마+API 전부 Swagger 테스트 PASS (12개)
- [ ] 10.2 Market Special 탭 에이전트 목록 표시
- [ ] 10.3 Diff 모달 정확 차집합 계산
- [ ] 10.4 Follow → DB 저장 + 인벤토리 반영
- [ ] 10.5 가드 서버+클라 양쪽 동작
- [ ] (선택) 10.6 구현 시 자동 배송 테스트
- [ ] 커밋: `feat: Story 10.1-10.5 — Special Agent Follow (full-stack)`

---

# Day 3.5 — Bundler v0 (Framework integration, Epic 11)

> Workshop 이 실제 Claude Code 동작을 바꾸는 최소 레이어. **Foundation Model 은 Claude 고정** (픽커 제거). 자세한 배경: `architecture.md` Bundler Addendum.

## Story 11.1 — Foundation Model 픽커 제거 `AI`

### 파일
- `apps/web/components/cherry/kaas-workshop-panel.tsx`
- `apps/web/lib/workshop-mock.ts`

### 구현 단계

1. `workshop-mock.ts` 에서 `LLMOption` / `LLM_OPTIONS` / `DEFAULT_LLM_MODEL` export 삭제
2. `WorkshopState` 에서 `llmModel: string` 필드 제거
3. `defaultWorkshopState` 에서 `llmModel` 제거
4. `WORKSHOP_STORAGE_KEY` 를 `v4` → `v5` 로 bump (기존 캐시 자연 migrate)
5. `kaas-workshop-panel.tsx` 에 남은 LLM 관련 import / JSX 블록 제거 (이미 UI 에서 빠졌으나 참조 잔존 확인)

### 테스트
| # | 항목 | 기대 |
|---|---|---|
| 11.1-T1 | tsc 통과 | 에러 없음 |
| 11.1-T2 | Workshop 에 모델 풀다운 안 보임 | 시각 확인 |
| 11.1-T3 | localStorage `v5` 로 시작됨 | DevTools > Application |

---

## Story 11.2 — Skill Manifest 확장 (mock + 타입) `AI`

### 파일
- `apps/web/lib/workshop-mock.ts`

### 구현 단계

```typescript
export interface InventoryItem {
  id: string
  title: string
  type: SkillType
  category: string
  updatedAt: string
  source: "purchased" | "followed" | "builtin" | "custom"
  sourceAgent?: string
  summary?: string
  fileName?: string
  content?: string
  // ↓ 추가
  requiresTools?: string[]      // 해당 skill 이 요구하는 MCP tool 이름
  requiresMemory?: string       // "vector" | "episodic" | "working"
  minContext?: number           // 최소 context window (tokens)
}
```

mock 일부 skill 에 값 채움:
```typescript
{
  id: "inv-s1", title: "RAG best practices", type: "skill", category: "RAG",
  ...,
  requiresTools: ["brave-search"],   // ← 추가
  requiresMemory: "vector",           // ← 추가
},
{
  id: "inv-s3", title: "Multi-hop RAG", type: "skill", category: "RAG",
  ...,
  requiresTools: ["brave-search", "postgres"],
  minContext: 32000,
},
```

### 테스트
- UI 에 영향 없음 (필드만 추가). tsc 통과.

---

## Story 11.3 — Bundler Service + Prompt Library (backend) `AI`

### 파일
- `apps/api/src/modules/kaas/bundler/prompt-library.ts` (신규)
- `apps/api/src/modules/kaas/bundler/bundler.service.ts` (신규)
- `apps/api/src/modules/kaas/kaas.module.ts` (providers 에 추가)

### 3-1. Prompt Library

```typescript
// apps/api/src/modules/kaas/bundler/prompt-library.ts
export const ORCHESTRATION_PROMPTS: Record<string, string> = {
  'ReAct': `Follow the Reason + Act loop rigorously:
1. Thought: state your reasoning about what to do next.
2. Action: call exactly one tool or provide a final answer.
3. Observation: record the result of the action.
4. Repeat from step 1 until you can provide a complete final answer.`,

  'CodeAct': `Express every action as executable code rather than a natural tool call:
- When you need to act, write the code block that would achieve it.
- Inspect code outputs before deciding the next step.`,

  'Plan-and-Execute': `Produce a complete plan before executing:
1. Generate a numbered plan covering the full task.
2. Execute steps one at a time, checking results.
3. Re-plan only if observations diverge from the plan.`,
}

export const MEMORY_PROMPTS: Record<string, string> = {
  'Vector memory': `Write high-signal facts to the vector memory store.
Retrieve by semantic similarity when relevant.`,
  'Episodic buffer': `Keep the last 10 conversation turns in working context.
Summarize older turns when the buffer grows large.`,
  'Working scratchpad': `Use a task-scoped scratchpad for intermediate notes.
Persist nothing beyond the current task.`,
}
```

### 3-2. BundlerService.compile

```typescript
@Injectable()
export class BundlerService {
  compile(build: AgentBuild, agent: { id: string; name: string }, inventory: InventoryItem[]): BundleArtifact {
    const byId = new Map(inventory.map(i => [i.id, i]))
    const item = (id: string | null) => (id ? byId.get(id) ?? null : null)

    const prompt  = item(build.equipped.prompt)
    const mcp     = item(build.equipped.mcp)
    const orch    = item(build.equipped.orchestration)
    const mem     = item(build.equipped.memory)
    const skills  = ['skillA','skillB','skillC']
                      .map(k => item(build.equipped[k as keyof typeof build.equipped]))
                      .filter(Boolean) as InventoryItem[]

    // 1. claude.md 합본
    const claudeMd = [
      `<!-- Generated by Cherry Bundler v0. Build: ${build.id} · Agent: ${agent.name} -->`,
      '',
      '# Identity',
      prompt?.content ?? prompt?.summary ?? 'Default helpful assistant.',
      '',
      '# Orchestration',
      orch ? (ORCHESTRATION_PROMPTS[orch.title] ?? '') : 'Use Claude Code default loop.',
      '',
      '# Memory Strategy',
      mem ? (MEMORY_PROMPTS[mem.title] ?? '') : 'Stateless — no persistent memory.',
      '',
      '# Equipped Skills',
      ...skills.map(s => `- ${s.title} — ${s.summary ?? ''}`),
    ].join('\n')

    // 2. skill 파일들
    const skillFiles = skills.map(s => ({
      filename: s.title.toLowerCase().replace(/\s+/g, '-') + '.md',
      content: this.renderSkillFile(s),
    }))

    // 3. MCP 설치 커맨드
    const mcpConfig = mcp ? [this.mcpFromSkill(mcp)] : []

    // 4. install.sh
    const installScript = [
      '#!/usr/bin/env bash',
      'set -e',
      `SKILL_DIR="$HOME/.claude/skills/cherry-${agent.id}"`,
      'mkdir -p "$SKILL_DIR"',
      ...skillFiles.map(f => `cat > "$SKILL_DIR/${f.filename}" <<'CHERRY_EOF'\n${f.content}\nCHERRY_EOF`),
      ...mcpConfig.map(c => `claude mcp add ${c.name} ${c.command} ${(c.args ?? []).join(' ')}`),
      'echo "Cherry build installed."',
    ].join('\n\n')

    // 5. manifest
    const buildHash = this.hashBuild(build)
    const manifest = {
      buildId: build.id,
      buildHash,
      agentId: agent.id,
      createdAt: new Date().toISOString(),
      slots: build.equipped,
    }

    // 6. warnings
    const warnings = this.check(build, skills, mcp)

    return { claudeMd, skills: skillFiles, mcpConfig, installScript, manifest, warnings }
  }

  private renderSkillFile(s: InventoryItem): string {
    const fm = [
      '---',
      `name: "${s.title}"`,
      `type: "${s.type}"`,
      `category: "${s.category}"`,
      s.requiresTools?.length ? `requires_tools: [${s.requiresTools.map(t => `"${t}"`).join(', ')}]` : null,
      s.requiresMemory ? `requires_memory: "${s.requiresMemory}"` : null,
      s.minContext ? `min_context_tokens: ${s.minContext}` : null,
      s.summary ? `summary: "${s.summary}"` : null,
      '---',
    ].filter(Boolean).join('\n')
    return `${fm}\n\n${s.content ?? `# ${s.title}\n\n${s.summary ?? ''}`}`
  }

  private mcpFromSkill(mcp: InventoryItem): { name: string; command: string; args?: string[] } {
    // Mapping table — in production, comes from a registry.
    const MCP_REGISTRY: Record<string, { name: string; command: string; args?: string[] }> = {
      'Brave Search': { name: 'brave-search', command: 'npx', args: ['@brave/mcp-server'] },
      'Postgres MCP': { name: 'postgres', command: 'npx', args: ['@modelcontextprotocol/server-postgres'] },
      'Filesystem MCP': { name: 'filesystem', command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] },
    }
    return MCP_REGISTRY[mcp.title] ?? { name: mcp.title.toLowerCase(), command: 'echo', args: ['MCP not configured'] }
  }

  private hashBuild(build: AgentBuild): string {
    // Simple sha256 over sorted slot entries — stable across field order
    const normalized = JSON.stringify(Object.entries(build.equipped).sort())
    return require('crypto').createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  }

  private check(build: AgentBuild, skills: InventoryItem[], mcp: InventoryItem | null): BundleWarning[] {
    const w: BundleWarning[] = []

    // MISSING_TOOL
    const availableTool = mcp?.title
    for (const s of skills) {
      for (const t of s.requiresTools ?? []) {
        if (!availableTool?.toLowerCase().includes(t.toLowerCase())) {
          w.push({ kind: 'MISSING_TOOL', skill: s.title, tool: t })
        }
      }
    }

    // REDUNDANT_SKILLS
    const cats = skills.map(s => s.category)
    if (new Set(cats).size < cats.length) w.push({ kind: 'REDUNDANT_SKILLS', categories: cats })

    // NO_ORCHESTRATION
    if (!build.equipped.orchestration) w.push({ kind: 'NO_ORCHESTRATION' })

    // TOKEN_BUDGET — rough estimate (skills 3000 each + system 1000 + orch 500)
    const est = skills.length * 3000 + 1500 + (mcp ? 800 : 0)
    if (est > 20_000) w.push({ kind: 'TOKEN_BUDGET', estimated: est, limit: 20_000 })

    return w
  }
}
```

### 테스트

| # | 항목 | 기대 |
|---|---|---|
| 11.3-T1 | compile() 단위 테스트 — 모든 슬롯 채움 | claudeMd, 3개 skill 파일, 1개 mcp 커맨드 반환 |
| 11.3-T2 | 일부 슬롯 비움 | 에러 없이 빈 블록 / 빈 배열로 처리 |
| 11.3-T3 | Skill A requires brave-search, mcp 미장착 | warnings 에 MISSING_TOOL 포함 |
| 11.3-T4 | skill A/C 둘 다 카테고리 RAG | warnings 에 REDUNDANT_SKILLS 포함 |
| 11.3-T5 | orchestration 비어있음 | warnings 에 NO_ORCHESTRATION 포함 |

---

## Story 11.4 — Bundler Controller + 엔드포인트 3개 `AI`

### 파일
- `apps/api/src/modules/kaas/bundler/bundler.controller.ts` (신규)

```typescript
@Controller('v1/kaas/builds')
@ApiTags('Agent Builder')
export class KaasBundlerController {
  constructor(
    private readonly bundler: BundlerService,
    private readonly agentService: KaasAgentService,
    private readonly wsGateway: KaasWsGateway,
  ) {}

  @Post('compile')
  @UseGuards(AuthGuard('jwt'))
  async compile(@Body() body: { build: AgentBuild; agentId: string; inventory: InventoryItem[] }) {
    const agent = await this.agentService.findById(body.agentId)
    return this.bundler.compile(body.build, agent, body.inventory)
  }

  @Post(':agentId/install')
  @UseGuards(AuthGuard('jwt'))
  async install(
    @AuthUser('id') userId: string,
    @Param('agentId') agentId: string,
    @Body() body: { build: AgentBuild; inventory: InventoryItem[] },
  ) {
    const agent = await this.agentService.findById(agentId)
    if (agent.user_id !== userId) throw new ForbiddenException('Not your agent')
    const artifact = this.bundler.compile(body.build, agent, body.inventory)
    // WS push to the agent
    this.wsGateway.pushToAgent(agentId, 'install_build_request', {
      manifest: artifact.manifest,
      files: artifact.skills.map(f => ({
        path: `~/.claude/skills/cherry-${agentId}/${f.filename}`,
        content: f.content,
      })),
      mcpCommands: artifact.mcpConfig.map(c => `claude mcp add ${c.name} ${c.command} ${(c.args ?? []).join(' ')}`),
    })
    return { ok: true, buildId: artifact.manifest.buildId }
  }

  @Get(':agentId/current')
  @UseGuards(AuthGuard('jwt'))
  async current(@AuthUser('id') userId: string, @Param('agentId') agentId: string) {
    // Phase 3 — for now returns null
    return { manifest: null }
  }
}
```

### Swagger 테스트

| # | curl | 기대 |
|---|---|---|
| 11.4-T1 | `POST /v1/kaas/builds/compile` with full build | 200 + BundleArtifact |
| 11.4-T2 | `POST /v1/kaas/builds/compile` with missing skill id | 200 + 해당 슬롯만 빈 처리 |
| 11.4-T3 | `POST /v1/kaas/builds/:agentId/install` (다른 user JWT) | 403 |
| 11.4-T4 | `POST /v1/kaas/builds/:agentId/install` (owner) | 200 + WS 로그에 `install_build_request` |

---

## Story 11.5 — Workshop 에 "Build & Install" 버튼 + 경고 스트립 `AI`

### 파일
- `apps/web/components/cherry/kaas-workshop-panel.tsx`

### 구현 요약

1. Workshop 하단 Register 토글 아래에 **"Build & Install"** 버튼 추가
2. 클릭 시 모달 오픈:
   - 상단: 활성 빌드 요약 (7 슬롯 항목 리스트)
   - 중단: compile 결과의 `installScript` preview (monospace, 복사 버튼)
   - 하단 CTA 2 개:
     - `Copy commands` — clipboard.writeText(installScript) + 토스트
     - `Install via Cherry Agent` — `POST /builds/:agentId/install` 호출
3. 경고 스트립 — 빌드 변경 시 debounced `POST /compile` 호출하여 `warnings` 만 표시:
   - ⚠️ Missing tool / ⚠️ Token budget / ⚠️ Redundant / ⚠️ No orch
   - 0개면 `✓ Compatible` 라벨

### 테스트

| # | 항목 | 기대 |
|---|---|---|
| 11.5-T1 | 빌드 완성 후 Build & Install 클릭 | 모달 오픈, installScript preview |
| 11.5-T2 | Copy commands | clipboard 에 bash 복사됨 |
| 11.5-T3 | Install via Cherry Agent (에이전트 접속 중) | stderr 에 `install_build_request` 로그 |
| 11.5-T4 | 불완전 빌드 (missing tool) | 경고 스트립에 `MISSING_TOOL` 라벨 |

---

## Story 11.6 — MCP 에이전트에 `install_build_request` 핸들러 `AI`

### 파일
- `apps/agent-package/lib/ws-client.js`
- 번들 재빌드 + `apps/web/public/cherry-agent.js` 교체

### 구현

```javascript
socket.on('install_build_request', async (payload) => {
  const { manifest, files, mcpCommands } = payload
  process.stderr.write(`\n[Cherry] install_build_request received.\n`)
  process.stderr.write(`  Build: ${manifest.buildId}\n`)
  process.stderr.write(`  Files: ${files.length}\n`)
  process.stderr.write(`  MCP commands: ${mcpCommands.length}\n`)
  mcpCommands.forEach(c => process.stderr.write(`    $ ${c}\n`))
  process.stderr.write(`\n  Run? [y/N] `)

  // stdin 읽기
  const answer = await readLineFromStdin()
  if (answer.trim().toLowerCase() !== 'y') {
    socket.emit('install_build_result', { buildId: manifest.buildId, success: false, errors: ['user declined'] })
    return
  }

  const fs = require('fs')
  const path = require('path')
  const { execSync } = require('child_process')
  const installed: string[] = []
  const errors: string[] = []

  try {
    for (const f of files) {
      const resolved = f.path.replace('~', require('os').homedir())
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.writeFileSync(resolved, f.content)
    }
    // manifest
    const manifestPath = path.join(require('os').homedir(), '.claude', 'skills', `cherry-${manifest.agentId}`, 'manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    for (const cmd of mcpCommands) {
      try { execSync(cmd, { stdio: 'inherit' }); installed.push(cmd) }
      catch (e) { errors.push(`${cmd}: ${e.message}`) }
    }
    socket.emit('install_build_result', { buildId: manifest.buildId, success: errors.length === 0, installedCommands: installed, errors })
  } catch (e) {
    socket.emit('install_build_result', { buildId: manifest.buildId, success: false, errors: [e.message] })
  }
})
```

### 테스트

| # | 항목 | 기대 |
|---|---|---|
| 11.6-T1 | Web 에서 Install → 에이전트 stderr | 명령 preview + `Run? [y/N]` 프롬프트 |
| 11.6-T2 | `y` 입력 | 파일 생성 + MCP 설치 + manifest.json 저장 |
| 11.6-T3 | `n` 입력 | 아무 실행 안 됨, `install_build_result { success: false }` emit |
| 11.6-T4 | manifest 파일 | `~/.claude/skills/cherry-{agentId}/manifest.json` 에 저장 확인 |

---

## Day 3.5 완료 선언

- [ ] 11.1 Foundation Model 픽커 제거 + v5 bump
- [ ] 11.2 InventoryItem 에 requires_* 필드 + mock 샘플
- [ ] 11.3 BundlerService + PromptLibrary — Story 11.3-T1~T5 PASS
- [ ] 11.4 Controller 3 엔드포인트 — Swagger 테스트 PASS
- [ ] 11.5 Workshop 에 Build & Install 모달 + 경고 스트립
- [ ] 11.6 MCP 에이전트 핸들러 — E2E 설치 검증 1회 성공
- [ ] 커밋: `feat: Story 11.x — Bundler v0 (Workshop → install artifacts)`

---

# Day 4 — 통합 시연 리허설 (2시간)

## STEP 4-0: E2E 선행 조건 확인 `사용자`

E2E 테스트 시작 전 반드시 다음 상태:

1. ☐ Mac 터미널: `node apps/agent-package/dist/cherry-agent.js` 프로세스 기동 (CHERRY_API_KEY=Mac_key) — WS 연결 유지
2. ☐ Linux 터미널 (ssh): 동일하게 Linux MCP 에이전트 기동
3. ☐ 서버 로그 모니터링 (`[WS] ✓ connected` 두 개 확인)
4. ☐ 브라우저 2개 (또는 시크릿 탭): Mac 브라우저 / Linux 브라우저 세션 분리
5. ☐ 두 브라우저 모두 같은 유저 계정 로그인 + 각자 해당 에이전트 선택

## STEP 4-1: E2E 시나리오 전체 한 번 `AI + 사용자`

"한 번에 흘러가야 함":
```
1. 사용자: Mac 브라우저 → 대시보드 로그인 → Workshop 탭
2. Workshop: Inventory 에서 3개 skill 을 Skill A/B/C 슬롯에 드래그 장착
3. Workshop: "Register to Special Agents" 토글 ON
4. 사용자: Linux 측 다른 브라우저 → 같은 계정 로그인 → Market → Special Agents 탭
5. Market: 내 Mac 에이전트 카드 보임 → 클릭 → Diff 모달
6. Diff 모달: Linux 에 없는 skill 3개 표시 → 하나 Follow
7. Linux 측 Cherry Console: 🔀 A2A 이벤트 또는 follow broadcast 이벤트 박스 등장
8. Linux Workshop Inventory: 새 skill 자동 추가
9. Arena 탭: Mock 순위에 내 에이전트 어딘가 표시 (연출용)
```

## STEP 4-2: Cherry Console broadcast 확인

`broadcastToConsoles` 는 기존 A2A 이벤트 emit 로직과 같은 방식. `agent_followed` 이벤트를 Cherry Console 이 수신해서 렌더할지 결정 (선택):

파일: `apps/web/components/cherry/kaas-console.tsx` 에 핸들러 추가:
```tsx
socketInstance.on("agent_followed", (evt) => {
  setMessages(m => [...m, {
    role: "a2a",
    eventType: "task_created",
    fromName: evt.follower_name ?? "unknown",
    toName: evt.followed_name ?? "unknown",
    text: `followed with ${evt.skills_count} skills`,
    // ...
  }])
})
```

## STEP 4-3: 배포 빌드 테스트

```bash
cd apps/web && npx next build
cd apps/api && npm run build
```
에러 없이 빌드되어야 함. 에러 있으면 fix.

## STEP 4-4: 데모 녹화

- 2~3분 데모 영상 촬영 (해커톤 제출 용)
- 포커스: Workshop 장착 → Market 카드 → Diff → Follow → Inventory 자동 반영

## Day 4 완료 선언

- [ ] E2E 시나리오 3회 연속 성공
- [ ] 배포 빌드 에러 없음
- [ ] 데모 영상 녹화
- [ ] 최종 커밋 + 태그: `v0.2.0-phase2`

---

# 디버깅 치트시트

| 증상 | 1차 의심 | 확인 |
|---|---|---|
| Workshop 드래그 안 됨 | HTML5 drag API / `draggable` 속성 | `onDragStart/onDrop` 콘솔 로그 |
| 슬롯 장착 후 새로고침 시 사라짐 | localStorage key 오타 | DevTools > Application > Local Storage |
| Market Special 탭 0개 | listed=true 필터 | `curl .../a2a/agents?listed=true` 수동 확인 |
| Diff 모달 비어있음 | target.skills 없음 | Agent Card 응답의 `skills` 배열 확인 |
| Follow 500 에러 | DB 스키마 미적용 | `\d kaas.agent_follow` |
| FOLLOWER_CANNOT_REGISTER 안 뜸 | Guard 로직 경로 | 서버 로그 + `kaas.agent_follow` 조회 |
| 복제 가드 오탐 | CLONE_THRESHOLD 너무 낮음 | 0.8 → 0.9 로 조정 |
| WS save_skill_request 전달 안 됨 | follower 에이전트 미접속 | `pushToAgent` 반환값 false 로그 |
| Console 에서 agent_followed 안 보임 | 이벤트명 오타 / 서버 emit 빠짐 | 서버 로그 + DevTools WS frame |

---

# 완료 후 해야 할 것

1. `3-checklist-table.md` 전체 PASS 확인
2. `4-progress-log.md` 최종 세션 기록
3. `apps/docs/arena/planning-artifacts/` 의 sprint-status.yaml 은 구 파이프라인용이라 **수정 안 함**
4. 해커톤 제출 자료 (2~3분 영상 + GitHub URL + README 업데이트)
