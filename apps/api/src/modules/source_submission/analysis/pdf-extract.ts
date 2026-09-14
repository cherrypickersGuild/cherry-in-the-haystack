/**
 * PDF·MD 에서 글자를 뽑는다. 이 파일만 unpdf 를 안다.
 * 구현서 §5-1 · 기획 §1(파이썬 없이 Node 로 한다)
 *
 * `node:20-alpine` 에서 도는 것을 확인했다(2026-09-14 · 19쪽 문서로 검증).
 */
import { extractText, getDocumentProxy } from 'unpdf';

export interface Extracted {
  /** 쪽별 글자. MD 는 한 쪽으로 본다. */
  pages: string[];
  text: string;
  pageCount: number;
}

export async function extractPdf(buf: Buffer): Promise<Extracted> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text)];
  return { pages, text: pages.join('\n\n'), pageCount: totalPages };
}

export function extractMarkdown(buf: Buffer): Extracted {
  const text = buf.toString('utf8');
  return { pages: [text], text, pageCount: 1 };
}

/**
 * 쪽 글자를 문단으로 자른다.
 *
 * PDF 본문에는 **빈 줄이 없다** — 줄바꿈만 있다(19쪽 논문에서 쪽당 줄바꿈 52개·빈 줄 0개를 확인).
 * 그래서 빈 줄로 자르면 "문단" 이 아니라 "쪽" 이 나온다.
 * 대신 **짧은 줄을 문단 끝으로 본다** — 문단 마지막 줄만 폭이 남기 때문이다.
 */
export function toParagraphs(e: Extracted, isMarkdown: boolean): string[] {
  if (isMarkdown) {
    return clean(e.text.split(/\n\s*\n/));
  }
  const out: string[] = [];
  for (const page of e.pages) {
    const lines = page.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const sorted = [...lines].map((l) => l.length).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 80;
    let buf: string[] = [];
    const flush = () => {
      if (buf.length) out.push(buf.join(' '));
      buf = [];
    };
    for (const l of lines) {
      buf.push(l);
      if (l.length < median * 0.75) flush();
    }
    flush();
  }
  return clean(out);
}

/** 표·머리말 조각처럼 너무 짧은 것은 근거로 못 쓴다. */
function clean(list: string[]): string[] {
  return list.map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length >= 120);
}

/**
 * 글자가 거의 없으면 스캔본이다. 이때는 분석을 이어가지 않는다 —
 * 글자를 못 뽑는 것과 자료 가치는 별개라, 관리자가 원문을 보고 판단한다(기획 §4-D).
 */
export function looksScanned(e: Extracted): boolean {
  return e.text.replace(/\s/g, '').length < 200;
}
