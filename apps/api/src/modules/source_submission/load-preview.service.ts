import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';

/**
 * 적재 미리보기 — 승인 전에 **어느 표의 어느 칼럼에 무엇이 들어가는지** 본다.
 * 기획 §4-E
 *
 * 칼럼 이름·순서·기본값은 **라이브 DB 에서 읽는다.** 문서에서 베껴 쓰지 않는다 —
 * 베껴 두면 스키마가 바뀔 때 화면만 옛날 것을 계속 보여준다.
 */

/** 값이 어디서 오는지 (기획 §4-E). */
type Origin = '값' | '기본' | '빈칸' | '생성';

interface Column {
  name: string;
  origin: Origin;
  note: string;
}

interface Table {
  table: string;
  rows: number;
  columns: Column[];
  warn?: string;
  note?: string;
}

export interface LoadPreview {
  /** ① 파이프라인이 만드는 것 — 표 이름과 행 수만 */
  pipeline: { table: string; rows: number; columns: string }[];
  /** ② 옮기면 되는 것 — 칼럼을 전부 펼친다 */
  handbook: Table[];
  notice: string;
}

const HB = [
  'handbook.book',
  'handbook.chapter',
  'handbook.section',
  'handbook.paragraph_chunk',
  'handbook.concept',
  'handbook.paragraph_concept_link',
] as const;

@Injectable()
export class LoadPreviewService {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  async build(row: {
    kind: string;
    name: string;
    file_mime: string | null;
    analysis: { state?: string; result?: any } | null;
  }): Promise<LoadPreview> {
    if (row.kind !== 'FILE') throw new BadRequestException('링크는 이 표들에 들어가지 않습니다.');
    if (row.analysis?.state !== 'DONE') {
      throw new BadRequestException('분석이 끝나야 무엇이 들어갈지 알 수 있습니다.');
    }

    const r = row.analysis.result;
    const chapters = r?.struct?.chapters ?? 0;
    const paragraphs = r?.struct?.paragraphs ?? 0;
    const fresh = r?.concepts?.fresh ?? 0;
    // 문단마다 개념이 여럿 붙는다. 뽑힌 개념 수로 어림한다.
    const links = Math.max(paragraphs, r?.concepts?.total ?? 0);

    const counts: Record<string, number> = {
      'handbook.book': 1,
      'handbook.chapter': chapters,
      'handbook.section': 0,
      'handbook.paragraph_chunk': paragraphs,
      'handbook.concept': fresh,
      'handbook.paragraph_concept_link': links,
    };

    const filled = filledValues(row, r);
    const handbook: Table[] = [];
    for (const t of HB) {
      const [schema, name] = t.split('.');
      handbook.push({
        table: t,
        rows: counts[t],
        columns: await this.columns(schema, name, filled),
        ...(t === 'handbook.paragraph_chunk'
          ? { warn: `${paragraphs}개가 맞는지 보세요 — 자르기가 잘못되면 수천 개가 됩니다` }
          : {}),
        ...(t === 'handbook.concept'
          ? { warn: `새로 생기는 것만 ${fresh}행입니다. 이미 있는 것은 그대로 씁니다` }
          : {}),
        note: '첫 행만 펼칩니다',
      });
    }

    return {
      pipeline: [
        { table: 'public.books', rows: 1, columns: await this.names('public', 'books') },
        { table: 'public.chapters', rows: chapters, columns: await this.names('public', 'chapters') },
        { table: 'public.sections', rows: 0, columns: await this.names('public', 'sections') },
        { table: 'public.paragraph_chunks', rows: paragraphs, columns: await this.names('public', 'paragraph_chunks') },
        { table: 'public.key_ideas', rows: links, columns: await this.names('public', 'key_ideas') },
      ],
      handbook,
      notice:
        '②는 자동으로 되지 않습니다. 파이프라인을 돌리고 옮기기를 따로 실행해야 화면에 나옵니다. ' +
        '행 수는 추정치입니다 — 실제 적재는 다른 모델로 다시 돌립니다.',
    };
  }

  /** 라이브 DB 의 칼럼을 순서 그대로 읽는다. */
  private async columns(schema: string, table: string, filled: Record<string, string>): Promise<Column[]> {
    const rows = await this.knex('information_schema.columns')
      .select('column_name', 'column_default', 'is_nullable')
      .where({ table_schema: schema, table_name: table })
      .orderBy('ordinal_position');

    return rows.map((c: any) => {
      const name = c.column_name as string;
      if (name === 'id') return { name, origin: '생성' as Origin, note: 'uuid' };
      if (filled[name]) return { name, origin: '값' as Origin, note: filled[name] };
      if (c.column_default) return { name, origin: '기본' as Origin, note: cleanDefault(c.column_default) };
      return { name, origin: '빈칸' as Origin, note: 'NULL 로 남습니다' };
    });
  }

  private async names(schema: string, table: string): Promise<string> {
    const rows = await this.knex('information_schema.columns')
      .select('column_name')
      .where({ table_schema: schema, table_name: table })
      .orderBy('ordinal_position');
    return rows.map((c: any) => c.column_name).join(' · ');
  }
}

/** 분석이 채우는 칼럼. 여기 없는 칼럼은 기본값이거나 빈칸이다. */
function filledValues(row: { name: string; file_mime: string | null }, r: any): Record<string, string> {
  const isPdf = (row.file_mime ?? '').includes('pdf');
  return {
    title: row.name,
    source_type: isPdf ? 'PDF' : 'MARKDOWN',
    source_path: '투고 파일의 저장 경로',
    total_paragraphs: String(r?.struct?.paragraphs ?? 0),
    meta_json: '{ "submissionId": … }',
    book_id: '위 book 행을 가리킵니다',
    chapter_id: '위 chapter 행을 가리킵니다',
    section_id: '위 section 행을 가리킵니다',
    chapter_number: '1',
    page_number: '11',
    paragraph_index: '1',
    chapter_paragraph_index: '1',
    body_text: r?.cherries?.[0]?.text?.slice(0, 60) ?? '문단 본문',
    core_idea_text: '문단의 핵심 한 줄',
    canonical_name: r?.concepts?.freshNames?.[0] ?? '새 개념 이름',
    description: '개념 설명',
    paragraph_chunk_id: '위 문단을 가리킵니다',
    concept_id: '위 개념을 가리킵니다',
    paragraph_hash: '중복 검사에 씁니다',
    simhash64: '비슷한 문단 찾기에 씁니다',
  };
}

/** `'CORE'::handbook.section_kind_enum` → `CORE` */
function cleanDefault(d: string): string {
  return d.replace(/::[a-z_.]+/gi, '').replace(/^'|'$/g, '');
}
