import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

import { EvidenceRow } from './entity/evidence-row.entity';
import {
  WriterInputErrorItem,
  WriterInputResponseDto,
} from './input-dto/writer-input-response.dto';

@Injectable()
export class WriterAgentService {
  private readonly logger = new Logger(WriterAgentService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /* ═══════════════════════════════════════════
     POST /writer-agent/input — buildWriterInput
     명세 agent-api-spec §3·§4 / handbook v2 기준.
     topic 매칭: concept.canonical_name 정확 → concept_alias 변형 (case-insensitive UNION)
     evidence: 매칭 concept 에 연결된 paragraph_chunk + 책/토픽/점수
  ═══════════════════════════════════════════ */
  async buildWriterInput(
    topic: string,
    limit: number,
  ): Promise<WriterInputResponseDto> {
    const evidenceRows = await this.fetchHandbookEvidenceByTopic(topic, limit);
    const errors: WriterInputErrorItem[] = [];

    if (evidenceRows.length === 0) {
      errors.push({
        code: 'NO_DATA',
        message: `topic="${topic}" 에 매칭되는 handbook evidence 가 없습니다.`,
      });
      this.logger.warn(`[buildWriterInput] no evidence for topic="${topic}"`);
    } else {
      this.logger.log(
        `[buildWriterInput] topic="${topic}" → ${evidenceRows.length} rows (limit=${limit})`,
      );
    }

    return {
      version: '0.2',
      topic,
      graph_context: {
        mode: 'direct_graphdb',
        focus_concepts: [],
        related_concepts: [],
      },
      evidence_rows: evidenceRows,
      update_payload: null,
      meta: {
        source: 'backend',
        generated_at: new Date().toISOString(),
        schema_version: 'handbook-v2',
      },
      errors,
    };
  }

  /* ═══════════════════════════════════════════
     handbook v2 SQL
     - concept(표제어) / concept_alias(변형) 로 topic 매칭
     - NUMERIC(3,2) 점수·신뢰도는 ::float8 캐스팅 → JSON number
     - revoked_at IS NULL soft-delete 일관 적용
     - 결정적 정렬: is_primary → judge_technical_accuracy → importance_score → pc.id
  ═══════════════════════════════════════════ */
  private async fetchHandbookEvidenceByTopic(
    topic: string,
    limit: number,
  ): Promise<EvidenceRow[]> {
    const result = await this.knex.raw<{ rows: EvidenceRow[] }>(
      `
      WITH matched_concept AS (
          SELECT c.id
          FROM handbook.concept c
          WHERE lower(c.canonical_name) = lower(:topic)
            AND c.revoked_at IS NULL
          UNION
          SELECT ca.concept_id
          FROM handbook.concept_alias ca
          WHERE lower(ca.alias_text) = lower(:topic)
            AND ca.revoked_at IS NULL
      )
      SELECT
          pc.id                                  AS chunk_id,
          pc.body_text                           AS body_text,
          pc.page_number                         AS page_number,
          pc.paragraph_index                     AS paragraph_index,
          pc.chapter_paragraph_index             AS chapter_paragraph_index,
          pc.chapter_id                          AS chapter_id,
          pc.section_id                          AS section_id,
          pc.book_id                             AS book_id,
          b.title                                AS book_title,
          b.author                               AS book_author,
          c.id                                   AS concept_id,
          c.canonical_name                       AS concept_name,
          pcl.is_primary                         AS is_primary,
          pcl.extraction_confidence::float8      AS extraction_confidence,
          pc.extract_type                        AS extract_type,
          t.name                                 AS handbook_topic,
          st.name                                AS handbook_subtopic,
          pc.judge_originality::float8           AS judge_originality,
          pc.judge_depth::float8                 AS judge_depth,
          pc.judge_technical_accuracy::float8    AS judge_technical_accuracy,
          pc.importance_score::float8            AS importance_score,
          pc.sampling_weight::float8             AS sampling_weight
      FROM matched_concept mc
      JOIN handbook.concept c
          ON c.id = mc.id
      JOIN handbook.paragraph_concept_link pcl
          ON pcl.concept_id = mc.id
         AND pcl.revoked_at IS NULL
      JOIN handbook.paragraph_chunk pc
          ON pc.id = pcl.paragraph_chunk_id
         AND pc.revoked_at IS NULL
      JOIN handbook.book b
          ON b.id = pc.book_id
         AND b.revoked_at IS NULL
      LEFT JOIN handbook.topic t
          ON t.id = c.topic_id
      LEFT JOIN handbook.subtopic st
          ON st.id = c.subtopic_id
      WHERE char_length(pc.body_text) >= 120
      ORDER BY pcl.is_primary DESC,
               pc.judge_technical_accuracy DESC NULLS LAST,
               pc.importance_score DESC NULLS LAST,
               pc.id ASC
      LIMIT :limit
      `,
      { topic, limit },
    );

    return result.rows;
  }
}
