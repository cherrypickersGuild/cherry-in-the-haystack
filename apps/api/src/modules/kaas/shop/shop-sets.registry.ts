/**
 * Shop set registry — the single source of truth for which Workshop cards
 * make up each domain-level "ready-made AI" bundle.
 *
 * The frontend (`/start/shop`) consumes this via `GET /v1/kaas/shop/sets`;
 * both sides then use the same IDs, titles, and pricing.
 *
 * Derivation rule: a card belongs to a domain when its `setTag` array
 * includes the domain name. Adding a card to `SERVER_INVENTORY_MIRROR`
 * and tagging it flows straight into Shop. No duplicate wiring.
 *
 * NOTE: `SERVER_INVENTORY_MIRROR` must match `apps/web/lib/workshop-mock.ts`
 * `mockInventory`. When inventory drifts, this registry is the canonical
 * side for Shop; Workshop is the canonical side for local assembly.
 * A later refactor can unify via a `packages/inventory` shared package.
 */

import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

export interface ShopSetComponent {
  slot: string // 'prompt' | 'mcp' | 'skillA' | 'skillB' | 'skillC' | 'orchestration' | 'memory'
  cardId: string
  type: string // 'prompt' | 'mcp' | 'skill' | 'orchestration' | 'memory'
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
  qualityScore: number
  installs: number
  components: ShopSetComponent[]
}

// ── Mirror of apps/web/lib/workshop-mock.ts mockInventory ───────────
interface InventoryEntry {
  id: string
  type: 'prompt' | 'mcp' | 'skill' | 'orchestration' | 'memory'
  title: string
  summary: string
  setTag: string[]
}

const SERVER_INVENTORY_MIRROR: InventoryEntry[] = [
  // prompts
  {
    id: 'inv-p-hunter',
    type: 'prompt',
    title: 'Marketplace Hunter',
    summary:
      'Deal hunter that returns strict JSON listings; never invents records.',
    setTag: ['hunter'],
  },
  {
    id: 'inv-p-policy',
    type: 'prompt',
    title: 'Policy Expert',
    summary:
      "Answers only from retrieved Cherry docs; cites doc IDs; says \"I don't have that\" when missing.",
    setTag: ['policy'],
  },
  {
    id: 'inv-p-quant',
    type: 'prompt',
    title: 'Quantitative Analyst',
    summary:
      '3-asset analyst that fetches each price, compares movement, returns structured JSON with citations.',
    setTag: ['quant'],
  },
  {
    id: 'inv-p-grounded',
    type: 'prompt',
    title: 'Grounded Researcher',
    summary:
      "Retrieves first, cites doc IDs, flags missing fields with 'missing:<field>'.",
    setTag: ['grounded'],
  },
  {
    id: 'inv-p-writer',
    type: 'prompt',
    title: 'Writer',
    summary:
      'Sharp writing assistant — clear structure, active voice, concrete before/after edits. Never fabricates facts.',
    setTag: ['writer'],
  },
  {
    id: 'inv-p-tutor',
    type: 'prompt',
    title: 'Tutor',
    summary:
      'Patient tutor — gist + tiny example + common misconception. Always ends with one check-for-understanding question.',
    setTag: ['tutor'],
  },
  {
    id: 'inv-p-scribe',
    type: 'prompt',
    title: 'Scribe',
    summary:
      'Document summarizer — bullet key points, list open questions, cite sources with [doc:<id>]. Refuses to invent quotes.',
    setTag: ['scribe'],
  },
  // mcp
  {
    id: 'inv-m-crypto',
    type: 'mcp',
    title: 'Crypto Price',
    summary: 'Live crypto prices via CoinGecko. Tool: get_crypto_price(symbol).',
    setTag: ['quant'],
  },
  {
    id: 'inv-m-market',
    type: 'mcp',
    title: 'Marketplace Search',
    summary:
      'Internal marketplace DB. Tool: search_marketplace(query, max_price, sealed_only).',
    setTag: ['hunter'],
  },
  {
    id: 'inv-m-catalog',
    type: 'mcp',
    title: 'Cherry Catalog',
    summary:
      'Cherry internal policy docs. Tool: search_catalog(query, limit).',
    setTag: ['policy', 'grounded', 'scribe'],
  },
  // skills
  {
    id: 'inv-s-decomp',
    type: 'skill',
    title: 'Multi-step Decomposition',
    summary:
      'Break the task into explicit subtasks and address each before synthesizing.',
    setTag: ['quant', 'tutor'],
  },
  {
    id: 'inv-s-json-strict',
    type: 'skill',
    title: 'JSON Strict',
    summary:
      'Output ONLY valid JSON matching the requested schema. No prose.',
    setTag: ['quant'],
  },
  {
    id: 'inv-s-citation',
    type: 'skill',
    title: 'Citation Discipline',
    summary: 'Every factual claim carries an inline source or citation.',
    setTag: ['quant', 'grounded', 'scribe'],
  },
  {
    id: 'inv-s-multihop',
    type: 'skill',
    title: 'Multi-hop Retrieval',
    summary:
      "Decompose queries and issue multiple retrievals when a single search isn't enough.",
    setTag: ['grounded'],
  },
  {
    id: 'inv-s-abstention',
    type: 'skill',
    title: 'Abstention',
    summary:
      "If a required field is missing from retrieved content, output 'missing: <field>' — never guess.",
    setTag: ['grounded'],
  },
  // orchestration
  {
    id: 'inv-o-standard',
    type: 'orchestration',
    title: 'Standard Loop',
    summary:
      'Default ReAct-style tool-use loop. Included for UX completeness.',
    setTag: [],
  },
  {
    id: 'inv-o-plan-execute',
    type: 'orchestration',
    title: 'Plan-and-Execute',
    summary:
      'Two-phase call: first produce a plan (no tools), then execute the plan with tools.',
    setTag: ['quant', 'grounded', 'scribe'],
  },
  // memory
  {
    id: 'inv-me-none',
    type: 'memory',
    title: 'Stateless',
    summary: 'No retention — each turn starts fresh.',
    setTag: ['hunter'],
  },
  {
    id: 'inv-me-short',
    type: 'memory',
    title: 'Short-term',
    summary: 'Full conversation context preserved within the session.',
    setTag: ['writer', 'tutor'],
  },
  {
    id: 'inv-me-retrieval',
    type: 'memory',
    title: 'Retrieval buffer',
    summary: 'Retrieved tool results stay available across turns.',
    setTag: ['policy', 'scribe'],
  },
]

