# Agent Trade — Implementation Guide (Lean)

> diff + 구매만. 캐시·메타 부풀리기 다 뺌.

---

## Phase 1 — skill-classifier (15 min)

`apps/api/src/modules/kaas/shop/skill-classifier.ts`

```typescript
import { resolveShopSet } from './shop-sets.registry'

export type SkillKind = 'set' | 'concept' | 'card' | 'unknown'

export interface ClassifiedSkill {
  slug: string
  kind: SkillKind
  title: string
  summary: string
  buyable?: {
    endpoint: 'shop/buy-and-install' | 'purchase'
    price: number
    body: Record<string, unknown>  // api_key/chain 은 호출 시 추가
  }
}

const UUID_V7_RE = /^019[a-f0-9]{29}$/

export function classifySlug(slug: string): ClassifiedSkill {
  // 1. Shop set
  if (slug.startsWith('set-')) {
    const set = resolveShopSet(slug)
    if (set) {
      return {
        slug, kind: 'set', title: set.title, summary: set.subtitle,
        buyable: {
          endpoint: 'shop/buy-and-install',
          price: set.priceBundled,
          body: { set_id: slug },
        },
      }
    }
  }
  // 2. Knowledge concept (UUID)
  if (UUID_V7_RE.test(slug)) {
    return {
      slug, kind: 'concept', title: slug, summary: '',
      buyable: { endpoint: 'purchase', price: 20, body: { concept_id: slug } },
    }
  }
  // 3. Workshop card — 표시만
  if (/^(p|s|m|me|o)-|^build-meta$/.test(slug)) {
    return { slug, kind: 'card', title: slug, summary: '' }
  }
  return { slug, kind: 'unknown', title: slug, summary: '' }
}
```

> 컨셉 메타(title/summary/price)는 Phase 2 에서 catalog 호출로 채움.

---

## Phase 2 — AgentTradeService + Controller (1h)

`agent-trade.service.ts`:

```typescript
@Injectable()
export class AgentTradeService {
  constructor(
    private readonly agents: KaasAgentService,
    private readonly ws: KaasWsGateway,
    private readonly catalog: KaasKnowledgeService,
  ) {}

  async listAgents(excludeApiKey?: string) {
    const all = await this.agents.findAllActive()
    const me = excludeApiKey ? await this.agents.findByApiKey(excludeApiKey) : null
    return all
      .filter((a) => !me || a.id !== me.id)
      .map((a) => ({ id: a.id, name: a.name }))
  }

  async diff(targetAgentId: string, myApiKey: string) {
    const me = await this.agents.findByApiKey(myApiKey)
    if (!me) throw new HttpException({ code: 'AGENT_NOT_FOUND' }, 401)
    const them = await this.agents.findById(targetAgentId)
    if (!them) throw new HttpException({ code: 'TARGET_NOT_FOUND' }, 404)

    const [mine, theirs] = await Promise.all([
      this.fetchSkills(me.id),
      this.fetchSkills(them.id),
    ])
    const mineSet = new Set(mine), theirsSet = new Set(theirs)
    const both = [...mineSet].filter((s) => theirsSet.has(s))
    const onlyMine = [...mineSet].filter((s) => !theirsSet.has(s))
    const onlyTheirs = [...theirsSet].filter((s) => !mineSet.has(s))

    return {
      both: await this.classifyAll(both),
      onlyMine: await this.classifyAll(onlyMine),
      onlyTheirs: await this.classifyAll(onlyTheirs),
    }
  }

  private async fetchSkills(agentId: string): Promise<string[]> {
    if (!this.ws.isAgentConnected(agentId)) return []
    const r = await this.ws.requestSelfReport(agentId).catch(() => null)
    const items = r?.report?.local_skills?.items ?? []
    return items
      .filter((it: any) => it?.hasSkillMd)
      .map((it: any) => String(it.dir ?? '').split(/[\\/]/).filter(Boolean).pop() ?? '')
      .filter((f: string) => f.startsWith('cherry-'))
      .map((f: string) => f.slice(7))
  }

  private async classifyAll(slugs: string[]): Promise<ClassifiedSkill[]> {
    const out: ClassifiedSkill[] = []
    for (const s of slugs) {
      const c = classifySlug(s)
      if (c.kind === 'concept') {
        const concept = await this.catalog.findById(c.slug).catch(() => null)
        if (concept) {
          c.title = concept.title
          c.summary = concept.summary ?? ''
          if (c.buyable) c.buyable.price = concept.priceCredits ?? 20
        }
      }
      out.push(c)
    }
    return out
  }
}
```

`agent-trade.controller.ts`:

```typescript
@Controller('v1/kaas/shop/agents')
export class AgentTradeController {
  constructor(private readonly svc: AgentTradeService) {}

  @Get()
  list(@Query('exclude_self') excludeSelf?: string) {
    return this.svc.listAgents(excludeSelf)
  }

  @Get(':id/diff')
  diff(@Param('id') id: string, @Query('vs_api_key') myKey: string) {
    if (!myKey) throw new HttpException({ code: 'BAD_REQUEST' }, 400)
    return this.svc.diff(id, myKey)
  }
}
```

`kaas.module.ts` 에 controller + service 등록.

---

## Phase 3 — 프론트 (1.5h)

### `lib/api.ts`

