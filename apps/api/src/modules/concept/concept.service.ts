import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

import { CONCEPT_RELATION_PROVIDER } from './concept-relation.provider';
import type { ConceptEdge, ConceptRelationProvider } from './concept-relation.provider';

/** 화면(개념 페이지) 한 장에 필요한 전부 */
export interface ConceptPageDto {
  slug: string;
  node: string;
  section: 'BASICS' | 'ADVANCED' | null;
  title: string;
  menuLabel: string;
  aliases: string[];
  meta: {
    updated: string | null; verified: boolean; source: string;
    /** handbook.knowledge_verification_contributor — 현재 0행. 채워지면 자동 표시 */
    contributors: { handle: string; initials: string; role: string | null }[];
  };
  /** 01 Overview */
  overview: { definition: string | null; body: string | null };
  /** 02 Cherries — handbook evidence */
  cherries: { source: string; author: string | null; locator: string | null;
              insight: string; curated: boolean; chunkId: string }[];
  /** 03 Child Concepts */
  childConcepts: {
    label: string; node: string; relation: string; why: string | null; hasPage: boolean;
  }[];
  /** 04 Progressive References */
  references: any[];
}

@Injectable()
export class ConceptService {
  private readonly logger = new Logger(ConceptService.name);

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
    @Inject(CONCEPT_RELATION_PROVIDER) private readonly relations: ConceptRelationProvider,
  ) {}

  /** slug 또는 온톨로지 노드명으로 개념 페이지 조립 */
  async getPage(key: string): Promise<ConceptPageDto | null> {
    const node = await this.resolveNode(key);
    if (!node) return null;

    const concept = await this.relations.getConcept(node);
    if (!concept) return null;

    const { children } = await this.relations.getRelations(node);
    const page = await this.findPublishedPage(node);
    const cherries = await this.findCherries(node);
    const known = await this.publishedNodes();

    return {
      slug: page?.concept_slug ?? this.toSlug(concept.label),
      node: concept.node,
      section: page?.section ?? null,
      title: page?.concept_name ?? concept.label,
      menuLabel: concept.aliases[0] ?? concept.label,
      aliases: concept.aliases,
      meta: {
        updated: page?.updated_at ? new Date(page.updated_at).toISOString().slice(0, 10) : null,
        verified: !!page?.is_published,
        source: this.relations.source,
        contributors: await this.findContributors(node),
      },
      overview: {
        definition: concept.description ?? null,
        body: page?.content_md ?? null,
      },
      cherries,
      childConcepts: children.map((c: ConceptEdge) => ({
        label: c.label,
        node: c.node,
        relation: c.relation,
        why: c.description ? this.firstSentence(c.description) : null,
        hasPage: known.has(c.node),
      })),
      references: page?.progressive_refs ?? [],
    };
  }

  /** 온톨로지에 있는 개념 전부 (목록·링크 판정용) */
  async list(): Promise<{ node: string; label: string; hasPage: boolean }[]> {
    const known = await this.publishedNodes();
    const { rows } = await this.knex.raw(
      `SELECT ontology_node, canonical_name FROM handbook.concept
        WHERE ontology_node IS NOT NULL AND revoked_at IS NULL
        ORDER BY canonical_name`,
    );
    return rows.map((r: any) => ({
      node: r.ontology_node, label: r.canonical_name, hasPage: known.has(r.ontology_node),
    }));
  }

  /* ── 내부 ── */

  /** slug(rag) → 노드(RAG) 해석. 발행 페이지 → 별칭 → 노드명 순 */
  private async resolveNode(key: string): Promise<string | null> {
    const { rows } = await this.knex.raw(
      `SELECT c.ontology_node FROM content.concept_page p
         JOIN handbook.concept c ON c.ontology_node = p.ontology_node AND c.revoked_at IS NULL
        WHERE p.concept_slug = :key AND p.surface = 'learning' LIMIT 1`,
      { key },
    ).catch(() => ({ rows: [] as any[] }));
    if (rows[0]) return rows[0].ontology_node;

    const byNode = await this.knex.raw(
      `SELECT c.ontology_node FROM handbook.concept c
        WHERE c.revoked_at IS NULL
          AND (lower(c.ontology_node) = lower(:key) OR lower(c.canonical_name) = lower(:key)
               OR EXISTS (SELECT 1 FROM handbook.concept_alias a
                           WHERE a.concept_id = c.id AND a.revoked_at IS NULL
                             AND lower(a.alias_text) = lower(:key)))
        LIMIT 1`,
      { key },
    );
    return byNode.rows[0]?.ontology_node ?? null;
  }

  private async findPublishedPage(node: string): Promise<any | null> {
    try {
      const { rows } = await this.knex.raw(
        `SELECT * FROM content.concept_page
          WHERE ontology_node = :node AND surface = 'learning' LIMIT 1`, { node });
      return rows[0] ?? null;
    } catch {
      return null; // 발행 계층 미구축 상태 허용
    }
  }

  /** handbook evidence → Cherries. 링크가 없으면 빈 배열(지어내지 않는다) */
  private async findCherries(node: string) {
    const { rows } = await this.knex.raw(
      `SELECT b.title AS source, b.author, ch.title AS chapter, s.title AS section,
              pc.body_text, l.insight, l.paragraph_chunk_id
         FROM handbook.concept c
         JOIN handbook.paragraph_concept_link l ON l.concept_id = c.id AND l.revoked_at IS NULL
         JOIN handbook.paragraph_chunk pc ON pc.id = l.paragraph_chunk_id AND pc.revoked_at IS NULL
         JOIN handbook.book b ON b.id = pc.book_id AND b.revoked_at IS NULL
    LEFT JOIN handbook.chapter ch ON ch.id = pc.chapter_id
    LEFT JOIN handbook.section s ON s.id = pc.section_id
        WHERE c.ontology_node = :node AND c.revoked_at IS NULL
        ORDER BY l.is_primary DESC, pc.id
        LIMIT 12`, { node });
    return rows.map((r: any) => ({
      source: r.source,
      author: r.author && r.author !== 'Unknown' ? String(r.author).replace(/;$/, '') : null,
      locator: [r.chapter, r.section].filter(Boolean).join(' › ') || null,
      /** 정리된 문장 우선. 없으면 원문(PDF 추출본이라 거칠다). 원문 추적은 chunkId 로. */
      insight: r.insight ?? r.body_text,
      curated: !!r.insight,
      chunkId: r.paragraph_chunk_id,
    }));
  }

  /** 기여자. 표가 비어 있으면 빈 배열(지어내지 않는다) */
  private async findContributors(node: string) {
    try {
      const { rows } = await this.knex.raw(
        `SELECT * FROM handbook.knowledge_verification_contributor LIMIT 8`);
      return rows.map((r: any) => ({
        handle: r.handle ?? r.name ?? r.contributor_name ?? 'unknown',
        initials: String(r.handle ?? r.name ?? '??').slice(0, 2).toLowerCase(),
        role: r.role ?? null,
      }));
    } catch {
      return [];
    }
  }

  private async publishedNodes(): Promise<Set<string>> {
    try {
      const { rows } = await this.knex.raw(
        `SELECT ontology_node FROM content.concept_page
          WHERE surface = 'learning' AND ontology_node IS NOT NULL`);
      return new Set(rows.map((r: any) => r.ontology_node));
    } catch {
      return new Set();
    }
  }

  private toSlug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  private firstSentence(s: string) {
    const t = s.replace(/\s+/g, ' ').trim();
    const m = t.match(/^.{0,140}?[.。]/);
    return (m ? m[0] : t.slice(0, 140)).trim();
  }
}
