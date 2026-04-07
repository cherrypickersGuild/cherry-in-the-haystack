import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ArticleIngestionService } from 'src/modules/pipeline/article-ingestion.service';
import { AiStatePreGenService } from 'src/modules/pipeline/ai-state-pregen.service';
import { AgentJsonParserService } from 'src/modules/pipeline/agent-json-parser.service';
import { ModelUpdatesRankService } from 'src/modules/stats/model-updates-rank.service';
import { FrameworksRankService } from 'src/modules/stats/frameworks-rank.service';
import { LandingStatService } from 'src/modules/stats/landing-stat.service';

@Injectable()
export class IngestionScheduleService {
  private readonly logger = new Logger(IngestionScheduleService.name);
  private isRunning = false;
  private isStatsRunning = false;

  constructor(
    private readonly ingestionService: ArticleIngestionService,
    private readonly pregenService: AiStatePreGenService,
    private readonly parserService: AgentJsonParserService,
    private readonly modelUpdatesRankService: ModelUpdatesRankService,
    private readonly frameworksRankService: FrameworksRankService,
    private readonly landingStatService: LandingStatService,
  ) {}

  /**
   * 10분마다: article_raw → uas → PENDING → SUCCESS 전체 사이클
   * isRunning 플래그로 중복 실행 방지
   * SCHEDULER_ENABLED=false 이면 cron 실행 안 함 (로컬 개발용)
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runPipelineCycle(): Promise<void> {
    if (process.env.SCHEDULER_ENABLED !== 'true') return;
    if (this.isRunning) {
      this.logger.warn('Pipeline cycle already running, skipping');
      return;
    }

    this.isRunning = true;
    const start = Date.now();

    try {
      this.logger.log('=== Pipeline cycle started ===');

      const ingest = await this.ingestionService.processAllUnprocessed();
      this.logger.log(`[1/3] ingest-bulk: created=${ingest.created}`);

      const pregen = await this.pregenService.pregenAllPending();
      this.logger.log(`[2/3] pregen-ai-state: created=${pregen.created}`);

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
   * 매일 새벽 6시: MODEL_UPDATES + FRAMEWORKS 주간 순위 집계
   * SCHEDULER_ENABLED=false 이면 cron 실행 안 함 (로컬 개발용)
   */
  @Cron('0 6 * * *')
  async runDailyStats(): Promise<void> {
    if (process.env.SCHEDULER_ENABLED !== 'true') return;
    if (this.isStatsRunning) {
      this.logger.warn('Daily stats already running, skipping');
      return;
    }
    this.isStatsRunning = true;
    try {
      this.logger.log('Daily stats build started');

      const modelUpdatesResult = await this.modelUpdatesRankService.buildDailyRank();
      this.logger.log(`[1/3] model-updates rank — upserted=${modelUpdatesResult.upserted}`);

      const frameworksResult = await this.frameworksRankService.buildDailyRank();
      this.logger.log(`[2/3] frameworks rank — upserted=${frameworksResult.upserted}`);

      const landingResult = await this.landingStatService.buildDailyStat();
      this.logger.log(`[3/3] landing stat — upserted=${landingResult.upserted}`);

      this.logger.log('Daily stats build done');
    } catch (err) {
      this.logger.error('Daily stats build error', err);
    } finally {
      this.isStatsRunning = false;
    }
  }
}
