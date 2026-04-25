import { API_URL, fetchWithAuth } from "./auth"

export { API_URL }

export interface PatchNoteItem {
  id: string
  articleStateId: string
  date: string
  page: string
  area: string
  categoryName: string
  dotColor: string
  entityName: string
  title: string
  oneLiner: string
  score: number
  isRead: boolean
  sideCategory: string | null
}

export interface PatchNotesResponse {
  items: PatchNoteItem[]
  stats: {
    totalUpdates: number
    score5Items: number
    newFrameworks: number
    regulatory: number
  }
  areas: number
  period: { from: string; to: string }
}

export async function fetchPatchNotes(): Promise<PatchNotesResponse> {
  const res = await fetch(`${API_URL}/api/patch-notes`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch patch notes")
  return res.json()
}

export async function markArticleRead(articleStateId: string): Promise<void> {
  await fetch(`${API_URL}/api/patch-notes/${articleStateId}/read`, {
    method: "PATCH",
  })
}

export interface ModelUpdatesRankItem {
  rank: number
  prev_rank: number | null
  article_count: number
  prev_article_count: number
  change_pct: string | null
  top_entities_json: { id: string; name: string; article_count: number }[]
  category_name: string
}

export interface ModelUpdatesRisingstar {
  categoryName: string
  isNew: boolean
  changePct: string | null
  articleCount: number
  topEntities: { id: string; name: string; article_count: number }[]
}

export interface ModelUpdatesRankResponse {
  statDate: string
  weekStart: string
  weekEnd: string
  ranks: ModelUpdatesRankItem[]
  risingStars: ModelUpdatesRisingstar[]
}

export async function fetchModelUpdatesRank(): Promise<ModelUpdatesRankResponse> {
  const res = await fetch(`${API_URL}/api/stats/model-updates-rank`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch model updates rank")
  return res.json()
}

export interface FrameworkEntityItem {
  id: string
  name: string
  url: string | null
  isSpotlight: boolean
}

export interface FrameworkCategoryItem {
  id: string
  code: string
  name: string
  sortOrder: number
  entities: FrameworkEntityItem[]
}

export interface FrameworksRisingstar {
  categoryName: string
  isNew: boolean
  changePct: string | null
  articleCount: number
  topEntities: { id: string; name: string; article_count: number }[]
}

export interface FrameworksArticleItem {
  id: string
  articleStateId: string
  title: string
  oneLiner: string
  entityName: string
  categoryName: string
  score: number
  date: string
}

export interface FrameworksResponse {
  categories: FrameworkCategoryItem[]
  risingstar: FrameworksRisingstar | null
  articles: FrameworksArticleItem[]
}

export async function fetchFrameworks(): Promise<FrameworksResponse> {
  const res = await fetch(`${API_URL}/api/stats/frameworks`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch frameworks")
  return res.json()
}

export interface CaseStudyItem {
  id: string
  articleStateId: string
  title: string
  oneLiner: string
  entityName: string
  categoryName: string
  categoryCode: string
  sideCategory: string | null
  sideCategoryCode: string | null
  score: number
  date: string
}

export interface CaseStudiesCategoryGroup {
  id: string
  code: string
  name: string
  items: CaseStudyItem[]
}

export interface CaseStudiesResponse {
  groups: CaseStudiesCategoryGroup[]
  total: number
  period: { from: string; to: string }
}

export async function fetchCaseStudies(): Promise<CaseStudiesResponse> {
  const res = await fetch(`${API_URL}/api/patch-notes/case-studies`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch case studies")
  return res.json()
}

export interface LandingTreemapItem {
  page: string
  articleCount: number
  percent: number
}

export interface LandingMomentumEntity {
  entityId: string
  entityName: string
  page: string
  categoryName: string
  thisWeekCount: number
  prevWeekCount: number
  changePct: number
}

export interface LandingTopArticle {
  id: string
  title: string
  oneLiner: string
  entityName: string
  categoryName: string
  score: number
  date: string
  page: string
}

export interface LandingResponse {
  weekStart: string
  weekEnd: string
  treemap: LandingTreemapItem[]
  topMomentumEntities: LandingMomentumEntity[]
}

export interface LandingArticlesResponse {
  items: LandingTopArticle[]
}

export async function fetchLanding(): Promise<LandingResponse> {
  const res = await fetch(`${API_URL}/api/stats/landing`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch landing stats")
  return res.json()
}

export async function fetchLandingArticles(): Promise<LandingArticlesResponse> {
  const res = await fetch(`${API_URL}/api/stats/landing/articles`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch landing articles")
  return res.json()
}

/* ═══════════════════════════════════════════
   Prompt Template
═══════════════════════════════════════════ */

export interface TemplateVersion {
  id: string
  prompt_template_id: string
  version_no: number
  version_tag: string
  prompt_text: string
  few_shot_examples: string | null
  parameters_json: Record<string, unknown> | null
  change_note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PromptTemplate {
  id: string
  type: string
  scope: string
  code: string
  name: string
  description: string | null
  tone_text: string
  is_active: boolean
  created_at: string
  updated_at: string
  versions: TemplateVersion[]
}

/** 전체 템플릿 목록 (버전 포함) */
export async function fetchTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch(`${API_URL}/api/prompt-templates/list`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch templates")
  return res.json()
}

/** 템플릿 생성 (+ 초기 버전 A) */
export async function createTemplate(body: {
  type: string
  code: string
  name: string
  description?: string
  tone_text: string
  prompt_text: string
  few_shot_examples?: string
  parameters_json?: Record<string, unknown>
  change_note?: string
}): Promise<PromptTemplate[]> {
  const res = await fetch(`${API_URL}/api/prompt-templates/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create template")
  return res.json()
}

/** 템플릿 메타 수정 */
export async function updateTemplate(
  id: string,
  body: { name?: string; description?: string; tone_text?: string },
): Promise<PromptTemplate[]> {
  const res = await fetch(`${API_URL}/api/prompt-templates/${id}/patch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update template")
  return res.json()
}

/** 템플릿 소프트 삭제 */
export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/prompt-templates/${id}/delete`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete template")
}

/** 버전 추가 */
export async function addVersion(
  templateId: string,
  body: {
    prompt_text: string
    few_shot_examples?: string
    parameters_json?: Record<string, unknown>
    change_note?: string
  },
): Promise<TemplateVersion> {
  const res = await fetch(`${API_URL}/api/prompt-templates/${templateId}/add-new-versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to add version")
  return res.json()
}

/** 버전 수정 */
export async function updateVersion(
  templateId: string,
  versionId: string,
  body: {
    prompt_text?: string
    few_shot_examples?: string
    parameters_json?: Record<string, unknown>
    change_note?: string
  },
): Promise<TemplateVersion> {
  const res = await fetch(
    `${API_URL}/api/prompt-templates/${templateId}/versions/${versionId}/patch`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) throw new Error("Failed to update version")
  return res.json()
}

/** 활성 버전 지정 */
export async function activateVersion(
  templateId: string,
  versionId: string,
): Promise<TemplateVersion> {
  const res = await fetch(
    `${API_URL}/api/prompt-templates/${templateId}/versions/${versionId}/activate`,
    { method: "PATCH" },
  )
  if (!res.ok) throw new Error("Failed to activate version")
  return res.json()
}

/** 버전 소프트 삭제 */
export async function deleteVersion(templateId: string, versionId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/prompt-templates/${templateId}/versions/${versionId}/delete`,
    { method: "DELETE" },
  )
  if (!res.ok) throw new Error("Failed to delete version")
}

/* ═══════════════════════════════════════════════
   KaaS API
═══════════════════════════════════════════════ */

const KAAS_BASE = `${API_URL}/api/v1/kaas`

/** 카탈로그 — 전체 개념 목록 (Public) */
export async function fetchCatalog(q?: string, category?: string) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (category) params.set("category", category)
  const url = `${KAAS_BASE}/catalog${params.toString() ? "?" + params : ""}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch catalog")
  return res.json()
}

/** 카탈로그 — 개념 상세 */
export async function fetchConcept(conceptId: string) {
  const res = await fetch(`${KAAS_BASE}/catalog/${conceptId}`)
  if (!res.ok) throw new Error("Failed to fetch concept")
  return res.json()
}

/** 에이전트 등록 (JWT 인증 필요) */
export async function registerAgent(data: { name: string; wallet_address?: string; wallet_type?: "evm" | "near"; llm_provider?: string; llm_model?: string; llm_api_key?: string; domain_interests: string[] }) {
  const res = await fetchWithAuth(`${KAAS_BASE}/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to register agent")
  return res.json()
}

/** 에이전트 삭제 (JWT 인증 필요) */
export async function deleteAgent(agentId: string) {
  const res = await fetchWithAuth(`${KAAS_BASE}/agents/${agentId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete agent")
}

/** 에이전트 목록 (JWT 인증 필요 — 로그인 유저의 에이전트만) */
export async function fetchAgents() {
  const res = await fetchWithAuth(`${KAAS_BASE}/agents`)
  if (!res.ok) throw new Error("Failed to fetch agents")
  return res.json()
}

/** Live onchain Karma read from Status Network */
export interface OnchainKarma {
  walletAddress: string | null
  tier: "Bronze" | "Silver" | "Gold" | "Platinum"
  balance: number
  onchainTierId?: number
  onchainTierName?: string
  txPerEpoch?: number
  chain: string
  karmaContract: string | null
  karmaTiersContract: string | null
}

export async function fetchAgentKarma(agentId: string): Promise<OnchainKarma> {
  const res = await fetchWithAuth(`${KAAS_BASE}/agents/${agentId}/karma`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch onchain karma")
  return res.json()
}

/** 크레딧 잔액 */
export async function fetchBalance(apiKey: string) {
  const res = await fetch(`${KAAS_BASE}/credits/balance?api_key=${apiKey}`)
  if (!res.ok) throw new Error("Failed to fetch balance")
  return res.json()
}

/** 크레딧 충전 */
export async function depositCredits(apiKey: string, amount: number, chain?: string) {
  const res = await fetch(`${KAAS_BASE}/credits/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, api_key: apiKey, chain }),
  })
  if (!res.ok) throw new Error("Failed to deposit")
  return res.json()
}

/**
 * 구매 — chain 지정 시 해당 체인에 온체인 기록 (status | near)
 * opts.preSignedTx 제공 시 서버는 온체인 서명을 생략하고 해당 hash를 그대로 저장 (NEAR 유저-직접-서명용).
 */
export async function purchaseConcept(
  apiKey: string,
  conceptId: string,
  chain?: "status" | "near" | "mock",
  opts?: { preSignedTx?: string; privacyMode?: boolean },
) {
  const res = await fetch(`${KAAS_BASE}/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concept_id: conceptId,
      api_key: apiKey,
      ...(chain ? { chain } : {}),
      ...(opts?.preSignedTx ? { pre_signed_tx: opts.preSignedTx } : {}),
      ...(opts?.privacyMode ? { privacy_mode: true } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.message || "Purchase failed"), { code: err.code, status: res.status })
  }
  return res.json()
}

/**
 * 팔로우 — chain 지정 시 해당 체인에 온체인 기록
 * opts.preSignedTx 제공 시 서버는 온체인 서명을 생략하고 해당 hash를 그대로 저장 (NEAR 유저-직접-서명용).
 */
export async function followConcept(
  apiKey: string,
  conceptId: string,
  chain?: "status" | "near" | "mock",
  opts?: { preSignedTx?: string; privacyMode?: boolean },
) {
  const res = await fetch(`${KAAS_BASE}/follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concept_id: conceptId,
      api_key: apiKey,
      ...(chain ? { chain } : {}),
      ...(opts?.preSignedTx ? { pre_signed_tx: opts.preSignedTx } : {}),
      ...(opts?.privacyMode ? { privacy_mode: true } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.message || "Follow failed"), { code: err.code, status: res.status })
  }
  return res.json()
}

/* ══════════════════════════════════════════════════════════════════
   Shop — consumer storefront (sets only). Mirrors
   `apps/api/src/modules/kaas/shop/` endpoints.
   ════════════════════════════════════════════════════════════════ */

export interface ShopSetComponent {
  slot: string
  cardId: string
  type: string
  title: string
  summary: string
}

export interface ShopSet {
  id: string
  domain: string
  title: string
  subtitle: string
  icon: string
  equipped: {
    prompt: string | null
    mcp: string | null
    skillA: string | null
    skillB: string | null
    skillC: string | null
    orchestration: string | null
    memory: string | null
  }
  slotCount: number
  priceBundled: number
  qualityScore: number
  installs: number
  components: ShopSetComponent[]
}

/* ══════════════════════════════════════════════════════════════════
   Agent Trade — Shop "By Agent" tab. Diff target agent's installed
   skills vs caller's, then buy any missing one for a flat 5 credits.
   Mirrors `apps/api/src/modules/kaas/shop/agent-trade.controller.ts`.
   ════════════════════════════════════════════════════════════════ */

export type AgentTradeSkillKind = "concept" | "card" | "meta" | "unknown"

export interface ClassifiedSkill {
  slug: string
  kind: AgentTradeSkillKind
  title?: string
  summary?: string
}

export interface AgentTradeDiff {
  both: ClassifiedSkill[]
  onlyMine: ClassifiedSkill[]
  onlyTheirs: ClassifiedSkill[]
}

export const AGENT_TRADE_FLAT_PRICE = 5

export async function fetchShopAgents(myApiKey?: string): Promise<{ id: string; name: string; connected: boolean }[]> {
  const u = new URL(`${KAAS_BASE}/shop/agents`)
  if (myApiKey) u.searchParams.set("exclude_self", myApiKey)
  const res = await fetch(u, { cache: "no-store" })
  if (!res.ok) throw new Error(`fetchShopAgents ${res.status}`)
  return res.json()
}

export async function fetchAgentDiff(
  targetAgentId: string,
  myApiKey: string,
): Promise<AgentTradeDiff> {
  const u = new URL(`${KAAS_BASE}/shop/agents/${encodeURIComponent(targetAgentId)}/diff`)
  u.searchParams.set("vs_api_key", myApiKey)
  const res = await fetch(u, { cache: "no-store" })
  if (!res.ok) throw new Error(`fetchAgentDiff ${res.status}`)
  return res.json()
}

export interface BuyAgentTradeSkillResponse {
  installed: boolean
  saved_path?: string
  size_bytes?: number
  credits_consumed: number
  credits_after: number
  provenance: { hash: string | null; chain: string; explorer_url: string | null; on_chain: boolean }
}

export async function buyAgentTradeSkill(
  apiKey: string,
  slug: string,
): Promise<BuyAgentTradeSkillResponse> {
  const res = await fetch(`${KAAS_BASE}/shop/agents/skills/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, api_key: apiKey }),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw Object.assign(new Error(b?.message ?? `buyAgentTradeSkill ${res.status}`), {
      code: b?.code,
      status: res.status,
    })
  }
  return res.json()
}

export interface CardSource {
  id: string
  type: "prompt" | "mcp" | "skill" | "orchestration" | "memory"
  body: string
  language: "markdown" | "json"
}

/** Read-only source for a single Workshop card (systemPrompt / promptSuffix
 *  / tool schema / memory config). Used by the Workshop card inspector. */
export async function fetchCardSource(cardId: string): Promise<CardSource> {
  const res = await fetch(
    `${KAAS_BASE}/shop/cards/${encodeURIComponent(cardId)}/source`,
    { cache: "no-store" },
  )
  if (!res.ok) throw new Error(`fetchCardSource ${res.status}`)
  return res.json()
}

export async function fetchShopSets(): Promise<ShopSet[]> {
  const res = await fetch(`${KAAS_BASE}/shop/sets`, { cache: "no-store" })
  if (!res.ok) throw new Error(`fetchShopSets ${res.status}`)
  return res.json()
}

export interface BuySetResponse {
  installed: Array<{ slot: string; card_id: string; dir: string; file: string; saved_path: string; size_bytes: number }>
  skipped: Array<{ slot: string; card_id: string | null; reason: string }>
  failed: Array<{ slot: string; card_id: string; error: string }>
  meta_written: boolean
  orphans_removed: string[]
  local_skills_after: Array<{ dir: string; hasSkillMd: boolean; sizeBytes: number; mtime: string | null }>
  warnings: string[]
  activation_prompt: string
  credits_consumed: number
  credits_after: number
  provenance: {
    hash: string | null
    chain: string
    explorer_url: string | null
    on_chain: boolean
  }
  partial: boolean
}

export async function buySet(
  apiKey: string,
  setId: string,
  chain: "status" | "near" | "mock" = "status",
): Promise<BuySetResponse> {
  const res = await fetch(`${KAAS_BASE}/shop/buy-and-install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ set_id: setId, api_key: apiKey, chain }),
  })
  // 207 Multi-Status 도 응답 파싱
  if (!res.ok && res.status !== 207) {
    const b = await res.json().catch(() => ({}))
    throw Object.assign(new Error(b?.message ?? `buySet ${res.status}`), {
      code: b?.code,
      status: res.status,
    })
  }
  return res.json()
}

/** 구매/팔로우 이력 */
export async function fetchHistory(apiKey: string) {
  const res = await fetch(`${KAAS_BASE}/credits/history?api_key=${apiKey}`)
  if (!res.ok) throw new Error("Failed to fetch history")
  return res.json()
}

/** 크레딧 Ledger (deposit + consume 원장) */
export async function fetchLedger(apiKey: string, limit = 50) {
  const res = await fetch(`${KAAS_BASE}/credits/ledger?api_key=${apiKey}&limit=${limit}`)
  if (!res.ok) throw new Error("Failed to fetch ledger")
  return res.json()
}

/** 에이전트 Self-Report (대시보드 모달용) — 에이전트가 WebSocket으로 보낸 리포트 JSON 수신 */
export async function fetchAgentSelfReport(agentId: string) {
  const res = await fetch(`${KAAS_BASE}/agents/${agentId}/self-report`)
  if (!res.ok) throw new Error("Failed to request self-report")
  return res.json()
}

/** DB 기반 Knowledge Diff — 에이전트 연결 안 됐을 때 모달 fallback */
export async function fetchKnowledgeDiff(agentId: string, limit = 5) {
  const res = await fetch(`${KAAS_BASE}/agents/${agentId}/knowledge-diff?limit=${limit}`)
  if (!res.ok) throw new Error("Failed to fetch knowledge diff")
  return res.json()
}

/** LLM 프록시 — 에이전트가 구매한 지식으로 대화 (privacy_mode 지원) */
export async function chatWithAgent(apiKey: string, contentMd: string, question: string, privacyMode?: boolean) {
  const res = await fetch(`${KAAS_BASE}/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, content_md: contentMd, question, privacy_mode: privacyMode ?? false }),
  })
  if (!res.ok) throw new Error("LLM chat failed")
  return res.json()
}

/** WebSocket 채팅 — 에이전트에게 직접 메시지 전달 */
export async function wsChat(agentId: string, message: string) {
  const res = await fetch(`${KAAS_BASE}/mcp/ws-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, message }),
  })
  if (!res.ok) throw new Error("WS chat failed")
  return res.json()
}

/** MCP Sampling — 3자 대화 (유저 → Cherry → 에이전트 LLM) */
export async function mcpChat(message: string, agentId?: string) {
  const res = await fetch(`${KAAS_BASE}/mcp/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agent_id: agentId }),
  })
  if (!res.ok) throw new Error("MCP chat failed")
  return res.json()
}

/** MCP Elicitation — 에이전트에게 지식 목록 요청 후 gap 분석 */
export async function elicitKnowledge(agentId?: string) {
  const res = await fetchWithAuth(`${KAAS_BASE}/mcp/elicit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  })
  if (!res.ok) throw new Error("Elicitation failed")
  return res.json()
}

/** MCP 세션 목록 */
export async function fetchMcpSessions() {
  const res = await fetch(`${KAAS_BASE}/mcp/sessions`)
  if (!res.ok) throw new Error("Failed to fetch sessions")
  return res.json()
}

/** 큐레이터 보상 잔액 조회 */
export async function fetchCuratorRewards(curatorName: string) {
  const res = await fetch(`${KAAS_BASE}/rewards/balance?curator=${encodeURIComponent(curatorName)}`)
  if (!res.ok) throw new Error("Failed to fetch rewards")
  return res.json()
}

/** 전체 큐레이터 보상 현황 */
export async function fetchAllRewards() {
  const res = await fetch(`${KAAS_BASE}/rewards/all`)
  if (!res.ok) throw new Error("Failed to fetch rewards")
  return res.json()
}

/** 큐레이터 보상 인출 — pending 전부 합산해서 한 번에 온체인 체결.
 *  응답: { ok, withdrawn, txHash, onChain, explorerUrl?, error?, rowsUpdated }
 */
export async function withdrawRewards(curatorName: string) {
  const res = await fetch(`${KAAS_BASE}/rewards/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ curator: curatorName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Withdraw failed" }))
    throw new Error(err.message ?? "Withdraw failed")
  }
  return res.json()
}

/* ═══════════════════════════════════════════════
   KaaS Admin API
═══════════════════════════════════════════════ */

export interface AdminConcept {
  id: string
  title: string
  category: string
  summary: string
  contentMd: string | null
  qualityScore: number
  sourceCount: number
  updatedAt: string
  relatedConcepts: string[]
  isActive: boolean
  isOnSale?: boolean
  saleDiscount?: number
  createdBy: string
  createdByLabel: string
  revokedAt: string | null
  evidence: AdminEvidence[]
}

export interface AdminEvidence {
  id: string
  source: string
  summary: string
  curator: string
  curatorTier: string
  comment: string
}

export async function fetchConceptsAdmin(createdBy?: string): Promise<AdminConcept[]> {
  const params = createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : ''
  const res = await fetch(`${KAAS_BASE}/admin/concepts${params}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch admin concepts")
  return res.json()
}

export async function fetchConceptAdmin(id: string): Promise<AdminConcept> {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch admin concept")
  return res.json()
}

export async function createConceptAdmin(body: {
  id: string
  title: string
  category: string
  summary: string
  content_md?: string
  quality_score?: number
  source_count?: number
  related_concepts?: string[]
  created_by?: string
}) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create concept")
  return res.json()
}

export async function updateConceptAdmin(id: string, body: Record<string, unknown>) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update concept")
  return res.json()
}

export async function hideConceptAdmin(id: string) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${id}/hide`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to hide concept")
}

export async function unhideConceptAdmin(id: string) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${id}/show`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to unhide concept")
}

export async function deleteConceptAdmin(id: string) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete concept")
}

export async function addEvidenceAdmin(conceptId: string, body: {
  source: string
  summary: string
  curator: string
  curator_tier?: string
  comment?: string
}) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${conceptId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to add evidence")
  return res.json()
}

export async function updateEvidenceAdmin(conceptId: string, evidenceId: string, body: Record<string, unknown>) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${conceptId}/evidence/${evidenceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update evidence")
  return res.json()
}

export async function deleteEvidenceAdmin(conceptId: string, evidenceId: string) {
  const res = await fetch(`${KAAS_BASE}/admin/concepts/${conceptId}/evidence/${evidenceId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete evidence")
}

/** Knowledge Gap Analysis */
export async function compareKnowledge(knownTopics: { topic: string; lastUpdated: string }[]) {
  const res = await fetch(`${KAAS_BASE}/catalog/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ known_topics: knownTopics }),
  })
  if (!res.ok) throw new Error("Failed to compare")
  return res.json()
}
