import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * 업로드 관문.
 *
 * 확장자와 브라우저가 보낸 형식은 믿지 않는다 — 파일 선두를 직접 본다.
 * 기획: apps/docs/source-submission/1-work-guidelines.md §6-A
 */
@Injectable()
export class UploadGateService {
  private static readonly ALLOWED = ['pdf', 'md', 'markdown'] as const;

  /** 관문 ② 확장자 — 받기 전 */
  checkExtension(fileName: string): 'pdf' | 'md' {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    if (!UploadGateService.ALLOWED.includes(ext as never)) {
      throw new BadRequestException('PDF 와 MD 만 받습니다.');
    }
    return ext === 'pdf' ? 'pdf' : 'md';
  }

  /**
   * 관문 ⑤ 실제 내용 — 다 받은 뒤에 본다. 아니면 저장한 파일을 지운다.
   *
   * 확장자만 PDF 로 바꾼 실행 파일을 여기서 걸러낸다.
   * 확장자와 브라우저가 보낸 형식은 믿지 않는다.
   */
  checkMagic(head: Buffer, kind: 'pdf' | 'md'): void {
    if (kind === 'pdf') {
      if (head.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new BadRequestException('PDF 파일이 아닙니다. 내용을 확인해 주세요.');
      }
      return;
    }
    // MD 는 글자 파일이기만 하면 된다. NUL 바이트가 있으면 실행 파일·바이너리다.
    //
    // 앞부분을 UTF-8 로 디코드해 깨짐을 보는 방법은 쓰지 않는다 — 한글은 한 글자가
    // 3바이트라, 잘라온 자리가 글자 중간에 걸리면 멀쩡한 문서도 깨진 것으로 보인다.
    if (head.includes(0)) {
      throw new BadRequestException('글자로 읽을 수 없는 파일입니다.');
    }
  }

  /** 화면에 내보낼 때 붙이는 형식. text/html 은 절대 쓰지 않는다. */
  contentType(kind: 'pdf' | 'md'): string {
    return kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8';
  }

  /** 파일이 우리 도메인에서 열려도 스크립트를 못 쓰게 격리한다 (기획 §6-B). */
  safeHeaders(kind: 'pdf' | 'md'): Record<string, string> {
    return {
      'Content-Type': this.contentType(kind),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    };
  }
}
