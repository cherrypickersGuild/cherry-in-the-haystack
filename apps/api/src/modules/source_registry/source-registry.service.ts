import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';

/**
 * 소스 관리 — 노션에서 옮겨 온 표를 읽고 고친다.
 * 기획: apps/docs/source-registry/1-work-guidelines.md
 *
 * 표·칼럼이 **데이터로 정의**돼 있어(D5), 칼럼을 늘려도 DB 마이그레이션이 없다.
 * 값은 전부 `source_row.cells` 한 칸에 들어 있다.
 */

const T = 'content.source_table';
const F = 'content.source_field';
const R = 'content.source_row';

/** 칼럼 종류는 여섯뿐이다 (D4). */
const KINDS = ['text', 'url', 'long', 'select', 'multi', 'date'] as const;
type Kind = (typeof KINDS)[number];

@Injectable()
export class SourceRegistryService {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  /** 왼쪽 표 목록. 건수를 같이 준다. */
  async tables() {
    return this.knex(`${T} as t`)
      .whereNull('t.revoked_at')
      .select('t.key', 't.label', 't.url_field')
      .select(
        this.knex.raw(
          `(select count(*) from ${R} r where r.table_id = t.id and r.revoked_at is null)::int as rows`,
        ),
      )
      .orderBy('t.sort');
  }

  /** 한 표의 칼럼 정의와 행. 행이 많지 않아 한 번에 준다. */
  async table(key: string) {
    const t = await this.knex(T).where({ key }).whereNull('revoked_at').first();
    if (!t) throw new NotFoundException('없는 표입니다.');

    const [fields, rows] = await Promise.all([
      this.knex(F).where('table_id', t.id).whereNull('revoked_at')
        .select('id', 'key', 'label', 'kind', 'options', 'sort').orderBy('sort'),
      this.knex(R).where('table_id', t.id).whereNull('revoked_at')
        .select('id', 'cells', 'source_id', 'origin', 'created_at').orderBy('created_at'),
    ]);
    return { table: { key: t.key, label: t.label, urlField: t.url_field }, fields, rows };
  }

  /**
   * 칸 하나 고치기.
   *
   * **행 전체를 받지 않는다.** 두 사람이 다른 칸을 고쳐도 서로를 지우지 않게 하려는 것이다.
   * `cells` 에 그 열쇠 하나만 합친다.
   */
  async setCell(rowId: string, key: string, value: unknown) {
    if (!key || /[^a-z0-9_]/.test(key)) throw new BadRequestException('칼럼 이름이 이상합니다.');
    const row = await this.knex(R).where('id', rowId).whereNull('revoked_at').first();
    if (!row) throw new NotFoundException('없는 행입니다.');

    // 빈 값은 칸을 지운다 — 빈 문자열을 남기면 화면에서 "값이 있다"로 보인다.
    const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0);
    const patch = empty
      ? this.knex.raw('cells - ?', [key])
      : this.knex.raw('cells || ?::jsonb', [JSON.stringify({ [key]: value })]);

    await this.knex(R).where('id', rowId).update({ cells: patch, updated_at: this.knex.fn.now() });
    return this.knex(R).where('id', rowId).first('id', 'cells');
  }

  /** 빈 행 하나. 화면이 첫 칸을 바로 열어 준다. */
  async addRow(tableKey: string, userId: string) {
    const t = await this.knex(T).where({ key: tableKey }).whereNull('revoked_at').first();
    if (!t) throw new NotFoundException('없는 표입니다.');
    const [row] = await this.knex(R)
      .insert({ table_id: t.id, cells: '{}', origin: 'USER', created_by: userId })
      .returning(['id', 'cells', 'source_id', 'origin', 'created_at']);
    return row;
  }

  /** 행 삭제 — 소프트 삭제(D10). 화면에서만 사라지고 DB 에는 남는다. */
  async removeRow(rowId: string) {
    const n = await this.knex(R).where('id', rowId).whereNull('revoked_at')
      .update({ revoked_at: this.knex.fn.now() });
    if (!n) throw new NotFoundException('없는 행입니다.');
    return { id: rowId };
  }

  /** 칼럼 추가. 기존 행은 건드리지 않는다 — 값이 없으면 화면에서 `—` 로 보인다. */
  async addField(tableKey: string, input: { label: string; kind: Kind }) {
    const t = await this.knex(T).where({ key: tableKey }).whereNull('revoked_at').first();
    if (!t) throw new NotFoundException('없는 표입니다.');
    const label = String(input.label ?? '').trim();
    if (!label) throw new BadRequestException('칼럼 이름을 적어 주세요.');
    if (!KINDS.includes(input.kind)) throw new BadRequestException('없는 칼럼 종류입니다.');

    const max = await this.knex(F).where('table_id', t.id).max('sort as m').first();
    const key = await this.freeKey(t.id, label);
    const [field] = await this.knex(F)
      .insert({
        table_id: t.id, key, label, kind: input.kind,
        options: input.kind === 'multi' || input.kind === 'select' ? '[]' : null,
        sort: Number(max?.m ?? 0) + 1,
      })
      .returning(['id', 'key', 'label', 'kind', 'options', 'sort']);
    return field;
  }

  /**
   * 칼럼 이름·선택지 고치기.
   * **`key` 는 안 바꾼다.** 바꾸면 행에 들어 있는 값이 전부 길을 잃는다.
   */
  async updateField(fieldId: string, input: { label?: string; options?: string[] }) {
    const patch: Record<string, unknown> = { updated_at: this.knex.fn.now() };
    if (input.label !== undefined) {
      const label = String(input.label).trim();
      if (!label) throw new BadRequestException('칼럼 이름을 적어 주세요.');
      patch.label = label;
    }
    if (input.options !== undefined) patch.options = JSON.stringify(input.options);

    const n = await this.knex(F).where('id', fieldId).whereNull('revoked_at').update(patch);
    if (!n) throw new NotFoundException('없는 칼럼입니다.');
    return this.knex(F).where('id', fieldId).first('id', 'key', 'label', 'kind', 'options', 'sort');
  }

  /* ── 내부 ── */

  /**
   * 한글 라벨이어도 안전한 열쇠를 만든다. 겹치면 뒤에 숫자를 붙인다.
   *
   * 열쇠는 영숫자만 쓴다 — `cells` 의 열쇠이자 API 가 검사하는 값이라
   * 한글이 들어가면 칸을 고칠 때 거절된다. 사람이 보는 이름은 `label` 이 따로 맡는다.
   */
  private async freeKey(tableId: string, label: string): Promise<string> {
    const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    // 한글만 있는 이름은 영숫자가 하나도 안 남는다 → col2 · col3 … 으로 번호를 준다
    const n = await this.knex(F).where('table_id', tableId).count({ c: '*' }).first();
    const base = ascii || `col${Number(n?.c ?? 0) + 1}`;
    for (let i = 0; i < 50; i++) {
      const key = i === 0 ? base : `${base}_${i}`;
      const dup = await this.knex(F).where({ table_id: tableId, key }).first('id');
      if (!dup) return key;
    }
    throw new BadRequestException('칼럼 이름이 너무 많이 겹칩니다.');
  }
}
