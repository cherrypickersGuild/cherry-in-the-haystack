import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { Concept, ConceptWithContent, Evidence } from './types/kaas.types';

/**
 * KnowledgeService — DB 기반 지식 카탈로그 조회
 *
 * kaas.concept + kaas.evidence 테이블에서 조회.
 * - 카탈로그 조회: content_md 제외 (미리보기만)
 * - 구매 시: content_md 포함 (실제 지식 본문)
 */
@Injectable()
export class KaasKnowledgeService {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  /** DB row → Concept 매핑 (snake_case → camelCase) */
  private mapConcept(row: Record<string, unknown>, evidenceRows: Record<string, unknown>[]): Concept {
    return {
      id: row.id as string,
      title: row.title as string,
      category: row.category as string,
      summary: row.summary as string,
      qualityScore: parseFloat(String(row.quality_score ?? 0)),
      sourceCount: Number(row.source_count ?? 0),
      updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString().slice(0, 10) : '',
      relatedConcepts: (row.related_concepts as string[]) ?? [],
      evidence: evidenceRows.map((e) => ({
        id: e.id as string,
        source: e.source as string,
        summary: e.summary as string,
        curator: e.curator as string,
        curatorTier: e.curator_tier as string,
        comment: e.comment as string,
      })),
    };
  }

  /** 전체 목록 (카탈로그용 — content_md 제외) */
  async findAll(): Promise<Concept[]> {
    const rows = await this.knex('kaas.concept')
      .where('is_active', true)
      .orderBy('quality_score', 'desc');

    if (rows.length === 0) return [];

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    return rows.map((r: Record<string, unknown>) =>
      this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
    );
  }

  /**
   * SALE 대상 개념 ID 집합.
   * 각 카테고리에서 quality_score 가 가장 높은 개념 1개씩.
   * 프론트 `onSaleIds` 로직과 동일한 규칙 — 클라이언트 선언이 아닌 서버 단일 소스.
   */
  async getOnSaleIds(): Promise<Set<string>> {
    const rows: Array<{ id: string; category: string; quality_score: number | string }> = await this.knex('kaas.concept')
      .where('is_active', true)
      .select('id', 'category', 'quality_score');

    const bestPerCategory = new Map<string, { id: string; score: number }>();
    for (const r of rows) {
      const score = typeof r.quality_score === 'string' ? parseFloat(r.quality_score) : (r.quality_score ?? 0);
      const prev = bestPerCategory.get(r.category);
      if (!prev || score > prev.score) {
        bestPerCategory.set(r.category, { id: r.id, score });
      }
    }
    return new Set(Array.from(bestPerCategory.values()).map((v) => v.id));
  }

  /** 해당 개념이 현재 SALE인지 */
  async isOnSale(conceptId: string): Promise<boolean> {
    const ids = await this.getOnSaleIds();
    return ids.has(conceptId);
  }

  /** ID로 조회 (카탈로그 상세 — content_md 제외) */
  async findById(id: string): Promise<Concept | null> {
    const row = await this.knex('kaas.concept')
      .where({ id, is_active: true })
      .first();

    if (!row) return null;

    const evidence = await this.knex('kaas.evidence').where('concept_id', id);
    return this.mapConcept(row, evidence);
  }

