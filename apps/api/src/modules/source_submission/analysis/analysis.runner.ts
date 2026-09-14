import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { callClaudeStandard } from 'src/modules/bench/anthropic.client';
import { extractMarkdown, extractPdf, looksScanned, toParagraphs, type Extracted } from './pdf-extract';
import { CONCEPT_SYSTEM, parseJson, SUMMARY_SYSTEM, wrap } from './analysis.prompt';

export type AnalysisState = 'NONE' | 'RUNNING' | 'DONE' | 'FAILED';

export interface AnalysisJson {
  state: AnalysisState;
  step?: number;
  sub?: { done: number; total: number };
  startedAt?: string;
  finishedAt?: string;
  cancelled?: boolean;
  error?: string;
  result?: AnalysisResult;
}

export interface AnalysisResult {
  struct: { chapters: number; paragraphs: number; pages: number };
  concepts: { total: number; existing: number; fresh: number; freshNames: string[] };
  duplicate: { count: number };
  summary: string[];
  cherries: { text: string; loc: string }[];
  warnings: string[];
}

export const STEPS = [
  '글자 뽑기',
  '챕터 나누기',
  '문단 자르기',
  '개념 뽑기 (LLM)',
  '기존 개념과 대조',
  '요약 정리 (LLM)',
] as const;

/** 모델은 코드에 고정한다 — BENCH_LLM_PROVIDER 를 따라가지 않는다 (D7). */
const MODEL = 'claude-haiku-4-5-20251001';

/** 한 문서에 쓰는 LLM 호출을 묶음으로 제한한다. 큰 PDF 하나가 Workshop 한도까지 먹지 않게. */
const BATCH = 15;
const MAX_BATCHES = 8;

@Injectable()
export class AnalysisRunner {
  private readonly logger = new Logger(AnalysisRunner.name);

  /** 동시에 하나만 돈다. 서버가 한 대라 프로세스 안의 플래그 하나면 된다(기획 §4-B). */
  private running: string | null = null;

  isRunning(): string | null {
    return this.running;
  }

  /**
   * 뒤에서 이어 돈다. 부르는 쪽은 기다리지 않는다.
   * 실패하면 재시도하지 않고 그대로 FAILED 로 끝낸다 (D18).
   */
  start(knex: Knex, table: string, id: string, file: { buf: Buffer; mime: string }): void {
    this.running = id;
    void this.run(knex, table, id, file)
      .catch(async (e: Error) => {
        this.logger.warn(`분석 실패 ${id}: ${e.message}`);
        await this.save(knex, table, id, {
          state: 'FAILED',
          error: e.message,
          finishedAt: new Date().toISOString(),
        });
      })
      .finally(() => {
        if (this.running === id) this.running = null;
      });
  }

  /* ── 여섯 단계 ── */

  private async run(knex: Knex, table: string, id: string, file: { buf: Buffer; mime: string }) {
    const startedAt = new Date().toISOString();
    const step = async (n: number, sub?: { done: number; total: number }) =>
      this.save(knex, table, id, { state: 'RUNNING', step: n, sub, startedAt });

    // ① 글자 뽑기
    await step(0);
    const isPdf = file.mime.startsWith('application/pdf');
    const ext: Extracted = isPdf ? await extractPdf(file.buf) : extractMarkdown(file.buf);
    if (looksScanned(ext)) {
      throw new Error('글자를 뽑지 못했습니다. 스캔 이미지 PDF 로 보입니다.');
    }

    // ② 챕터 나누기 — 목차가 없는 문서도 있으므로 못 찾으면 경고로 남긴다
    await this.stop(knex, table, id);
    await step(1);
    const chapters = countChapters(ext.text);

    // ③ 문단 자르기
    await this.stop(knex, table, id);
    await step(2);
    const paragraphs = toParagraphs(ext, !isPdf);

    // ④ 개념 뽑기 — 묶음마다 LLM. 여기가 대부분의 시간이다.
    const batches = chunk(paragraphs, BATCH).slice(0, MAX_BATCHES);
    const names = new Set<string>();
    for (let i = 0; i < batches.length; i++) {
      await this.stop(knex, table, id);
      await step(3, { done: i, total: batches.length });
      const out = await this.ask<{ concepts: string[] }>(CONCEPT_SYSTEM, batches[i].join('\n\n'));
      for (const c of out?.concepts ?? []) {
        const v = String(c).trim();
        if (v && v.length < 80) names.add(v);
      }
    }

    // ⑤ 기존 개념과 대조
    await this.stop(knex, table, id);
    await step(4);
    const existing = await matchExisting(knex, [...names]);

    // ⑥ 요약 정리 — 1회
    await this.stop(knex, table, id);
    await step(5);
    const head = paragraphs.slice(0, 25).join('\n\n').slice(0, 12_000);
    const sum = await this.ask<{ summary: string[]; cherries: string[]; warnings: string[] }>(
      SUMMARY_SYSTEM,
      head,
    );

    const duplicate = await countSimilar(knex, paragraphs);
    const warnings = [...(sum?.warnings ?? [])];
    if (chapters === 0) warnings.push('목차를 찾지 못해 챕터를 나누지 못했습니다.');
    // 실제로 잘렸을 때만 알린다 — 딱 맞아떨어진 경우까지 경고하면 거짓 경고가 된다.
    const used = batches.reduce((n, b) => n + b.length, 0);
    if (used < paragraphs.length) {
      warnings.push(`문단이 많아 앞쪽 ${used}개만 개념을 뽑았습니다 (전체 ${paragraphs.length}개).`);
    }

    const result: AnalysisResult = {
      struct: { chapters, paragraphs: paragraphs.length, pages: ext.pageCount },
      concepts: {
        total: names.size,
        existing: existing.length,
        fresh: names.size - existing.length,
        freshNames: [...names].filter((n) => !existing.includes(n.toLowerCase())).slice(0, 12),
      },
      duplicate,
      summary: sum?.summary ?? [],
      cherries: (sum?.cherries ?? []).map((t) => ({ text: t, loc: locate(paragraphs, t) })),
      warnings,
    };

    await this.save(knex, table, id, {
      state: 'DONE',
      startedAt,
      finishedAt: new Date().toISOString(),
      result,
    });
  }

