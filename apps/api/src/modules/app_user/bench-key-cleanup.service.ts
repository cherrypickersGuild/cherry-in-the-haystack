import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Knex } from 'knex';

/**
 * 만료된 벤치마크 API 키 청소 (3중 방어의 ③)
 *
 * ①(DB 만료시각) · ②(읽을 때 검사 + 즉시 삭제)가 실제 '만료'를 보장하고,
 * 이 크론은 **로그인하지 않고 방치된 계정의 암호문을 DB에서 물리적으로 지우는** 역할이다.
 *
 * ⚠️ 설계 원칙
 *  - WHERE 절에 `is_active` / `revoked_at` 을 넣지 않는다.
 *    비활성 사용자의 키는 ②가 영원히 실행되지 않으므로, 사용자 상태와 무관하게 지워야 한다.
 *  - `updated_at` 을 갱신하지 않는다. 대량 UPDATE 가 '사용자 정보 수정'으로 오인되면 안 된다.
 *  - 키 값·마스킹값을 **절대 로그에 남기지 않는다.** 건수만 기록한다.
 *
 * 기획서: apps/docs/bench-key-72h-expiry-implementation-plan.md
 */
@Injectable()
export class BenchKeyCleanupService {
  private readonly logger = new Logger(BenchKeyCleanupService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredBenchKeys(): Promise<void> {
    try {
      const purged = await this.knex('core.app_user')
        .whereNotNull('bench_api_key_enc')
        .where((qb) =>
          qb
            .whereNull('bench_api_key_expires_at') // 만료시각 미상 = 만료로 간주(fail-safe)
            .orWhere('bench_api_key_expires_at', '<', this.knex.fn.now()),
        )
        .update({
          bench_api_key_enc: null,
          bench_api_key_expires_at: null,
        });

      if (purged > 0) {
        this.logger.log(`expired bench key purged: ${purged}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`bench key purge failed — ${msg}`);
    }
  }
}