const DOMAIN_META: Record<
  string,
  { title: string; subtitle: string; icon: string }
> = {
  hunter: {
    title: 'Shopping AI',
    subtitle: 'Marketplace deal hunter',
    icon: '🛍',
  },
  quant: {
    title: 'Quant AI',
    subtitle: 'Multi-asset crypto analyst',
    icon: '💹',
  },
  grounded: {
    title: 'Research AI',
    subtitle: 'Cite-every-fact researcher',
    icon: '📚',
  },
  policy: {
    title: 'Policy AI',
    subtitle: 'Cherry docs expert',
    icon: '📜',
  },
  writer: {
    title: 'Writer AI',
    subtitle: 'Sharp editor — clarity, active voice, no fabrication',
    icon: '✎',
  },
  tutor: {
    title: 'Tutor AI',
    subtitle: 'Patient explainer — gist, example, misconception, check',
    icon: '◈',
  },
  scribe: {
    title: 'Scribe AI',
    subtitle: 'Document summarizer — bullets, open questions, citations',
    icon: '✦',
  },
}

// Tier-based pricing so Hunter (3 slots) and Quant (7) don't drift
// 5× in price. Adjust as credits economy evolves.
function priceForSlots(n: number): number {
  if (n <= 3) return 60
  if (n <= 5) return 90
  return 120
}

function equippedForDomain(tag: string): AgentBuildInput {
  const inv = SERVER_INVENTORY_MIRROR
  const first = (t: string): string | null =>
    inv.find((i) => i.type === t && i.setTag.includes(tag))?.id ?? null
  const skills = inv
    .filter((i) => i.type === 'skill' && i.setTag.includes(tag))
    .slice(0, 3)
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

function componentsFor(equipped: AgentBuildInput): ShopSetComponent[] {
  const out: ShopSetComponent[] = []
  const slots: Array<keyof AgentBuildInput> = [
    'prompt',
    'mcp',
    'skillA',
    'skillB',
    'skillC',
    'orchestration',
    'memory',
  ]
  for (const slot of slots) {
    const cardId = equipped[slot]
    if (!cardId) continue
    const item = SERVER_INVENTORY_MIRROR.find((i) => i.id === cardId)
    if (!item) continue
    out.push({
      slot,
      cardId,
      type: item.type,
      title: item.title,
      summary: item.summary,
    })
  }
  return out
}

export const SHOP_SETS: ShopSet[] = Object.keys(DOMAIN_META).map((tag) => {
  const equipped = equippedForDomain(tag)
  const components = componentsFor(equipped)
  const slotCount = components.length
  return {
    id: `set-${tag}`,
    domain: tag,
    ...DOMAIN_META[tag],
    equipped,
    slotCount,
    priceBundled: priceForSlots(slotCount),
    qualityScore: 4.6,
    // Install count is illustrative — swap for a real metric once we have one.
    installs: 100 + tag.length * 37,
    components,
  }
})

export function resolveShopSet(setId: string): ShopSet | null {
  return SHOP_SETS.find((s) => s.id === setId) ?? null
}
