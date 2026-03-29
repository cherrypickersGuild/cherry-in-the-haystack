import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import config from 'src/config';

/**
 * Redis 데이터베이스와의 연결 및 기본 CRUD 작업을 수행하는 서비스입니다.
 */
@Injectable()
export class RedisService {
  private redis: Redis;

  /**
   * ConfigService 설정 값을 불러와 Redis 인스턴스를 생성합니다.
   * @param configService 애플리케이션 설정 관리 서비스
   */
  constructor(private configService: ConfigService) {
    // Redis 인스턴스 생성 (host, port, password 설정)
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
    });
  }

  /**
   * 주어진 키에 값을 저장하며, 지정된 TTL(초 단위) 후 만료됩니다.
   * @param key 저장할 키
   * @param value 저장할 값 (JSON.stringify를 사용하여 직렬화)
   * @param ttl 만료 시간(초)
   */
  async set(key: string, value: unknown, ttl: number) {
    const toStore = typeof value === 'string' ? value : JSON.stringify(value);
    await this.redis.set(key, toStore, 'EX', ttl);
  }

  async setNxEx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * 주어진 키에 해당하는 값을 조회하며, JSON.parse를 통해 객체로 변환하여 반환합니다.
   * @param key 조회할 키
   * @returns 저장된 값이 존재하면 객체, 없으면 null
   */
  async get(key: string) {
    const data = await this.redis.get(key);
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return data; // JSON이 아니면 원본 문자열 그대로 반환
    }
  }

  async getString(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  /**
   * 주어진 키에 해당하는 값을 Redis에서 삭제합니다.
   * @param key 삭제할 키
   */
  async delete(key: string) {
    await this.redis.del(key);
  }

  async deleteByPrefix(prefix: string, scanCount = 500): Promise<number> {
    const normalized = prefix?.trim();
    if (!normalized) return 0;

    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${normalized}*`,
        'COUNT',
        String(scanCount),
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async acquireIfAllAbsent(
    targetKey: string,
    value: string,
    ttlSeconds: number,
    blockedKeys: string[],
  ): Promise<boolean> {
    const script = `
      for i = 1, (#KEYS - 1) do
        if redis.call('exists', KEYS[i]) == 1 then
          return 0
        end
      end

      if redis.call('set', KEYS[#KEYS], ARGV[1], 'NX', 'EX', ARGV[2]) then
        return 1
      end

      return 0
    `;

    const keys = [...blockedKeys, targetKey];
    const result = await this.redis.eval(
      script,
      keys.length,
      ...keys,
      value,
      String(ttlSeconds),
    );
    return Number(result) === 1;
  }

  async releaseIfValueMatches(
    key: string,
    expectedValue: string,
  ): Promise<boolean> {
    const script = `
      local current = redis.call('get', KEYS[1])
      if current == ARGV[1] then
        return redis.call('del', KEYS[1])
      end
      return 0
    `;

    const result = await this.redis.eval(script, 1, key, expectedValue);
    return Number(result) === 1;
  }

  /**
   * Redis Set에 값을 추가합니다.
   * @param key Redis Set 키
   * @param value 추가할 값
   */
  async sadd(key: string, value: string) {
    await this.redis.sadd(key, value);
  }

  /**
   * Redis Set에서 특정 값을 제거합니다.
   * @param key Redis Set 키
   * @param value 제거할 값
   */
  async srem(key: string, value: string) {
    await this.redis.srem(key, value);
  }

  /**
   * Redis Set에 특정 값이 존재하는지 확인합니다.
   * @param key Redis Set 키
   * @param value 확인할 값
   * @returns 존재 여부 (true/false)
   */
  async sismember(key: string, value: string): Promise<boolean> {
    const result = await this.redis.sismember(key, value);
    return result === 1;
  }

  /**
   * Redis 키에 TTL을 설정합니다.
   * @param key Redis 키
   * @param seconds TTL (초 단위)
   */
  async expire(key: string, seconds: number) {
    await this.redis.expire(key, seconds);
  }

  /**
   * Redis Set의 모든 멤버를 조회합니다.
   * @param key Redis Set 키
   * @returns Set에 저장된 모든 값의 배열
   */
  // [수정] smembers 메서드 추가: Redis Set의 모든 토큰 조회
  async smembers(key: string): Promise<string[]> {
    return await this.redis.smembers(key);
  }

  /**
   * Redis 키의 TTL(만료 시간)을 조회합니다.
   * @param key Redis 키
   * @returns TTL (초 단위), 키가 없거나 만료 시간이 설정되지 않으면 -1 또는 -2 반환
   */
  // [수정] ttl 메서드 추가: Set의 만료 시간 확인
  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }
}
