/**
 * 대칭 암호화 유틸 — 회원 Anthropic API 키를 DB에 암호화 저장/복호화한다.
 * AES-256-GCM. 복호화 키는 env BENCH_KEY_SECRET (64 hex chars = 32 bytes).
 * 저장 형식: base64(iv):base64(authTag):base64(ciphertext)
 * 평문 키는 DB/로그/응답 어디에도 남기지 않는다 (마스킹만 노출).
 * 참고: docs/bench-member-key-implementation-plan.md §4-2
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM 권장

function getKey(): Buffer {
  const secret = process.env.BENCH_KEY_SECRET;
  if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error(
      'BENCH_KEY_SECRET must be a 64-char hex string (32 bytes). Generate: `openssl rand -hex 32`',
    );
  }
  return Buffer.from(secret, 'hex');
}

/** 평문 → 'iv:tag:cipher' (base64) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** 'iv:tag:cipher' → 평문 */
export function decryptSecret(enc: string): string {
  const parts = enc.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const out = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return out.toString('utf8');
}

/** 표시용 마스킹: 'sk-ant-…AB12' */
export function maskKey(plain: string): string {
  if (plain.length <= 12) return `${plain.slice(0, 4)}…`;
  return `${plain.slice(0, 7)}…${plain.slice(-4)}`;
}
