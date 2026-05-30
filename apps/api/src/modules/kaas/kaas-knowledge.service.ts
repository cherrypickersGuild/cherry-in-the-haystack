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

  /** 전체 목록 (카탈로그용 — content_md 제외, 작성자 카르마 포함) */
  async findAll(): Promise<Concept[]> {
    const rows = await this.knex('kaas.concept')
      .where('kaas.concept.is_active', true)
      .orderBy('quality_score', 'desc');

    if (rows.length === 0) return [];

    // 작성자 정보 일괄 조회 — '__SYSTEM__'은 시스템 유저 UUID로 변환
    const SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';
    const creatorIds = [...new Set(
      rows.map((r: Record<string, unknown>) => {
        const cb = r.created_by as string;
        return (!cb || cb === '__SYSTEM__') ? SYSTEM_UUID : cb;
      })
    )];
    const users = creatorIds.length > 0
      ? await this.knex('core.app_user').whereIn('id', creatorIds).select('id', 'name', 'email', 'karma_tier')
      : [];
    // name이 비어있으면 email prefix로 fallback (Admin 리스트와 동일한 표시 규칙)
    const userMap = new Map(users.map((u: any) => {
      const trimmedName = (u.name as string | null)?.trim() || null;
      const emailPrefix = u.email ? (u.email as string).split('@')[0] : null;
      return [u.id, {
        name: trimmedName || emailPrefix || 'user',
        karmaTier: (u.karma_tier ?? 'Bronze') as string,
      }];
    }));
    // __SYSTEM__ 키로도 조회 가능하게
    const sysUser = userMap.get(SYSTEM_UUID);
    if (sysUser) userMap.set('__SYSTEM__', sysUser);

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    return rows.map((r: Record<string, unknown>) => ({
      ...this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
      creator: userMap.get(r.created_by as string) ?? null,
      onSale: !!(r.is_on_sale),
      saleDiscount: r.is_on_sale ? (r.sale_discount as number ?? 20) : 0,
    }));
  }

  /** SALE 대상 개념 ID → 할인율 맵 (DB 기반) */
  async getSaleMap(): Promise<Map<string, number>> {
    const rows: Array<{ id: string; sale_discount: number }> = await this.knex('kaas.concept')
      .where({ is_active: true, is_on_sale: true })
      .select('id', 'sale_discount');
    return new Map(rows.map((r) => [r.id, r.sale_discount ?? 20]));
  }

  /** 해당 개념의 SALE 할인율 (0이면 세일 아님) */
  async getSaleDiscount(conceptId: string): Promise<number> {
    const row = await this.knex('kaas.concept')
      .where({ id: conceptId, is_active: true, is_on_sale: true })
      .select('sale_discount')
      .first();
    return row ? (row.sale_discount ?? 20) : 0;
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

  /** Admin — 큐레이션 목록 (created_by 필터 지원) */
  async findAllAdmin(createdBy?: string) {
    let query = this.knex('kaas.concept').orderBy('quality_score', 'desc');
    if (createdBy === '__ADMIN__') {
      // 관리자: 전체 (시스템 + 모든 유저, 비활성 포함)
    } else if (createdBy) {
      // 일반 유저: 자기 것만 + 활성만
      query = query.where('created_by', createdBy).where('is_active', true);
    }
    const rows = await query;
    if (rows.length === 0) return [];

    const evidence = await this.knex('kaas.evidence')
      .whereIn('concept_id', rows.map((r: Record<string, unknown>) => r.id) as string[]);

    // 유저 이메일 조회 — __SYSTEM__ 제외한 실 유저만
    const userIds = [...new Set(
      rows
        .map((r: Record<string, unknown>) => r.created_by as string)
        .filter((id) => id && id !== '__SYSTEM__'),
    )];
    const users = userIds.length > 0
      ? await this.knex('core.app_user').whereIn('id', userIds).select('id', 'email', 'name')
      : [];
    const userMap = new Map(users.map((u: any) => [u.id as string, { email: u.email as string, name: u.name as string }]));

    return rows.map((r: Record<string, unknown>) => {
      const cb = (r.created_by as string) ?? '__SYSTEM__';
      const user = userMap.get(cb);
      const emailPrefix = user?.email ? user.email.split('@')[0] : null;
      const createdByLabel = cb === '__SYSTEM__' ? '__SYSTEM__' : (user?.name || emailPrefix || cb.slice(0, 8));
      return {
        ...this.mapConcept(r, evidence.filter((e: Record<string, unknown>) => e.concept_id === r.id)),
        contentMd: (r.content_md as string) ?? null,
        isActive: r.is_active as boolean,
        isOnSale: !!(r.is_on_sale),
        saleDiscount: (r.sale_discount as number) ?? 20,
        createdBy: cb,
        createdByLabel,
        revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : null,
      };
    });
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
      isOnSale: !!(row.is_on_sale),
      saleDiscount: (row.sale_discount as number) ?? 20,
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
    created_by?: string;
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
        created_by: dto.created_by ?? '__SYSTEM__',
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
    if (dto.is_on_sale !== undefined) updates.is_on_sale = dto.is_on_sale;
    if (dto.sale_discount !== undefined) updates.sale_discount = dto.sale_discount;

    const [row] = await this.knex('kaas.concept').where({ id }).update(updates).returning('*');
    return row;
  }

  /** Admin — Hide: 마켓에서 숨김 (is_active=false, 복구 가능) */
  async hideConcept(id: string) {
    await this.knex('kaas.concept').where({ id }).update({ is_active: false, updated_at: new Date() });
  }

  /** Admin — Unhide: 숨김 해제 (is_active=true) */
  async unhideConcept(id: string) {
    await this.knex('kaas.concept').where({ id }).update({ is_active: true, updated_at: new Date() });
  }

  /** Admin — Revoke: 소프트 딜리트 (revoked_at 기록, 복구 불가 의도) */
  async revokeConcept(id: string) {
    const now = new Date();
    await this.knex('kaas.concept').where({ id }).update({ is_active: false, revoked_at: now, updated_at: now });
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
