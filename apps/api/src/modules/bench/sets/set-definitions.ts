/**
 * Cherry Bench — the 3 demo sets.
 *
 * Each set is a fixed, rehearsed benchmark: task prompt, build config
 * (system prompt + tools + skill labels + memory mode), and eval
 * criteria needed to score baseline vs enhanced.
 *
 * IMPORTANT: the task strings and system prompts below are frozen by the
 * plan in `apps/docs/bench/1-work-guidelines.md §4`. Do not edit without
 * updating the plan doc.
 */

/** Anthropic tool schema subset we need */
export interface AnthropicToolSchema {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string; enum?: string[] }>
    required: string[]
  }
}

/** Per-set eval criteria — consumed by evaluators */
export interface Set1OracleCriteria {
  kind: 'oracle'
  /** Symbols the task is about — used to fetch ground-truth prices */
  symbols: Array<{ symbol: string; coingeckoId: string }>
  /** A claimed price within ±5% of truth counts as "grounded" */
  priceTolerancePct: number
}

export interface Set2HunterCriteria {
  kind: 'hunter'
  /** Top-3 listing ids (by price asc) that must appear in enhanced JSON */
  expectedIds: string[]
  /** Required JSON fields */
  requiredFields: string[]
  /** Filter conditions the task imposes */
  filter: { brand: string; model: string; maxPrice: number; sealedOnly: true }
}

export interface Set3PolicyCriteria {
  kind: 'policy'
  /** Doc IDs the answer must cite */
  expectedDocIds: string[]
  /** Key factual tokens the answer must contain */
  keyFacts: Array<{ id: string; regex: string; description: string }>
}

/* ══ Phase 2 new criteria kinds ══ */

export interface Set4QuantCriteria {
  kind: 'quant-multi'
  symbols: string[] // e.g. ["BTC","ETH","SOL"]
}

export interface Set5StrictHunterCriteria {
  kind: 'strict-hunter'
  expectedIds: string[] // clean top-3 by price
  requiredFields: string[]
  filter: { brand: string; model: string; maxPrice: number; sealedOnly: true }
  sellerBlocklist: string[] // regex fragments e.g. ["refurb","used"]
}

export interface Set6GroundedCriteria {
  kind: 'grounded-abstain'
  expectedDocIds: string[]
  keyFacts: Array<{ id: string; regex: string; description: string }>
  /** Fields the well-equipped build should flag with `missing: <field>` */
  expectedMissing: string[]
}

export type EvalCriteria =
  | Set1OracleCriteria
  | Set2HunterCriteria
  | Set3PolicyCriteria
  | Set4QuantCriteria
  | Set5StrictHunterCriteria
  | Set6GroundedCriteria

export type MemoryMode = 'none' | 'short' | 'retrieval'

export type BenchSetId =
  | 'set-1-oracle'
  | 'set-2-hunter'
  | 'set-3-policy'
  | 'set-4-quant'
  | 'set-5-strict-hunter'
  | 'set-6-grounded'

export interface BenchSetDefinition {
  id: BenchSetId
  name: string
  tabLabel: string
  subtitle: string
  skills: string[]
  memoryMode: MemoryMode
  /** User-facing task — the ONLY message sent to Claude */
  task: string
  /** System prompt used for the enhanced call (baseline sends none) */
  systemPrompt: string
  /** Tool schemas exposed to the enhanced Claude call */
  tools: AnthropicToolSchema[]
  /** Evaluator id → dispatched in bench.service */
  evaluatorId: BenchSetId
  /** Structured eval criteria */
  evalCriteria: EvalCriteria
}

/* ══════════════════════════════════════════════════════════════════
   SET 1 — Market Oracle (real-time factual grounding)
   ════════════════════════════════════════════════════════════════ */

