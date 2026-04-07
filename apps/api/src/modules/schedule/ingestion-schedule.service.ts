import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ArticleIngestionService } from 'src/modules/pipeline/article-ingestion.service';
import { AiStatePreGenService } from 'src/modules/pipeline/ai-state-pregen.service';
import { AgentJsonParserService } from 'src/modules/pipeline/agent-json-parser.service';
import { ModelUpdatesRankService } from 'src/modules/stats/model-updates-rank.service';

@Injectable()
export class IngestionScheduleService {
  private readonly logger = new Logger(IngestionScheduleService.name);
  private isRunning = false;

  constructor(
    private readonly ingestionService: ArticleIngestionService,
    private readonly pregenService: AiStatePreGenService,
    private readonly parserService: AgentJsonParserService,
    private readonly rankService: ModelUpdatesRankService,
  ) {}

  /**
   * 10분마다: article_raw → uas → PENDING → SUCCESS 전체 사이클
   * isRunning 플래그로 중복 실행 방지
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runPipelineCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Pipeline cycle already running, skipping');
      return;
    }

    this.isRunning = true;
    const start = Date.now();

    try {
      this.logger.log('=== Pipeline cycle started ===');

      // Step 1: article_raw 신규 → user_article_state
      const ingest = await this.ingestionService.processAllUnprocessed();
      this.logger.log(`[1/3] ingest-bulk: created=${ingest.created}`);

      // Step 2: user_article_state → PENDING ai_state
      const pregen = await this.pregenService.pregenAllPending();
      this.logger.log(`[2/3] pregen-ai-state: created=${pregen.created}`);

      // Step 3: agent_json_raw 있는 PENDING → SUCCESS
      const parse = await this.parserService.processPendingBatch();
      this.logger.log(`[3/3] parse-agent-json: success=${parse.success}, failed=${parse.failed}`);

      const elapsed = Date.now() - start;
      this.logger.log(`=== Pipeline cycle done (${elapsed}ms) ===`);
    } catch (err) {
      this.logger.error('Pipeline cycle error', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 매일 새벽 6시: MODEL_UPDATES 주간 순위 집계
   */
  @Cron('0 6 * * *')
  async runDailyStats(): Promise<void> {
    try {
      this.logger.log('Daily rank build started');
      const result = await this.rankService.buildDailyRank();
      this.logger.log(`Daily rank build done — upserted=${result.upserted}`);
    } catch (err) {
      this.logger.error('Daily rank build error', err);
    }
  }
}
