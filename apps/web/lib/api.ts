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
  topArticles: LandingTopArticle[]
}

export async function fetchLanding(): Promise<LandingResponse> {
  const res = await fetch(`${API_URL}/api/stats/landing`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch landing stats")
  return res.json()
}