  /** 에이전트의 최근 구매/팔로우 이력 (knowledge diff 용) */
  async findQueryHistoryByAgent(agentId: string, limit = 5): Promise<any[]> {
    return this.knex('kaas.query_log')
      .where({ agent_id: agentId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /** ID로 조회 (구매용 — content_md 포함) */
  async findByIdWithContent(id: string): Promise<ConceptWithContent | null> {
    const row = await this.knex('kaas.concept')
      .where({ id, is_active: true })
      .first();

    if (!row) return null;

    const evidence = await this.knex('kaas.evidence').where('concept_id', id);
    return {
      ...this.mapConcept(row, evidence),
      contentMd: (row.content_md as string) ?? null,
    };
  }

  /** 키워드 검색 */
  async search(query: string): Promise<Concept[]> {
    const q = `%${query.toLowerCase()}%`;
    const rows = await this.knex('kaas.concept')
      .where('is_active', true)
      .where(function () {
        this.whereRaw('LOWER(title) LIKE ?', [q])
          .orWhereRaw('LOWER(summary) LIKE ?', [q])
          .orWhereRaw('LOWER(id) LIKE ?', [q]);
      })
      .orderBy('quality_score', 'desc');

    if (rows.length === 0) return [];

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    return rows.map((r: Record<string, unknown>) =>
      this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
    );
  }

  /** 카테고리별 조회 */
  async findByCategory(category: string): Promise<Concept[]> {
    const rows = await this.knex('kaas.concept')
      .where({ category, is_active: true })
      .orderBy('quality_score', 'desc');

    if (rows.length === 0) return [];

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    return rows.map((r: Record<string, unknown>) =>
      this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
    );
  }

  /* ═══════════════════════════════════════════
     Admin CRUD
  ═══════════════════════════════════════════ */

  /** Admin — 전체 목록 (비활성 포함, content_md 포함) */
  async findAllAdmin() {
    const rows = await this.knex('kaas.concept').orderBy('quality_score', 'desc');
    if (rows.length === 0) return [];

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    return rows.map((r: Record<string, unknown>) => ({
      ...this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
      contentMd: (r.content_md as string) ?? null,
      isActive: r.is_active as boolean,
    }));
  }

  /** Admin — 상세 조회 (비활성 포함, content_md + evidence) */
  async findByIdAdmin(id: string) {
    const row = await this.knex('kaas.concept').where({ id }).first();
    if (!row) return null;

    const evidence = await this.knex('kaas.evidence').where('concept_id', id);
    return {
      ...this.mapConcept(row, evidence),
      contentMd: (row.content_md as string) ?? null,
      isActive: row.is_active as boolean,
    };
  }

  /** Admin — Concept 생성 */
  async createConcept(dto: {
    id: string;
    title: string;
    category: string;
    summary: string;
    content_md?: string;
    quality_score?: number;
    source_count?: number;
    related_concepts?: string[];
  }) {
    const [row] = await this.knex('kaas.concept')
      .insert({
        id: dto.id,
        title: dto.title,
        category: dto.category,
        summary: dto.summary,
        content_md: dto.content_md ?? null,
        quality_score: dto.quality_score ?? 0,
        source_count: dto.source_count ?? 0,
        related_concepts: JSON.stringify(dto.related_concepts ?? []),
        is_active: true,
        updated_at: new Date(),
      })
      .returning('*');
    return row;
  }

  /** Admin — Concept 수정 */
  async updateConcept(id: string, dto: Record<string, unknown>) {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.summary !== undefined) updates.summary = dto.summary;
    if (dto.content_md !== undefined) updates.content_md = dto.content_md;
    if (dto.quality_score !== undefined) updates.quality_score = dto.quality_score;
    if (dto.source_count !== undefined) updates.source_count = dto.source_count;
    if (dto.related_concepts !== undefined) updates.related_concepts = JSON.stringify(dto.related_concepts);

    const [row] = await this.knex('kaas.concept').where({ id }).update(updates).returning('*');
    return row;
  }

  /** Admin — Concept 소프트 삭제 */
  async softDeleteConcept(id: string) {
    await this.knex('kaas.concept').where({ id }).update({ is_active: false, updated_at: new Date() });
  }

  /** Admin — Evidence 추가 */
  async addEvidence(conceptId: string, dto: {
    source: string;
    summary: string;
    curator: string;
    curator_tier?: string;
    comment?: string;
  }) {
    const id = `${conceptId}-ev-${Date.now().toString(36)}`;
    const [row] = await this.knex('kaas.evidence')
      .insert({
        id,
        concept_id: conceptId,
        source: dto.source,
        summary: dto.summary,
        curator: dto.curator,
        curator_tier: dto.curator_tier ?? 'Bronze',
        comment: dto.comment ?? '',
      })
      .returning('*');

    // source_count 업데이트
    const count = await this.knex('kaas.evidence').where('concept_id', conceptId).count('* as cnt').first();
    await this.knex('kaas.concept').where({ id: conceptId }).update({ source_count: Number(count?.cnt ?? 0) });

    return row;
  }

  /** Admin — Evidence 수정 */
  async updateEvidence(conceptId: string, evidenceId: string, dto: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (dto.source !== undefined) updates.source = dto.source;
    if (dto.summary !== undefined) updates.summary = dto.summary;
    if (dto.curator !== undefined) updates.curator = dto.curator;
    if (dto.curator_tier !== undefined) updates.curator_tier = dto.curator_tier;
    if (dto.comment !== undefined) updates.comment = dto.comment;

    const [row] = await this.knex('kaas.evidence')
      .where({ id: evidenceId, concept_id: conceptId })
      .update(updates)
      .returning('*');
    return row;
  }

  /** Admin — Evidence 삭제 */
  async deleteEvidence(conceptId: string, evidenceId: string) {
    await this.knex('kaas.evidence').where({ id: evidenceId, concept_id: conceptId }).delete();

    // source_count 업데이트
    const count = await this.knex('kaas.evidence').where('concept_id', conceptId).count('* as cnt').first();
    await this.knex('kaas.concept').where({ id: conceptId }).update({ source_count: Number(count?.cnt ?? 0) });
  }
}