const SET_1_ORACLE: BenchSetDefinition = {
  id: 'set-1-oracle',
  name: 'Market Oracle',
  tabLabel: 'Market Oracle',
  subtitle:
    'Baseline Claude has no live data and confabulates prices. The build reads CoinGecko in real time.',
  skills: ['Real-time Market Analysis', 'Citation Discipline'],
  memoryMode: 'short',
  task: `What is BTC's price right now and the 24h change? Should I sell 0.5 BTC today? Back every numeric claim with the fetched data and include a timestamp.`,
  systemPrompt: `You are a crypto market analyst. Always cite current prices with a timestamp and source name. Never guess — if you do not have a tool result, say so.`,
  tools: [
    {
      name: 'get_crypto_price',
      description:
        "Fetch the current USD price and 24h percent change for a cryptocurrency from CoinGecko. Returns { symbol, priceUsd, change24hPct, fetchedAt }.",
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: "Ticker symbol, e.g. 'BTC', 'ETH'.",
          },
        },
        required: ['symbol'],
      },
    },
  ],
  evaluatorId: 'set-1-oracle',
  evalCriteria: {
    kind: 'oracle',
    symbols: [{ symbol: 'BTC', coingeckoId: 'bitcoin' }],
    priceTolerancePct: 5,
  },
}

/* ══════════════════════════════════════════════════════════════════
   SET 2 — Marketplace Hunter (structured extraction + private data)
   ════════════════════════════════════════════════════════════════ */

const SET_2_HUNTER: BenchSetDefinition = {
  id: 'set-2-hunter',
  name: 'Marketplace Hunter',
  tabLabel: 'Marketplace Hunter',
  subtitle:
    'Baseline fabricates listings. The build queries the seeded marketplace DB and returns valid JSON.',
  skills: ['Deal Analysis', 'Bargain Recognition', 'Structured Output'],
  memoryMode: 'none',
  task: `Find the 3 cheapest LG Gram 16-inch laptops under $700, sealed only. Return JSON.`,
  systemPrompt: `You are a deal-hunting assistant. Return exactly 3 listings as a valid JSON array: [{id, title, price, seller, posted_at}]. Use only the search tool — do not invent listings. Output ONLY the JSON array, no prose before or after.`,
  tools: [
    {
      name: 'search_marketplace',
      description:
        'Search the internal marketplace for listings matching a query and filters. Returns { listings: [{id, title, price, seller, posted_at, sealed, brand, model}] }.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "Free-text query, e.g. 'LG Gram 16'.",
          },
          max_price: {
            type: 'number',
            description: 'Upper bound (exclusive) on price in USD.',
          },
          sealed_only: {
            type: 'boolean',
            description: 'If true, only return sealed items.',
          },
        },
        required: ['query'],
      },
    },
  ],
  evaluatorId: 'set-2-hunter',
  evalCriteria: {
    kind: 'hunter',
    expectedIds: ['gram-01', 'gram-02', 'gram-03'],
    requiredFields: ['id', 'title', 'price', 'seller', 'posted_at'],
    filter: {
      brand: 'LG',
      model: 'Gram 16',
      maxPrice: 700,
      sealedOnly: true,
    },
  },
}

/* ══════════════════════════════════════════════════════════════════
   SET 3 — Policy Expert (domain grounding + citation)
   ════════════════════════════════════════════════════════════════ */

const SET_3_POLICY: BenchSetDefinition = {
  id: 'set-3-policy',
  name: 'Cherry Policy Expert',
  tabLabel: 'Policy Expert',
  subtitle:
    "Baseline invents policy details the model never saw in training. The build retrieves real Cherry docs.",
  skills: ['Cherry Domain Expert', 'Citation Discipline', 'Abstention'],
  memoryMode: 'retrieval',
  task: `How does Cherry's Karma tier system reward Platinum curators versus Bronze? Be specific about reward percentages and cite doc IDs.`,
  systemPrompt: `Answer only using retrieved Cherry docs. Cite doc IDs in brackets like [doc:karma-v2]. If the answer is not in retrieved docs, respond exactly: "I don't have that information."`,
  tools: [
    {
      name: 'search_catalog',
      description:
        'Search the Cherry internal doc catalog. Returns { docs: [{ id, content }] }.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              "Search query, e.g. 'karma tier reward percentages'.",
          },
          limit: {
            type: 'number',
            description: 'Max number of docs to return. Default 3.',
          },
        },
        required: ['query'],
      },
    },
  ],
  evaluatorId: 'set-3-policy',
  evalCriteria: {
    kind: 'policy',
    expectedDocIds: ['karma-v2'],
    keyFacts: [
      {
        id: 'platinum-70',
        // "70%" or "70 %" tolerated
        regex: '70\\s*%',
        description: 'Platinum revenue share is 70%',
      },
      {
        id: 'bronze-30',
        regex: '30\\s*%',
        description: 'Bronze revenue share is 30%',
      },
    ],
  },
}