  /**
   * 반려·유보하면 멈춘다. 버릴 문서에 비용을 계속 쓰지 않는다(기획 §4-B).
   * 단계 사이에서만 본다 — 도는 중간을 끊지는 않는다.
   */
  private async stop(knex: Knex, table: string, id: string) {
    const row = await knex(table).select('analysis', 'status').where('id', id).first();
    if (row?.analysis?.cancelled || row?.status === 'REJECTED' || row?.status === 'ON_HOLD') {
      throw new Error('검토자가 분석을 멈췄습니다.');
    }
  }

  /** 도구를 붙이지 않는다. 회원 키가 아니라 우리 키를 넘겨 Anthropic 경로를 강제한다(D7). */
  private async ask<T>(system: string, text: string): Promise<T | null> {
    const res = await callClaudeStandard({
      model: MODEL,
      apiKey: process.env.ANTHROPIC_API_KEY,
      system,
      maxTokens: 1500,
      messages: [{ role: 'user', content: wrap(text) }],
    });
    return parseJson<T>(res.text);
  }

  private async save(knex: Knex, table: string, id: string, patch: Partial<AnalysisJson>) {
    const row = await knex(table).select('analysis').where('id', id).first();
    const next = { ...(row?.analysis ?? {}), ...patch };
    await knex(table).where('id', id).update({ analysis: JSON.stringify(next), updated_at: knex.fn.now() });
  }
}

/* ── 규칙으로 하는 것들 (LLM 없이) ── */

function countChapters(text: string): number {
  const m = text.match(/^\s*(chapter\s+\d+|\d+\s+[A-Z][^\n]{3,60})$/gim);
  return m ? new Set(m.map((s) => s.trim().toLowerCase())).size : 0;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** 이름·별칭 둘 다 본다 — 별칭을 안 보면 이미 있는 개념을 새 것으로 센다. */
async function matchExisting(knex: Knex, names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const lower = names.map((n) => n.toLowerCase());
  const rows = await knex('handbook.concept as c')
    .leftJoin('handbook.concept_alias as a', 'a.concept_id', 'c.id')
    .whereNull('c.revoked_at')
    .andWhere((q) =>
      q.whereRaw('lower(c.canonical_name) = any(?)', [lower]).orWhereRaw('lower(a.alias_text) = any(?)', [lower]),
    )
    .select(knex.raw('lower(c.canonical_name) as n'), knex.raw('lower(a.alias_text) as a'));
  const hit = new Set<string>();
  for (const r of rows as { n: string; a: string | null }[]) {
    if (lower.includes(r.n)) hit.add(r.n);
    if (r.a && lower.includes(r.a)) hit.add(r.a);
  }
  return [...hit];
}

/** 이미 적재된 문단과 겹치는지 — 앞부분이 그대로 들어 있는 것만 센다(초기 구현). */
async function countSimilar(knex: Knex, paragraphs: string[]): Promise<{ count: number }> {
  const sample = paragraphs.slice(0, 15);
  let count = 0;
  for (const p of sample) {
    const probe = p.slice(0, 60);
    if (probe.length < 40) continue;
    const hit = await knex('handbook.paragraph_chunk')
      .whereNull('revoked_at')
      .andWhere('body_text', 'ilike', `%${probe}%`)
      .first('id');
    if (hit) count++;
  }
  return { count };
}

function locate(paragraphs: string[], sentence: string): string {
  const key = sentence.slice(0, 40);
  const i = paragraphs.findIndex((p) => p.includes(key));
  return i >= 0 ? `문단 ${i + 1}` : '위치 미상';
}