```typescript
export interface ClassifiedSkill {
  slug: string
  kind: 'set' | 'concept' | 'card' | 'unknown'
  title: string
  summary: string
  buyable?: { endpoint: string; price: number; body: Record<string, unknown> }
}
export interface AgentDiff {
  both: ClassifiedSkill[]
  onlyMine: ClassifiedSkill[]
  onlyTheirs: ClassifiedSkill[]
}
export async function fetchShopAgents(myApiKey?: string) {
  const u = new URL(`${KAAS_BASE}/shop/agents`)
  if (myApiKey) u.searchParams.set('exclude_self', myApiKey)
  const r = await fetch(u, { cache: 'no-store' })
  if (!r.ok) throw new Error(`fetchShopAgents ${r.status}`)
  return r.json() as Promise<{ id: string; name: string }[]>
}
export async function fetchAgentDiff(targetId: string, myKey: string) {
  const u = new URL(`${KAAS_BASE}/shop/agents/${targetId}/diff`)
  u.searchParams.set('vs_api_key', myKey)
  const r = await fetch(u, { cache: 'no-store' })
  if (!r.ok) throw new Error(`fetchAgentDiff ${r.status}`)
  return r.json() as Promise<AgentDiff>
}
```

### `shop/page.tsx` — 큰 탭 3번째 추가

```tsx
type RootTab = 'domain' | 'component' | 'agent'
// RootTabButton 'By Agent' 추가
{root === 'agent' && <ShopByAgent />}
```

### `shop-by-agent.tsx`

```tsx
export function ShopByAgent() {
  const [agents, setAgents] = useState<PurchaseAgent[]>([])
  const [myAgent, setMyAgent] = useState<PurchaseAgent | null>(null)
  const [others, setOthers] = useState<{ id: string; name: string }[]>([])
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const token = useToken()

  useEffect(() => {
    if (!token) return
    fetchAgents().then((d) => {
      setAgents(d as any)
      if (d?.[0]) setMyAgent(d[0] as any)
    }).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!myAgent) return
    fetchShopAgents(myAgent.api_key).then(setOthers).catch(() => setOthers([]))
  }, [myAgent?.id])

  return (
    <div>
      <div className="mb-4 text-[12px] text-[#6B4F2A]">
        Compare from: <select value={myAgent?.id ?? ''} onChange={...}>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {others.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-4">
            <div className="font-bold text-[#3A2A1C]">{a.name}</div>
            <button onClick={() => setTarget(a)} className="mt-2 ...">Compare →</button>
          </div>
        ))}
      </div>
      {target && myAgent && (
        <ShopAgentDiffModal target={target} myAgent={myAgent}
          onClose={() => setTarget(null)} />
      )}
    </div>
  )
}
```

### `shop-agent-diff-modal.tsx`

```tsx
export function ShopAgentDiffModal({ target, myAgent, onClose }: Props) {
  const [diff, setDiff] = useState<AgentDiff | null>(null)
  const [buyTarget, setBuyTarget] = useState<PurchaseTarget | null>(null)

  function reload() {
    fetchAgentDiff(target.id, myAgent.api_key).then(setDiff).catch(() => {})
  }
  useEffect(() => { reload() }, [target.id])
  useEffect(() => {
    const h = () => reload()
    window.addEventListener('kaas-purchase-complete', h)
    return () => window.removeEventListener('kaas-purchase-complete', h)
  }, [target.id])

  function buy(item: ClassifiedSkill) {
    if (!item.buyable) return
    if (item.kind === 'set') {
      const set = SHOP_SETS_CACHE.find((s) => s.id === item.slug)  // 또는 fetchShopSets()
      setBuyTarget({
        conceptId: item.slug, conceptTitle: item.title,
        creditsBase: item.buyable.price, shopSet: set,
      })
    } else if (item.kind === 'concept') {
      setBuyTarget({
        conceptId: item.slug, conceptTitle: item.title,
        creditsBase: item.buyable.price,
      })
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2>{target.name} · Knowledge Diff</h2>
      {!diff ? <p>Loading…</p> : (
        <>
          <Section title={`Both have (${diff.both.length})`} items={diff.both} />
          <Section title={`Only ${target.name} has (${diff.onlyTheirs.length})`}
                   items={diff.onlyTheirs} onBuy={buy} />
          <Section title={`Only my agent has (${diff.onlyMine.length})`}
                   items={diff.onlyMine} />
        </>
      )}
      <PurchaseModal action="purchase" target={buyTarget}
        agents={[myAgent]} defaultAgentId={myAgent.id}
        onClose={() => setBuyTarget(null)}
        onSuccess={() =>
          window.dispatchEvent(new CustomEvent('kaas-purchase-complete'))
        }
      />
    </Modal>
  )
}

function Section({ title, items, onBuy }: { ... }) {
  return (
    <section className="mb-4">
      <h3 className="text-[12px] font-bold text-[#9A7C55] mb-2">{title}</h3>
      {items.length === 0 ? <p className="italic text-[11px] text-[#B8A788]">none</p> : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.slug} className="flex items-center justify-between rounded-md p-2 bg-[#FBF6ED] border">
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-[#3A2A1C] truncate">{it.title}</div>
                <div className="text-[10px] text-[#9A7C55] truncate">{it.kind} · {it.slug}</div>
              </div>
              {onBuy && it.buyable && (
                <button onClick={() => onBuy(it)} className="...">Buy {it.buyable.price}cr</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

---

## Phase 4 — QA (30 min)

`3-checklist-table.md` 참조. 핵심만:

- 큰 탭 3개 보임
- My agent 셀렉터 동작
- Compare → diff 모달 3섹션
- Only Theirs 의 set Buy → PurchaseModal 정상
- Only Theirs 의 concept Buy → PurchaseModal 정상
- 구매 후 항목이 Both 로 이동

---

## 작업 순서 + 시간

| Phase | 작업 | 시간 |
|-------|------|------|
| 1 | skill-classifier | 15 min |
| 2 | service + controller + 모듈 등록 | 1 h |
| 3 | 프론트 (탭/카드/모달) | 1.5 h |
| 4 | QA | 30 min |
| | **총** | **~3.25 h** |
