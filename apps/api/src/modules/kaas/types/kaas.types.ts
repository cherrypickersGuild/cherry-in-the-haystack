/** 큐레이터 정보 포함 Evidence */
export interface Evidence {
  id: string;
  source: string;
  summary: string;
  curator: string;
  curatorTier: string;
  comment: string;
}

/** 카탈로그 개념 (미리보기 — content_md 미포함) */
export interface Concept {
  id: string;
  title: string;
  category: string;
  summary: string;
  qualityScore: number;
  sourceCount: number;
  updatedAt: string;
  relatedConcepts: string[];
  evidence: Evidence[];
}

/** 구매용 개념 (content_md 포함 — 실제 지식 본문) */
export interface ConceptWithContent extends Concept {
  contentMd: string | null;
}

/** Karma 티어 */
export type KarmaTierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

/** Karma 할인율 */
export const KARMA_DISCOUNT: Record<KarmaTierName, number> = {
  Bronze: 0,
  Silver: 0.05,
  Gold: 0.15,
  Platinum: 0.30,
};

/** 구매/팔로우 가격 */
export const ACTION_PRICE = {
  purchase: 20,
  follow: 25,
} as const;

export type ActionType = 'purchase' | 'follow';