/* ══════════════════════════════════════════════════════════════════
   SET 4 — Multi-Asset Crypto Analyst (Phase 2, 7-slot)
   ════════════════════════════════════════════════════════════════ */

const SET_4_QUANT: BenchSetDefinition = {
  id: 'set-4-quant',
  name: 'Multi-Asset Crypto Analyst',
  tabLabel: 'Quant Analyst',
  subtitle:
    'Multi-tool fetches + structured JSON + arithmetic. Requires Plan-and-Execute to cover all 3 assets reliably.',
  skills: ['Multi-step Decomposition', 'JSON Strict', 'Citation Discipline'],
  memoryMode: 'short',
  task: `Get current USD price and 24h % change for BTC, ETH, and SOL. Pick the one with the largest absolute 24h movement. Output JSON: {"assets":[{"sym","price","change24h","captured_at","source"}], "biggest_mover":{"sym","abs_change_pct"}}. Cite timestamp + source per asset.`,
  systemPrompt: `You are a quantitative crypto analyst. Given multiple assets, fetch each price, compare movements, and return a single JSON object with fields {assets, biggest_mover}. Cite the timestamp and source for every numeric claim.`,
  tools: [
    {
      name: 'get_crypto_price',
      description:
        'Fetch the current USD price and 24h percent change for a cryptocurrency from CoinGecko. Returns { symbol, priceUsd, change24hPct, fetchedAt }.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: "Ticker symbol, e.g. 'BTC', 'ETH'.",
          },
        },
        required: ['symbol'],
      },
    },
  ],
  evaluatorId: 'set-4-quant',
  evalCriteria: {
    kind: 'quant-multi',
    symbols: ['BTC', 'ETH', 'SOL'],
  },
}

/* ══════════════════════════════════════════════════════════════════
   SET 5 — Constrained Deal Hunter (Phase 2, 7-slot)
   ════════════════════════════════════════════════════════════════ */

const SET_5_STRICT_HUNTER: BenchSetDefinition = {
  id: 'set-5-strict-hunter',
  name: 'Constrained Deal Hunter',
  tabLabel: 'Strict Hunter',
  subtitle:
    "Basic sealed_only filter isn't enough — 3 trap records slip through. Needs Constraint-Satisfaction + Self-Validation + Self-Repair.",
  skills: [
    'Constraint Satisfaction',
    'JSON Strict',
    'Self-Validation',
  ],
  memoryMode: 'none',
  task: `Find the 3 cheapest LG Gram 16-inch laptops under $700 that are sealed AND whose seller name does NOT contain 'refurb' or 'used'. Return JSON array [{id, title, price, seller, posted_at}]. If fewer than 3 qualify, return only those. Do NOT invent.`,
  systemPrompt: `You are a strict deal-hunting assistant. Return exactly the requested number of listings as a JSON array. Apply every stated filter. Never invent listings — use only the search tool output. No prose outside the JSON.`,
  tools: [
    {
      name: 'search_marketplace',
      description:
        'Search the internal marketplace for listings matching a query and filters. Returns { listings: [{id, title, price, seller, posted_at, sealed, brand, model}] }.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Free-text query, e.g. 'LG Gram 16'." },
          max_price: { type: 'number', description: 'Upper bound (exclusive) on price in USD.' },
          sealed_only: { type: 'boolean', description: 'If true, only return sealed items.' },
        },
        required: ['query'],
      },
    },
  ],
  evaluatorId: 'set-5-strict-hunter',
  evalCriteria: {
    kind: 'strict-hunter',
    expectedIds: ['gram-01', 'gram-02', 'gram-03'],
    requiredFields: ['id', 'title', 'price', 'seller', 'posted_at'],
    filter: { brand: 'LG', model: 'Gram 16', maxPrice: 700, sealedOnly: true },
    sellerBlocklist: ['refurb', 'used'],
  },
}

