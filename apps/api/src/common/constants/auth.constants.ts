/**
 * 토큰 만료 시간 상수
 */
import process from 'node:process';

export const TOKEN_EXPIRY_USER = {
  ACCESS: 60 * 60 * 24, // 1 day
  REFRESH: 60 * 60 * 24 * 14, // 14 days
  REFRESH_TOKEN_TTL: 60 * 60 * 24 * 14, // Redis TTL(초)
  REFRESH_COOKIE: 1000 * 60 * 60 * 24 * 14, // 쿠키 만료(ms)
};

export const TOKEN_EXPIRY_ADMIN = {
  ACCESS: '3h', // 액세스 토큰 만료
  REFRESH: '7d', // 리프레시 토큰 만료
  REFRESH_COOKIE: 7 * 24 * 60 * 60 * 1000,
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60,
  VERIFICATION: '1h', // 이메일 인증 토큰 만료
} as const;

export const TOKEN_EXPIRY_MANAGER = {
  ACCESS: '3h', // 액세스 토큰 만료
  REFRESH: '7d', // 리프레시 토큰 만료
  REFRESH_COOKIE: 7 * 24 * 60 * 60 * 1000,
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60,
  VERIFICATION: '1h', // 이메일 인증 토큰 만료
} as const;

export const REFRESH_TOKEN_TIME = process.env.REFRESH_TOKEN_TIME
  ? parseInt(process.env.REFRESH_TOKEN_TIME, 10)
  : 60 * 60 * 24 * 7;
