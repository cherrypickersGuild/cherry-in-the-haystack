# Shop Redesign — Implementation Guide (v3)

> 1-work-guidelines.md v3 기반. 서버가 Shop 세트 single source of truth + 전액 환불 정책.

---

## Phase 0 — 준비 (45 min)

### 0-1. DB 스키마 확인 (Provenance FK — D10)

```bash
# kaas.query_log (또는 provenance) 테이블의 concept_id 컬럼 타입/제약 확인
```

- `concept_id` 가 `concepts.id` FK 걸려있는지 체크
- FK 있고 `set-*` 입력 시 실패하면 → `concepts` 테이블에 가상 row 4개 seed:
  ```sql
  INSERT INTO concepts (id, title, summary, category, quality_score, source)
  VALUES
    ('set-hunter',   'Shopping AI',  'Marketplace deal hunter', 'set', 4.6, 'builtin'),
    ('set-quant',    'Quant AI',     'Multi-asset crypto analyst', 'set', 4.6, 'builtin'),
    ('set-grounded', 'Research AI',  'Cite-every-fact researcher', 'set', 4.6, 'builtin'),
    ('set-policy',   'Policy AI',    'Cherry docs expert', 'set', 4.6, 'builtin');
  ```
- FK 제약 없으면 생략

### 0-2. `TYPE_THEME` export (M1)

`apps/web/components/cherry/kaas-workshop-panel.tsx`:
```typescript
export const TYPE_THEME = { /* 기존 */ }
```

- Shop 쪽에서 `import { TYPE_THEME }` 재사용

### 0-3. `credits.refund()` 확인

- `apps/api/src/modules/kaas/credits.service.ts` 에 `refund` 메서드 존재 확인
- 없으면 Phase 2 에서 같이 추가:
  ```typescript
  async refund(apiKey: string, amount: number, reason: string): Promise<void> {
    // credits 테이블 UPDATE + refund_log 테이블 INSERT
  }
  ```

---

## Phase 1 — 서버 `GET /shop/sets` (1.5h)

### 1-1. `shop-sets.registry.ts`

