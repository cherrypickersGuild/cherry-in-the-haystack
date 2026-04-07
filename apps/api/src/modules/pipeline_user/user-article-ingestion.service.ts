import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { v7 as uuidv7 } from 'uuid';

import type { ArticleRawEntity } from './entity/article-raw.entity';

@Injectable()
export class UserArticleIngestionService {
  private readonly logger = new Logger(UserArticleIngestionService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /**
   * 특정 유저에게 article_raw 1건의 user_article_state를 생성한다.
   * 이미 존재하면 스킵한다.
   *
   * @returns 생성됐으면 true, 이미 존재해서 스킵됐으면 false
   */
  async processNewArticleForUser(
    articleRawId: string,
    userId: string,
  ): Promise<boolean> {
    const article = await this.knex<ArticleRawEntity>('content.article_raw')
      .where({ id: articleRawId })
      .first();

    if (!article) {
      throw new NotFoundException(`article_raw not found: ${articleRawId}`);
    }

    const existing = await this.knex('content.user_article_state')
      .where({ user_id: userId, article_raw_id: articleRawId })
      .whereNull('revoked_at')
      .first('id');

    if (existing) {
      this.logger.log(`Already exists — skipped for user ${userId} / article ${articleRawId}`);
      return false;
    }

    const discoveredAt = this.resolveDiscoveredAt(article.published_at);
    const now = new Date();

    await this.knex('content.user_article_state').insert({
      id: uuidv7(),
      user_id: userId,
      article_raw_id: articleRawId,
      discovered_at: discoveredAt,
      representative_entity_id: null,
      side_category_id: null,
      impact_score: 0,
      is_high_impact: false,
      is_hidden: false,
      meta_json: null,
      created_at: now,
      updated_at: now,
    });

    this.logger.log(`Created user_article_state for user ${userId} / article ${articleRawId}`);
    return true;
  }

  private resolveDiscoveredAt(publishedAt: Date | null): Date {
    if (!publishedAt) return new Date();
    const t = new Date(publishedAt);
    t.setTime(t.getTime() + 60 * 60 * 1000); // +1h
    return t;
  }
}
