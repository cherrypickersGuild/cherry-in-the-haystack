import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { v7 as uuidv7 } from 'uuid';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AgentCommService {
  private readonly logger = new Logger(AgentCommService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /* ═══════════════════════════════════════════
     기사 삽입
  ═══════════════════════════════════════════ */

  /**
   * article_raw에 기사를 삽입한다.
   * source_name으로 source를 찾고, 없으면 자동 생성한다.
   * URL 중복이면 기존 ID를 반환한다.
   */
  async insertArticle(dto: {
    title: string;
    url: string;
    content_raw: string;
    published_at: string;
    source_name: string;
    source_type?: string;
    language?: string;
    author?: string;
  }): Promise<{ id: string; created: boolean }> {
    // 1. URL 중복 체크
    const existing = await this.knex('content.article_raw')
      .whereRaw("url_hash = decode(md5(?), 'hex')", [dto.url])
      .first('id');

    if (existing) {
      this.logger.log(`Article already exists — url: ${dto.url}`);
      return { id: existing.id, created: false };
    }

    // 2. source 찾기 or 생성
    const sourceType = dto.source_type ?? 'RSS';
    let source = await this.knex('content.source')
      .whereRaw('lower(name) = ?', [dto.source_name.toLowerCase()])
      .where({ is_active: true })
      .whereNull('revoked_at')
      .first('id');

    if (!source) {
      const sourceId = uuidv7();
      await this.knex('content.source').insert({
        id: sourceId,
        type: sourceType,
        name: dto.source_name,
        url_handle: dto.url,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      source = { id: sourceId };
      this.logger.log(`Created new source: ${dto.source_name}`);
    }

    // 3. article_raw 삽입
    const articleId = uuidv7();
    await this.knex('content.article_raw').insert({
      id: articleId,
      source_id: source.id,
      title: dto.title,
      url: dto.url,
      content_raw: dto.content_raw,
      published_at: dto.published_at,
      representative_key: dto.url,
      language: dto.language ?? null,
      author: dto.author ?? null,
      storage_state: 'ACTIVE',
      fetched_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.logger.log(`Inserted article_raw: ${articleId} — ${dto.title}`);
    return { id: articleId, created: true };
  }

  /* ═══════════════════════════════════════════
     평가 패키지 조립
  ═══════════════════════════════════════════ */

  async buildEvaluationPackage(type: string, versionTags: string[]) {
    const [prompts, catalog, items] = await Promise.all([
      this.getPrompts(type, versionTags),
      this.getCatalog(),
      this.getPendingItems(),
    ]);

    return { prompts, catalog, items };
  }

  private async getPrompts(type: string, versionTags: string[]) {
    const row = await this.knex.raw(
      `
      SELECT
        pt.id            AS template_id,
        pt.name          AS template_name,
        pt.tone_text,
        pv.id            AS version_id,
        pv.version_tag,
        pv.prompt_text,
        pv.few_shot_examples,
        pv.parameters_json
      FROM core.prompt_template pt
      JOIN core.prompt_template_version pv
        ON pv.prompt_template_id = pt.id
       AND pv.version_tag = ANY(:versionTags)
       AND pv.revoked_at IS NULL
      WHERE pt.type = :type
        AND pt.scope = 'PLATFORM'
        AND pt.is_active = TRUE
        AND pt.revoked_at IS NULL
      ORDER BY pv.version_no
    `,
      { type, versionTags },
    );

    if (row.rows.length === 0) {
      throw new NotFoundException(
        `프롬프트를 찾을 수 없습니다: type=${type}, version_tags=${versionTags.join(',')}`,
      );
    }

    const toneText = row.rows[0].tone_text;
    const templateId = row.rows[0].template_id;
    const templateName = row.rows[0].template_name;

    return {
      template_id: templateId,
      template_name: templateName,
      tone_text: toneText,
      versions: row.rows.map((r: Record<string, unknown>) => ({
        version_id: r.version_id,
        version_tag: r.version_tag,
        prompt_text: r.prompt_text,
        few_shot_examples: r.few_shot_examples,
        parameters_json: r.parameters_json,
      })),
    };
  }

  private async getCatalog() {
    const CATALOG_PAGES = ['MODEL_UPDATES', 'FRAMEWORKS', 'CASE_STUDIES'];

    const entityRows = await this.knex.raw(`
      SELECT
        tep.entity_page       AS page,
        ec.id                 AS category_id,
        ec.name               AS category_name,
        te.id                 AS entity_id,
        te.name               AS entity_name
      FROM content.tracked_entity_placement tep
      JOIN content.entity_category ec
        ON ec.id = tep.entity_category_id
       AND ec.is_active = TRUE
       AND ec.revoked_at IS NULL
      JOIN content.tracked_entity te
        ON te.id = tep.tracked_entity_id
       AND te.is_active = TRUE
       AND te.revoked_at IS NULL
      WHERE tep.revoked_at IS NULL
        AND tep.entity_page = ANY(:pages)
      ORDER BY tep.entity_page, ec.sort_order, te.name
    `, { pages: CATALOG_PAGES });

    type CatEntry = { id: string; name: string; entities: { id: string; name: string }[] };
    const pageMap = new Map<string, Map<string, CatEntry>>();

    for (const r of entityRows.rows) {
      if (!pageMap.has(r.page)) pageMap.set(r.page, new Map());
      const catMap = pageMap.get(r.page)!;

      if (!catMap.has(r.category_id)) {
        catMap.set(r.category_id, { id: r.category_id, name: r.category_name, entities: [] });
      }

      if (r.entity_id && r.entity_name) {
        catMap.get(r.category_id)!.entities.push({ id: r.entity_id, name: r.entity_name });
      }
    }

    const pages = Array.from(pageMap.entries()).map(([page, catMap]) => ({
      page,
      categories: Array.from(catMap.values()),
    }));

    const sideRows = await this.knex('content.side_category')
      .where({ is_active: true })
      .whereNull('revoked_at')
      .orderBy('sort_order')
      .select('code', 'name');

    return {
      pages,
      side_categories: sideRows,
    };
  }

  /* ═══════════════════════════════════════════
     평가 결과 저장
  ═══════════════════════════════════════════ */

  async saveEvaluationResults(
    results: { ai_state_id: string; version_id: string; result: Record<string, unknown> }[],
  ) {
    let saved = 0;
    let skipped = 0;

    for (const item of results) {
      const updated = await this.knex('content.user_article_ai_state')
        .where({
          id: item.ai_state_id,
          user_id: SYSTEM_USER_ID,
          ai_status: 'PENDING',
        })
        .whereNull('agent_json_raw')
        .update({
          agent_json_raw: JSON.stringify(item.result),
          prompt_template_version_id: item.version_id,
          ai_processed_at: new Date(),
        });

      if (updated > 0) saved++;
      else skipped++;
    }

    this.logger.log(`saveEvaluationResults — saved: ${saved}, skipped: ${skipped}`);
    return { saved, skipped };
  }

  /* ═══════════════════════════════════════════
     PENDING 기사 조회
  ═══════════════════════════════════════════ */

  private async getPendingItems() {
    const rows = await this.knex.raw(
      `
      SELECT
        aai.id                  AS ai_state_id,
        ar.title                AS article_title,
        ar.content_raw          AS article_content,
        ar.url                  AS article_url,
        ar.published_at         AS article_published_at,
        s.name                  AS source_name,
        s.type                  AS source_type
      FROM content.user_article_ai_state aai
      JOIN content.user_article_state uas
        ON uas.id = aai.user_article_state_id
       AND uas.user_id = :systemUserId::UUID
      JOIN content.article_raw ar
        ON ar.id = uas.article_raw_id
      LEFT JOIN content.source s
        ON s.id = ar.source_id
      WHERE aai.ai_status = 'PENDING'
        AND aai.agent_json_raw IS NULL
        AND aai.user_id = :systemUserId::UUID
      ORDER BY ar.published_at DESC
    `,
      { systemUserId: SYSTEM_USER_ID },
    );

    return rows.rows.map((r: Record<string, unknown>) => ({
      id: r.ai_state_id,
      article: {
        title: r.article_title,
        content: r.article_content,
        url: r.article_url,
        published_at: r.article_published_at,
        source_name: r.source_name,
        source_type: r.source_type,
      },
    }));
  }
}
