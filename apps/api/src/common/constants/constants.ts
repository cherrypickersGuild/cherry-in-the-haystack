import * as process from 'node:process';

const resolvedJwtSecret = String(process.env.JWT_SECRET ?? '').trim();
if (!resolvedJwtSecret) {
  const env = String(process.env.NODE_ENV ?? '').toLowerCase();
  if (env === 'production') {
    throw new Error(
      'JWT_SECRET is required in production environment. Refusing to start with an insecure default secret.',
    );
  }
}

export const jwtConstants = {
  // 운영에서는 필수, 개발/테스트에서만 제한적 fallback 허용
  secret: resolvedJwtSecret || 'default-secret-key-for-dev-only',
};

export const RATE_LIMIT_OPTIONS = {
  windowMs: 5 * 60 * 1000, // 5분 동안
  limit: 500, // 최대 300회 요청
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
};

const parsedStatsAutoRecomputeDays = Number.parseInt(
  String(process.env.STATS_AUTO_RECOMPUTE_DAYS ?? '1'),
  10,
);

export const STATS_AUTO_RECOMPUTE_DAYS =
  Number.isFinite(parsedStatsAutoRecomputeDays) &&
  parsedStatsAutoRecomputeDays >= 1
    ? parsedStatsAutoRecomputeDays
    : 1;

// S3 관련 상수
export const S3_CONSTANTS = {
  URL_DELIMITER: '.com/',
} as const;

// 기본값 상수
export const MAX_CONTENT = 50;

export const DEFAULTS = {
  LIMIT: 10,
  OFFSET: 0,
  MARGIN: 24,
} as const;
