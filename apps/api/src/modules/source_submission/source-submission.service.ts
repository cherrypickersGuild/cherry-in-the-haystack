import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Knex } from 'knex';
import { v7 as uuidv7 } from 'uuid';
import type { Readable } from 'stream';
import { UploadGateService } from './upload-gate.service';
import { AnalysisRunner } from './analysis/analysis.runner';
import { SUBMISSION_STORAGE, type SubmissionStorage } from './submission-storage.service';
import type { SubmitUrlDto } from './input-dto/submit-url.dto';

const TABLE = 'content.source_submission';

const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_MB ?? 20);
const DAILY_COUNT = Number(process.env.UPLOAD_DAILY_COUNT_PER_USER ?? 10);
const DAILY_MB = Number(process.env.UPLOAD_DAILY_MB_PER_USER ?? 200);

/** 유저에게 돌려주는 중복 확인 결과. 남의 것이면 "있다"는 사실만 준다. */
export interface DuplicateResult {
  duplicate: boolean;
  mine?: boolean;
  name?: string;
  state?: string;
  /** 며칠 전에 올렸는지. 날짜가 아니라 경과일이다 (기획 §10-A · D5). */
  daysAgo?: number;
}

@Injectable()
export class SourceSubmissionService implements OnModuleInit {
  private readonly logger = new Logger(SourceSubmissionService.name);

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
    @Inject(SUBMISSION_STORAGE) private readonly storage: SubmissionStorage,
    private readonly gate: UploadGateService,
    private readonly runner: AnalysisRunner,
  ) {}

  /**
   * 서버가 죽으면 `RUNNING` 이 DB 에 남아 화면에 영원히 "진행 중" 이 박힌다.
   * 뜰 때 한 번 훑어 정리한다 — **30분 넘은 것만**(D19).
   *
   * 다 끄면 안 된다. 로컬과 프로덕션이 **같은 DB 를 본다**(지침 §7 🔴).
   * 로컬에서 서버를 재시작할 때마다 프로덕션에서 돌던 분석이 꺼진다.
   */
  async onModuleInit(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const stuck = await this.knex(TABLE)
      .whereRaw("analysis->>'state' = 'RUNNING'")
      .andWhereRaw("coalesce(analysis->>'startedAt', '') < ?", [cutoff])
      .update({
        analysis: this.knex.raw(
          `analysis || jsonb_build_object('state','FAILED','error','서버가 멈춰 분석이 끊겼습니다.')`,
        ),
      });
    if (stuck) this.logger.log(`멈춰 있던 분석 ${stuck}건을 실패로 정리했습니다.`);
  }

  /* ══════════ 유저 ══════════ */

  /** 링크 투고 */
  async submitUrl(userId: string, dto: SubmitUrlDto) {
    const dup = await this.findByUrl(dto.url);
    if (dup) throw new ConflictException(this.toDuplicate(dup, userId));

    const id = uuidv7();
    await this.knex(TABLE).insert({
      id,
      submitted_by_user_id: userId,
      kind: 'URL',
      url: dto.url,
      name: dto.name,
      reason: dto.reason ?? null,
    });
    return { id };
  }

  /**
   * 파일 투고. 관문 순서는 기획 §6-A 그대로다.
   *
   *   받기 전    ① 로그인(컨트롤러) ② 확장자 ③ 한도
   *   받으면서   ④ 크기 — multer 가 20MB 에서 끊는다
   *   저장하며   ⑤ 해시 — 디스크에 쓰면서 같이 난다
   *   쓴 뒤      ⑥ 실제 내용(선두)  ⑦ 중복
   *
   * ⑥⑦ 에서 걸리면 저장한 파일을 지우고 DB 행은 만들지 않는다.
   */
  async submitFile(
    userId: string,
    stream: Readable,
    fileName: string,
    name: string,
    reason: string | undefined,
  ) {
    const kind = this.gate.checkExtension(fileName);
    await this.assertDailyQuota(userId);

    const stored = await this.storage.save(stream, kind, MAX_FILE_MB * 1024 * 1024);

    try {
      const head = await this.readHead(stored.key, 1024);
      this.gate.checkMagic(head, kind);

      const dup = await this.findBySha256(stored.sha256);
      if (dup) throw new ConflictException(this.toDuplicate(dup, userId));

      const id = uuidv7();
      await this.knex(TABLE).insert({
        id,
        submitted_by_user_id: userId,
        kind: 'FILE',
        url: null,
        name,
        reason: reason ?? null,
        file_key: stored.key,
        file_name: fileName,
        file_size: stored.size,
        file_mime: this.gate.contentType(kind),
        file_sha256: stored.sha256,
      });
      return { id };
    } catch (e) {
      await this.storage.remove(stored.key).catch(() => undefined);
      throw e;
    }
  }

  /** 중복 확인 — 링크 전용. 파일은 올려봐야 안다(해시를 서버가 계산하므로). */
  async checkUrl(userId: string, url: string): Promise<DuplicateResult> {
    const row = await this.findByUrl(url);
    if (!row) return { duplicate: false };
    return this.toDuplicate(row, userId);
  }

  /** 내 투고만. 남의 것은 여기서 아예 나가지 않는다. */
  async listMine(userId: string) {
    return this.knex(TABLE)
      .select(
        'id', 'kind', 'url', 'name', 'status',
        'file_name', 'file_size', 'reviewer_note', 'created_at',
      )
      .where('submitted_by_user_id', userId)
      .orderBy('created_at', 'desc');
  }

  /* ══════════ 관리자 ══════════ */

  /** 목록. 파일 본문도 파일 주소(`file_key`)도 주지 않는다 (기획 §4-A). */
  async adminList(kind?: 'FILE' | 'URL', status?: string) {
    const q = this.knex(TABLE)
      .select(
        'id', 'kind', 'url', 'name', 'reason', 'status',
        'file_name', 'file_size', 'file_mime',
        'submitted_by_user_id', 'reviewed_at', 'created_at',
        this.knex.raw("analysis->>'state' as analysis_state"),
      )
      .orderBy('created_at', 'desc');
    if (kind) q.where('kind', kind);
    if (status) q.where('status', status);
    return q;
  }

  /** 상세. 목록과 같은 이유로 파일 본문·경로를 빼고 준다. */
  async adminGet(id: string) {
    const row = await this.knex(TABLE)
      .select(
        'id', 'kind', 'url', 'name', 'reason', 'status',
        'file_name', 'file_size', 'file_mime', 'file_sha256',
        'submitted_by_user_id', 'reviewed_by_user_id', 'reviewed_at',
        'analysis', 'created_at',
      )
      .where('id', id)
      .first();
    if (!row) throw new NotFoundException('없는 투고입니다.');
    return row;
  }

  /** 원문. [원문 보기]·[내려받기] 를 눌렀을 때만 부른다. */
  async adminFile(id: string) {
    const row = await this.knex(TABLE)
      .select('file_key', 'file_name', 'file_mime', 'kind')
      .where('id', id)
      .first();
    if (!row || row.kind !== 'FILE' || !row.file_key) {
      throw new NotFoundException('파일이 없는 투고입니다.');
    }
    return {
      stream: await this.storage.read(row.file_key),
      fileName: row.file_name as string,
      mime: (row.file_mime as string) ?? 'application/octet-stream',
    };
  }

  /**
   * 승인·유보·반려. 사유는 받지 않는다 (기획 §4-D).
   * 되돌릴 수 있다 — 현재 상태와 무관하게 받는다 (D14).
   * 다만 파일 승인은 분석을 한 번 돌려본 뒤에만 된다 (D9).
   */
  async decide(id: string, next: 'APPROVED' | 'ON_HOLD' | 'REJECTED', adminId: string) {
    const row = await this.knex(TABLE).select('kind', 'analysis').where('id', id).first();
    if (!row) throw new NotFoundException('없는 투고입니다.');

    if (next === 'APPROVED' && row.kind === 'FILE') {
      const state = row.analysis?.state ?? 'NONE';
      if (state === 'NONE' || state === 'RUNNING') {
        throw new BadRequestException('분석을 한 번 돌려본 뒤에 승인할 수 있습니다.');
      }
    }

    await this.knex(TABLE).where('id', id).update({
      status: next,
      reviewed_by_user_id: adminId,
      reviewed_at: this.knex.fn.now(),
      updated_at: this.knex.fn.now(),
      // 버릴 문서에 LLM 비용을 계속 쓰지 않는다 (기획 §4-B).
      ...(next === 'REJECTED' || next === 'ON_HOLD'
        ? { analysis: this.knex.raw(`coalesce(analysis,'{}'::jsonb) || '{"cancelled":true}'::jsonb`) }
        : {}),
    });
    return { id, status: next };
  }

  /** 고른 링크를 조사 목록 JSON 으로 (기획 §5-B). */
  async exportLinks(ids: string[]) {
    const rows = await this.knex(TABLE)
      .select('url', 'reason', 'submitted_by_user_id')
      .whereIn('id', ids)
      .andWhere('kind', 'URL');
    return {
      count: rows.length,
      items: rows.map((r: any) => ({
        url: r.url,
        submittedBy: r.submitted_by_user_id,
        submitterNote: r.reason ?? '',
        toFillList: ['type', 'name', 'urlHandle'],
        type: null,
        name: null,
        urlHandle: null,
        frequency: null,
        description: null,
        homepageUrl: null,
        language: null,
        verdict: null,
      })),
    };
  }

  /* ══════════ 분석 ══════════ */

  /** [분석하기]. 응답을 먼저 돌려주고 처리는 뒤에서 이어간다(구현서 §5-2). */
  async startAnalysis(id: string) {
    if (process.env.SUBMISSION_ANALYSIS_ENABLED === 'false') {
      throw new BadRequestException('지금은 분석 기능을 꺼 두었습니다.');
    }
    const row = await this.knex(TABLE)
      .select('kind', 'file_key', 'file_mime', 'analysis')
      .where('id', id)
      .first();
    if (!row) throw new NotFoundException('없는 투고입니다.');
    if (row.kind !== 'FILE') throw new BadRequestException('링크는 분석하지 않습니다.');

    // 끝난 것도 다시 돌릴 수 있다 (D13). 막는 것은 지금 도는 중일 때뿐이다.
    const state = row.analysis?.state ?? 'NONE';
    if (state === 'RUNNING') throw new ConflictException('이미 분석 중입니다.');
    if (this.runner.isRunning()) throw new ConflictException('이미 분석 중입니다.');

    const buf = await this.readAll(row.file_key);
    await this.knex(TABLE).where('id', id).update({
      analysis: JSON.stringify({
        state: 'RUNNING',
        step: 0,
        cancelled: false,
        startedAt: new Date().toISOString(),
      }),
      updated_at: this.knex.fn.now(),
    });
    this.runner.start(this.knex, TABLE, id, { buf, mime: row.file_mime ?? '' });
    return { state: 'RUNNING' };
  }

  /** 적재 미리보기에 필요한 것만 준다 (기획 §4-E). */
  async loadPreviewRow(id: string) {
    const row = await this.knex(TABLE)
      .select('kind', 'name', 'file_mime', 'analysis')
      .where('id', id)
      .first();
    if (!row) throw new NotFoundException('없는 투고입니다.');
    return row;
  }

  /** 화면이 몇 초마다 부른다. */
  async getAnalysis(id: string) {
    const row = await this.knex(TABLE).select('analysis').where('id', id).first();
    if (!row) throw new NotFoundException('없는 투고입니다.');
    return row.analysis ?? { state: 'NONE' };
  }

  /* ══════════ 내부 ══════════ */

  private async readAll(key: string): Promise<Buffer> {
    const s = await this.storage.read(key);
    const chunks: Buffer[] = [];
    for await (const c of s) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  /** 남의 투고면 "있다"는 사실만. 자료명·투고자·상태는 주지 않는다. */
  private toDuplicate(row: any, userId: string): DuplicateResult {
    if (row.submitted_by_user_id !== userId) return { duplicate: true, mine: false };
    return {
      duplicate: true,
      mine: true,
      name: row.name,
      state: row.status,
      daysAgo: this.daysAgo(row.created_at),
    };
  }

  /**
   * 며칠 지났는지. 날짜(MM-DD)로 주지 않는다 —
   * UTC 로 찍으면 한국 시간 오전에 올린 것이 어제로 보인다.
   */
  private daysAgo(at: string | Date): number {
    const ms = Date.now() - new Date(at).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  private findByUrl(url: string) {
    return this.knex(TABLE).where('url', url).first();
  }

  private findBySha256(sha256: string) {
    return this.knex(TABLE).where('file_sha256', sha256).first();
  }

  /** 하루 건수·용량 한도 */
  private async assertDailyQuota(userId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = await this.knex(TABLE)
      .where('submitted_by_user_id', userId)
      .andWhere('kind', 'FILE')          // 한도는 파일에만 건다 (기획 §6-A)
      .andWhere('created_at', '>=', since)
      .count({ n: '*' })
      .sum({ bytes: 'file_size' })
      .first();

    const n = Number(row?.n ?? 0);
    const bytes = Number(row?.bytes ?? 0);
    if (n >= DAILY_COUNT) {
      throw new BadRequestException(`하루에 ${DAILY_COUNT}건까지 올릴 수 있습니다.`);
    }
    if (bytes >= DAILY_MB * 1024 * 1024) {
      throw new BadRequestException(`하루에 ${DAILY_MB}MB까지 올릴 수 있습니다.`);
    }
  }

  /** 저장된 파일의 앞부분만 읽는다. 선두 확인용. */
  private async readHead(key: string, bytes: number): Promise<Buffer> {
    const s = await this.storage.read(key);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let got = 0;
      s.on('data', (c: Buffer) => {
        chunks.push(c);
        got += c.length;
        if (got >= bytes) s.destroy();
      });
      s.on('close', () => resolve(Buffer.concat(chunks).subarray(0, bytes)));
      s.on('error', reject);
    });
  }
}
