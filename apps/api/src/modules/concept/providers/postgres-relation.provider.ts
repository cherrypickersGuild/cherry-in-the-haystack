import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';

import type {
  ConceptEdge, ConceptNode, ConceptRelationProvider, ConceptRelations,
} from '../concept-relation.provider';

/**
 * Postgres 구현 — handbook.concept / concept_alias / concept_relation
 * ⚠️ 모든 조회에 revoked_at IS NULL 필수(소프트 삭제 후 재이관 시 유령 행 방지).
 *    근거: apps/docs/ontology-migration/2-implementation-guide.md §3-5
 */
@Injectable()
export class PostgresRelationProvider implements ConceptRelationProvider {
  readonly source = 'postgres' as const;

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  async getConcept(node: string): Promise<ConceptNode | null> {
    const { rows } = await this.knex.raw(
      `SELECT c.ontology_node, c.canonical_name, c.description,
              COALESCE(
                (SELECT array_agg(a.alias_text ORDER BY a.alias_text)
                   FROM handbook.concept_alias a
                  WHERE a.concept_id = c.id AND a.revoked_at IS NULL),
                '{}') AS aliases
         FROM handbook.concept c
        WHERE c.ontology_node = :node AND c.revoked_at IS NULL
        LIMIT 1`,
      { node },
    );
    const r = rows[0];
    if (!r) return null;
    return {
      node: r.ontology_node,
      label: r.canonical_name,
      description: r.description ?? null,
      aliases: r.aliases ?? [],
    };
  }

  async getRelations(node: string): Promise<ConceptRelations> {
    /** 아래로: to = 이 개념 인 행들의 from */
    const children = await this.edges(node, 'child');
    /** 위로: from = 이 개념 인 행들의 to */
    const parents = await this.edges(node, 'parent');
    return { parents, children };
  }

  private async edges(node: string, dir: 'child' | 'parent'): Promise<ConceptEdge[]> {
    const selfCol = dir === 'child' ? 'to_concept_id' : 'from_concept_id';
    const otherCol = dir === 'child' ? 'from_concept_id' : 'to_concept_id';
    const { rows } = await this.knex.raw(
      `SELECT o.ontology_node, o.canonical_name, o.description, r.relation_type::text AS relation
         FROM handbook.concept_relation r
         JOIN handbook.concept s ON s.id = r.${selfCol} AND s.revoked_at IS NULL
         JOIN handbook.concept o ON o.id = r.${otherCol} AND o.revoked_at IS NULL
        WHERE s.ontology_node = :node AND r.revoked_at IS NULL
        ORDER BY r.relation_type, o.canonical_name`,
      { node },
    );
    return rows.map((r: any) => ({
      node: r.ontology_node,
      label: r.canonical_name,
      description: r.description ?? null,
      relation: r.relation,
    }));
  }
}
