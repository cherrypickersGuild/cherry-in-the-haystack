import * as dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config();

const config = {
  local: {
    webEndpoint: process.env.LOCAL_WEB_ENDPOINT || 'http://localhost:3000',
    db: {
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '13306', 10),
      user: process.env.LOCAL_DB_USER,
      password: process.env.LOCAL_DB_PASSWORD,
      database: process.env.LOCAL_DB_NAME,
    },
    redis: {
      host: process.env.LOCAL_REDIS_HOST || '127.0.0.1',
      port: 16379,
    },
  },

  staging: {
    webEndpoint: process.env.STAGING_WEB_ENDPOINT || '',
    db: {
      host: process.env.STAGING_DB_HOST,
      port: parseInt(process.env.STAGING_DB_PORT || '3306', 10),
      user: process.env.STAGING_DB_USER,
      password: process.env.STAGING_DB_PASSWORD,
      database: process.env.STAGING_DB_NAME,
    },
    redis: {
      host: process.env.STAGING_REDIS_HOST || 'host.docker.internal',
      port: 6379,
    },
  },

  production: {
    webEndpoint: process.env.PROD_WEB_ENDPOINT || '',
    db: {
      host: process.env.PROD_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.PROD_DB_PORT || '3306', 10),
      user: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASSWORD,
      database: process.env.PROD_DB_NAME,
    },
    redis: {
      host: process.env.PROD_REDIS_HOST || 'localhost',
      port: 6379,
    },
  },
};

const env = process.env.ENVIRONMENT || 'local';

// Operation Standard Filters
export const BOARD_OPERATION_STANDARDS = (
  process.env.BOARD_OPERATION_STANDARDS || '정상판매,운영중단'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

export const STATS_OPERATION_STANDARDS = (
  process.env.STATS_OPERATION_STANDARDS || '정상판매,운영중단'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// 타입 안전성을 위해 keyof typeof config 사용
export default config[env as keyof typeof config];
