import { formatKstYmd, shiftKstYmd } from './date.util';

export type InclusiveDateWindow = {
  startDate: string;
  endDate: string;
};

const DEFAULT_ROLLING_WINDOWS = [3, 7, 14, 30, 60, 90] as const;

function assertYmd(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function normalizeWindowDays(days: number): number {
  const n = Math.trunc(Number(days));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('window days must be >= 1');
  }
  return n;
}

export function resolveKstBaseDate(
  baseDate: string | null | undefined,
  now: Date = new Date(),
): string {
  const trimmed = String(baseDate ?? '').trim();
  if (!trimmed) return formatKstYmd(now);
  assertYmd(trimmed, 'baseDate');
  return trimmed;
}

export function resolveInclusiveDateWindow(
  endDate: string,
  days: number,
): InclusiveDateWindow {
  assertYmd(endDate, 'endDate');
  const normalizedDays = normalizeWindowDays(days);

  const startDate = shiftKstYmd(endDate, -(normalizedDays - 1));
  return { startDate, endDate };
}

export function resolveRollingEndDate(baseDate: string): string {
  assertYmd(baseDate, 'baseDate');
  return shiftKstYmd(baseDate, -1);
}

export function resolveRollingWindowMap(
  baseDate: string,
  windowDays: readonly number[] = DEFAULT_ROLLING_WINDOWS,
): Record<string, InclusiveDateWindow> {
  const rollingEnd = resolveRollingEndDate(baseDate);
  const out: Record<string, InclusiveDateWindow> = {};

  for (const days of windowDays) {
    const normalizedDays = normalizeWindowDays(days);
    const key = `${normalizedDays}d`;
    out[key] = resolveInclusiveDateWindow(rollingEnd, normalizedDays);
  }

  return out;
}