/* ══════════════════════════════════════════════════════════════════
   SET 6 — Grounded Policy Analyst (abstention test, Phase 2, 7-slot)
   ════════════════════════════════════════════════════════════════ */

const SET_6_GROUNDED: BenchSetDefinition = {
  id: 'set-6-grounded',
  name: 'Grounded Policy Analyst',
  tabLabel: 'Grounded Researcher',
  subtitle:
    'Only revenue % is in the doc; monthly contribution and perks are intentionally missing. Abstention skill forces the build to flag them instead of guessing.',
  skills: ['Multi-hop Retrieval', 'Citation Discipline', 'Abstention'],
  memoryMode: 'retrieval',
  task: `For Cherry's Karma tiers, report for BOTH Platinum and Bronze: (1) revenue share %, (2) minimum monthly contribution to qualify, (3) tier-exclusive perks. Compute revenue share gap (Platinum − Bronze) in pp. Cite doc IDs per fact. For any field NOT in retrieved docs, output 'missing: <field>' — do NOT guess.`,
  systemPrompt: `You are a grounded researcher. Retrieve relevant docs before answering. Cite doc IDs in brackets like [doc:xxx] for every claim. If a requested field is not in retrieved docs, respond exactly "missing: <field>" — never guess.`,
  tools: [
    {
      name: 'search_catalog',
      description:
        'Search the Cherry internal doc catalog. Returns { docs: [{ id, content }] }.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Search query, e.g. 'karma tier reward percentages'." },
          limit: { type: 'number', description: 'Max number of docs to return. Default 3.' },
        },
        required: ['query'],
      },
    },
  ],
  evaluatorId: 'set-6-grounded',
  evalCriteria: {
    kind: 'grounded-abstain',
    expectedDocIds: ['karma-v2'],
    keyFacts: [
      {
        id: 'platinum-70',
        regex: '70\\s*%',
        description: 'Platinum revenue share is 70%',
      },
      {
        id: 'bronze-30',
        regex: '30\\s*%',
        description: 'Bronze revenue share is 30%',
      },
    ],
    expectedMissing: ['monthly contribution', 'perks'],
  },
}

/* ══════════════════════════════════════════════════════════════════
   Registry
   ════════════════════════════════════════════════════════════════ */

export const BENCH_SETS: BenchSetDefinition[] = [
  SET_1_ORACLE,
  SET_2_HUNTER,
  SET_3_POLICY,
  SET_4_QUANT,
  SET_5_STRICT_HUNTER,
  SET_6_GROUNDED,
]

export function getSetById(
  id: string,
): BenchSetDefinition | undefined {
  return BENCH_SETS.find((s) => s.id === id)
}

/** Summary shape returned by GET /v1/kaas/bench/sets (UI chrome only) */
export interface BenchSetSummary {
  id: string
  name: string
  tabLabel: string
  subtitle: string
  skills: string[]
  toolNames: string[]
  memoryMode: MemoryMode
  task: string
}

export function summarizeSet(s: BenchSetDefinition): BenchSetSummary {
  return {
    id: s.id,
    name: s.name,
    tabLabel: s.tabLabel,
    subtitle: s.subtitle,
    skills: s.skills,
    toolNames: s.tools.map((t) => t.name),
    memoryMode: s.memoryMode,
    task: s.task,
  }
}
