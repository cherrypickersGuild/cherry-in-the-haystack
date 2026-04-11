export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

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