```typescript
// apps/api/src/modules/kaas/shop/shop-sets.registry.ts
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

export interface ShopSetComponent {
  slot: string
  cardId: string
  title: string
  summary: string
}

export interface ShopSet {
  id: string
  domain: string
  title: string
  subtitle: string
  icon: string
  equipped: AgentBuildInput
  slotCount: number
  priceBundled: number
  components: ShopSetComponent[]
}

// Workshop inventory 의 미러 데이터 (setTag 기반 파생 규칙 동일)
// NOTE: 프론트 workshop-mock.ts 와 동기화 필요.
//       Phase 0 에서 확인 후 drift 방지 위해 주석으로 seed 출처 명기.
const SERVER_INVENTORY_MIRROR: Array<{
  id: string; type: string; title: string; summary: string; setTag: string[]
}> = [
  // prompts
  { id: 'inv-p-hunter',   type: 'prompt',        title: 'Marketplace Hunter',   summary: '...', setTag: ['hunter'] },
  { id: 'inv-p-quant',    type: 'prompt',        title: 'Quantitative Analyst', summary: '...', setTag: ['quant'] },
  { id: 'inv-p-grounded', type: 'prompt',        title: 'Grounded Researcher',  summary: '...', setTag: ['grounded'] },
  { id: 'inv-p-policy',   type: 'prompt',        title: 'Policy Expert',        summary: '...', setTag: ['policy'] },
  // mcp
  { id: 'inv-m-market',   type: 'mcp',           title: 'Marketplace Search',   summary: '...', setTag: ['hunter'] },
  { id: 'inv-m-crypto',   type: 'mcp',           title: 'Crypto Price',         summary: '...', setTag: ['quant'] },
  { id: 'inv-m-catalog',  type: 'mcp',           title: 'Cherry Catalog',       summary: '...', setTag: ['policy', 'grounded'] },
  // skills
  { id: 'inv-s-decomp',       type: 'skill', title: 'Multi-step Decomposition', summary: '...', setTag: ['quant'] },
  { id: 'inv-s-json-strict',  type: 'skill', title: 'JSON Strict',              summary: '...', setTag: ['quant'] },
  { id: 'inv-s-citation',     type: 'skill', title: 'Citation Discipline',      summary: '...', setTag: ['quant', 'grounded'] },
  { id: 'inv-s-multihop',     type: 'skill', title: 'Multi-hop Retrieval',      summary: '...', setTag: ['grounded'] },
  { id: 'inv-s-abstention',   type: 'skill', title: 'Abstention',               summary: '...', setTag: ['grounded'] },
  // orch
  { id: 'inv-o-standard',     type: 'orchestration', title: 'Standard Loop',    summary: '...', setTag: [] },
  { id: 'inv-o-plan-execute', type: 'orchestration', title: 'Plan-and-Execute', summary: '...', setTag: ['quant', 'grounded'] },
  // memory
  { id: 'inv-me-none',      type: 'memory', title: 'Stateless',       summary: '...', setTag: ['hunter'] },
  { id: 'inv-me-short',     type: 'memory', title: 'Short-term',      summary: '...', setTag: [] },
  { id: 'inv-me-retrieval', type: 'memory', title: 'Retrieval buffer', summary: '...', setTag: ['policy'] },
]

const DOMAIN_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  hunter:   { title: 'Shopping AI', subtitle: 'Marketplace deal hunter',          icon: '🛍' },
  quant:    { title: 'Quant AI',    subtitle: 'Multi-asset crypto analyst',       icon: '💹' },
  grounded: { title: 'Research AI', subtitle: 'Cite-every-fact researcher',       icon: '📚' },
  policy:   { title: 'Policy AI',   subtitle: 'Cherry docs expert',                icon: '📜' },
}

// 슬롯 수 → 가격 tier (D6)
function priceForSlots(n: number): number {
  if (n <= 3) return 60
  if (n <= 5) return 90
  return 120
}

function equippedForDomain(tag: string): AgentBuildInput {
  const inv = SERVER_INVENTORY_MIRROR
  const first = (t: string) => inv.find((i) => i.type === t && i.setTag.includes(tag))?.id ?? null
  const skills = inv.filter((i) => i.type === 'skill' && i.setTag.includes(tag)).slice(0, 3)
  return {
    prompt: first('prompt'),
    mcp: first('mcp'),
    skillA: skills[0]?.id ?? null,
    skillB: skills[1]?.id ?? null,
    skillC: skills[2]?.id ?? null,
    orchestration: first('orchestration'),
    memory: first('memory'),
  }
}

export const SHOP_SETS: ShopSet[] = (Object.keys(DOMAIN_META)).map((tag) => {
  const equipped = equippedForDomain(tag)
  const equippedEntries = Object.entries(equipped) as [string, string | null][]
  const slotCount = equippedEntries.filter(([, v]) => v).length
  const components: ShopSetComponent[] = equippedEntries
    .filter(([, v]) => v)
    .map(([slot, cardId]) => {
      const item = SERVER_INVENTORY_MIRROR.find((i) => i.id === cardId)!
      return { slot, cardId: cardId!, title: item.title, summary: item.summary }
    })
  return {
    id: `set-${tag}`,
    domain: tag,
    ...DOMAIN_META[tag],
    equipped,
    slotCount,
    priceBundled: priceForSlots(slotCount),
    components,
  }
})

export function resolveShopSet(setId: string): ShopSet | null {
  return SHOP_SETS.find((s) => s.id === setId) ?? null
}
```

### 1-2. `shop.controller.ts`

```typescript
@Controller('v1/kaas/shop')
export class ShopController {
  @Get('sets')
  listSets(): ShopSet[] {
    return SHOP_SETS
  }
}
```

### 1-3. `kaas.module.ts` 등록

```typescript
controllers: [..., ShopController]
```

### 1-4. 수동 테스트

```bash
curl http://localhost:4000/api/v1/kaas/shop/sets | jq
# → 4개 세트 JSON 반환 확인
```

---

## Phase 2 — 서버 `POST /sets/buy-and-install` (2h)

### 2-1. `buy-set.service.ts`

