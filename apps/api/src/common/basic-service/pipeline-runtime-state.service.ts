import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class PipelineRuntimeStateService {
  private readonly logger = new Logger(PipelineRuntimeStateService.name);
  private ordersSyncRunning = false;
  private stockSyncRunning = false;
  private readonly ORDERS_SYNC_KEY = 'runtime:sync:orders';
  private readonly STOCK_SYNC_KEY = 'runtime:sync:stocks';
  private readonly RUNTIME_STATE_TTL_SECONDS = Math.max(
    300,
    Number(process.env.PIPELINE_RUNTIME_STATE_TTL_SECONDS ?? 10 * 60),
  );

  constructor(private readonly redisService: RedisService) {}

  async isOrdersSyncRunning(): Promise<boolean> {
    return this.readFlag(this.ORDERS_SYNC_KEY, this.ordersSyncRunning);
  }

  async setOrdersSyncRunning(value: boolean): Promise<void> {
    this.ordersSyncRunning = value;
    await this.writeFlag(this.ORDERS_SYNC_KEY, value);
  }

  async isStockSyncRunning(): Promise<boolean> {
    return this.readFlag(this.STOCK_SYNC_KEY, this.stockSyncRunning);
  }

  async setStockSyncRunning(value: boolean): Promise<void> {
    this.stockSyncRunning = value;
    await this.writeFlag(this.STOCK_SYNC_KEY, value);
  }

  private async readFlag(key: string, fallback: boolean): Promise<boolean> {
    try {
      return await this.redisService.exists(key);
    } catch (error: unknown) {
      this.logger.warn(
        `[RuntimeState] Redis read failed for ${key}. Fallback to local state. reason=${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }

  private async writeFlag(key: string, value: boolean): Promise<void> {
    try {
      if (value) {
        await this.redisService.set(key, '1', this.RUNTIME_STATE_TTL_SECONDS);
      } else {
        await this.redisService.delete(key);
      }
    } catch (error: unknown) {
      this.logger.warn(
        `[RuntimeState] Redis write failed for ${key}. Local state only. reason=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
