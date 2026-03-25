function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function parseYmd(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function shiftYmd(baseYmd: string, days: number): string | null {
  const base = parseYmd(baseYmd);
  if (!base) return null;
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatYmd(shifted);
}

export function formatKstYmd(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

export function shiftKstYmd(baseYmd: string, deltaDays: number): string {
  const d = new Date(`${baseYmd}T00:00:00+09:00`);
  d.setDate(d.getDate() + deltaDays);
  return formatKstYmd(d);
}