```typescript
@Injectable()
export class BuySetService {
  constructor(
    private readonly credits: CreditsService,
    private readonly chain: ChainService,
    private readonly install: InstallBuildService,
    private readonly agents: KaasAgentService,
    private readonly ws: KaasWsGateway,
  ) {}

  async execute(setId: string, apiKey: string, chain: 'status' | 'near' | 'mock') {
    const set = resolveShopSet(setId)
    if (!set) throw new HttpException({ code: 'SET_NOT_FOUND' }, 404)

    const agent = await this.agents.findByApiKey(apiKey)
    if (!agent) throw new HttpException({ code: 'AGENT_NOT_FOUND' }, 401)

    if (!this.ws.isAgentConnected(agent.id))
      throw new HttpException({ code: 'AGENT_OFFLINE' }, 409)

    const balance = await this.credits.balance(apiKey)
    if (balance < set.priceBundled)
      throw new HttpException({ code: 'INSUFFICIENT_CREDITS' }, 402)

    // 5a. 크레딧 차감
    await this.credits.deduct(apiKey, set.priceBundled, `set-purchase:${setId}`)

    try {
      // 5b. provenance 기록
      const provenance = await this.chain.recordProvenance({
        agentId: agent.id,
        conceptId: set.id,  // ← D10 seed row 기반
        chain,
        creditsConsumed: set.priceBundled,
        action: 'purchase-set',
      })

      // 5c. Install 실행
      const installResult = await this.install.install(agent.user_id, agent.id, {
        build_id: set.id,
        build_name: set.title,
        equipped: set.equipped,
      })

      // 부분 실패 판정 — D9: 전액 환불
      const partial = installResult.failed.length > 0
      if (partial) {
        await this.credits.refund(apiKey, set.priceBundled, `set-partial-refund:${setId}`)
        return {
          ...installResult,
          credits_consumed: 0,
          credits_after: balance,
          provenance,
          partial: true,
        }
      }

      const balanceAfter = await this.credits.balance(apiKey)
      return {
        ...installResult,
        credits_consumed: set.priceBundled,
        credits_after: balanceAfter,
        provenance,
        partial: false,
      }
    } catch (err) {
      // 5c 전체 실패 → 환불
      await this.credits.refund(apiKey, set.priceBundled, `set-install-failed:${setId}`)
      throw err instanceof HttpException ? err : new HttpException(
        { code: 'INSTALL_FAILED', message: String(err) }, 500,
      )
    }
  }
}
```

### 2-2. `shop.controller.ts` 에 buy 엔드포인트 추가

```typescript
@Post('buy-and-install')
buy(@Body() body: { set_id: string; api_key: string; chain?: string }) {
  return this.buySvc.execute(body.set_id, body.api_key, (body.chain ?? 'status') as any)
}
```

### 2-3. `credits.refund()` 구현 (필요 시)

Phase 0-3 에서 없다고 판명되면 여기서 추가.

---

## Phase 3 — 프론트 (2.5h)

### 3-1. `apps/web/lib/api.ts`

```typescript
export async function fetchShopSets(): Promise<ShopSet[]> {
  const res = await fetch(`${KAAS_BASE}/shop/sets`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`fetchShopSets ${res.status}`)
  return res.json()
}

export interface BuySetResponse extends InstallBuildResponse {
  credits_consumed: number
  credits_after: number
  provenance: { hash: string; chain: string; explorer_url: string; on_chain: boolean }
  partial: boolean
}

export async function buySet(
  apiKey: string, setId: string, chain: 'status' | 'near' = 'status',
): Promise<BuySetResponse> {
  const res = await fetch(`${KAAS_BASE}/shop/buy-and-install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set_id: setId, api_key: apiKey, chain }),
  })
  if (!res.ok && res.status !== 207) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b?.message ?? `buySet ${res.status}`)
  }
  return res.json()
}
```

### 3-2. Shop page — 2대탭

```tsx
// apps/web/app/start/shop/page.tsx
export default function ShopPage() {
  const [root, setRoot] = useState<'domain' | 'component'>('domain')
  return (
    <div>
      <header>… StartFlowNav …</header>
      <div role="tablist" className="flex border-b …">
        <RootTab active={root === 'domain'} onClick={() => setRoot('domain')} icon="🎁" label="By Domain" />
        <RootTab active={root === 'component'} onClick={() => setRoot('component')} icon="🧩" label="By Component" />
      </div>
      {root === 'domain' ? <ShopByDomain /> : <ShopByComponent />}
    </div>
  )
}
```

### 3-3. `ShopByDomain` — API fetch + 서브탭 + 카드 그리드

```tsx
export function ShopByDomain() {
  const [sets, setSets] = useState<ShopSet[]>([])
  const [sub, setSub] = useState<'all' | string>('all')
  const [inspect, setInspect] = useState<ShopSet | null>(null)
  const [buyTarget, setBuyTarget] = useState<PurchaseTarget | null>(null)
  const [agents, setAgents] = useState<PurchaseAgent[]>([])

  useEffect(() => { fetchShopSets().then(setSets).catch(() => setSets([])) }, [])
  useEffect(() => { /* fetchAgents ... */ }, [token])

  const visible = sub === 'all' ? sets : sets.filter((s) => s.domain === sub)
  return (
    <>
      <SubTabs value={sub} onChange={setSub} options={['all', 'hunter', 'quant', 'grounded', 'policy']} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((s) => <ShopSetCard key={s.id} set={s} onBuy={...} onInspect={...} />)}
      </div>
      {inspect && <ShopSetDetailModal set={inspect} onClose={...} onBuy={...} />}
      <PurchaseModal mode="set" target={buyTarget} agents={agents} ... />
    </>
  )
}
```

### 3-4. Shared `SubTabs` + `SlotBadgeBar`

```tsx
// shop-subtabs.tsx — By Domain, By Component 둘 다 사용
export function SubTabs({ value, onChange, options }: Props) {
  return (
    <div role="tablist" className="flex gap-1 mb-4">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)}
          className={active ? '…' : '…'} >{opt}</button>
      ))}
    </div>
  )
}

