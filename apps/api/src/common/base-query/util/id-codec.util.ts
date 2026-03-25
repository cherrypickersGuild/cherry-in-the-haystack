const UUID_V1_TO_V8_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX32_REGEX = /^[0-9a-f]{32}$/i;

export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  if (UUID_V1_TO_V8_REGEX.test(s)) return s;
  if (HEX32_REGEX.test(s)) return hex32ToUuid(s);
  return null;
}

export function uuidToBin(value: unknown): Buffer | null {
  const normalized = normalizeUuid(value);
  if (!normalized) return null;
  return Buffer.from(normalized.replace(/-/g, ''), 'hex');
}

export function binToUuid(
  value: Buffer | string | null | undefined,
): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    return normalizeUuid(value);
  }

  if (!Buffer.isBuffer(value) || value.length !== 16) return null;

  const hex = value.toString('hex');
  return hex32ToUuid(hex);
}

export function hex32ToUuid(hex32: string): string | null {
  const hex = String(hex32 ?? '')
    .trim()
    .toLowerCase();
  if (!HEX32_REGEX.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function hexToUuidUnsafe(value: unknown): string {
  const hex = String(value ?? '').toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