// slot-badge-bar.tsx — 7슬롯 채움 상태 미니 배지
export function SlotBadgeBar({ equipped }: { equipped: AgentBuildPayload }) {
  const order = ['prompt', 'mcp', 'skillA', 'skillB', 'skillC', 'orchestration', 'memory']
  return (
    <div className="flex gap-1">
      {order.map((slot) => {
        const filled = !!equipped[slot as keyof AgentBuildPayload]
        const type = slot.startsWith('skill') ? 'skill' : slot
        return (
          <span key={slot} style={{ backgroundColor: filled ? TYPE_THEME[type].border : '#EEE' }} />
        )
      })}
    </div>
  )
}
```

### 3-5. `ShopSetCard`, `ShopSetDetailModal`

- hero 카드: 아이콘/제목/부제목/슬롯 배지/가격/Buy+Details 버튼
- 상세 모달: `set.components` 순회해서 표시. 개별 Buy 없음

### 3-6. `ShopByComponent` — 읽기 전용

```tsx
export function ShopByComponent() {
  const [filter, setFilter] = useState<SkillType>('prompt')
  const items = mockInventory.filter((i) => i.type === filter)
  return (
    <>
      <SubTabs value={filter} onChange={setFilter} options={['prompt', 'mcp', 'skill', 'orchestration', 'memory']} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => <ShopComponentCard key={it.id} item={it} />)}
      </div>
    </>
  )
}
```

### 3-7. `PurchaseModal` set mode 분기

```tsx
type PurchaseTarget =
  | { kind: 'component'; ... }       // 메인 사이트 경로 (Shop 에선 안 쓰임)
  | { kind: 'set'; set: ShopSet }

async function handleConfirm() {
  if (target?.kind === 'set') {
    const resp = await buySet(selectedAgent.api_key, target.set.id, 'status')
    if (resp.partial) {
      setErrorMsg('일부 컴포넌트 설치 실패 — 전액 환불됨. 재시도하세요.')
      setPhase('error')
      return
    }
    // 성공 → result 세팅
  } else {
    // purchaseConcept 경로
  }
}
```

로딩 메시지 set 전용:
```typescript
const SET_LOADING_MESSAGES = [
  'Installing your AI…',
  'Copying N skills…',
  'Wiring up tools…',
  'Recording on-chain…',
]
```

---

## Phase 4 — OWNED + Compare 통합 (30 min)

- `ShopSetCard` 에 OWNED 계산:
  ```typescript
  const ownedCount = set.components.filter((c) => ownedConceptIds.has(c.cardId)).length
  const allOwned = ownedCount === set.components.length
  ```
- 표시:
  - `allOwned` → "OWNED" 오버레이 (녹색)
  - `0 < ownedCount < total` → "4/6 installed" 회색 뱃지
  - `0` → 일반 상태
- `kaas-purchase-complete` 이벤트는 이미 Shop 측에서 dispatch → catalog 리스너 재사용

---

## Phase 5 — QA (1.5h) — `3-checklist-table.md` 참조

---

## 작업 순서 요약

| Phase | 작업 | 시간 |
|-------|------|------|
| 0 | DB FK 확인 + TYPE_THEME export + credits.refund 확인 | 45 min |
| 1 | 서버 `GET /shop/sets` | 1.5 h |
| 2 | 서버 `POST /sets/buy-and-install` + 환불 로직 | 2 h |
| 3 | 프론트 UI + API 연결 | 2.5 h |
| 4 | OWNED 뱃지 | 30 min |
| 5 | QA + 데모 | 1.5 h |
| **총** | | **8.75 h** |

서버 먼저, 프론트 나중 — 데이터 모델 확정 후 UI 구현.

---

## 리스크 / 롤백 플랜

- **Phase 0 DB FK 제약이 완고** → seed 대신 provenance 테이블에 concept_id nullable 로 임시 완화 (별도 migration)
- **credits.refund 구현 시간 초과** → Phase 2 에서 환불 생략, 부분 실패 시 사용자에 "환불 문의" 안내만
- **서버 session mirror 데이터 drift** → Phase 1-1 의 `SERVER_INVENTORY_MIRROR` 는 임시. 장기적으로 `apps/shared/` 패키지 또는 DB 테이블로 이관
