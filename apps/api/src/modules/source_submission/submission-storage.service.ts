import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

/** 저장된 결과. key 는 경로만 담는다 — 서버 경로·버킷 이름은 넣지 않는다. */
export interface StoredFile {
  key: string;
  size: number;
  sha256: string;
}

/**
 * 투고 파일 저장 창구.
 *
 * 지금은 서버 폴더에 쓴다(임시). S3 를 받으면 이 인터페이스를 구현한
 * S3Storage 를 붙이고 provider 한 줄만 바꾼다.
 * 기획: apps/docs/source-submission/1-work-guidelines.md §2
 */
export interface SubmissionStorage {
  save(stream: Readable, ext: string, maxBytes: number): Promise<StoredFile>;
  read(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

/** 파일 크기가 한도를 넘으면 그 자리에서 던진다. 다 받고 나서 재지 않는다. */
class SizeLimitExceeded extends Error {}

@Injectable()
export class LocalDiskStorage implements SubmissionStorage, OnModuleInit {
  private readonly logger = new Logger(LocalDiskStorage.name);
  /**
   * 절대경로로 바꿔 둔다. 로컬 설정이 `./.uploads` 같은 상대경로라서,
   * 그대로 두면 아래 toPath 의 가드가 저장을 전부 막는다.
   */
  private readonly root = process.env.UPLOAD_DIR ? resolve(process.env.UPLOAD_DIR) : '';

  /**
   * 기동 점검.
   *
   * 설정을 깜빡해도 서버는 멀쩡히 돌고 파일도 저장되는 것처럼 보인다.
   * 문제는 몇 주 뒤 배포할 때 드러난다 — 그동안 쌓인 파일이 한꺼번에 사라진다.
   *
   * 로컬도 똑같이 막는다. 로컬만 봐주면 설정을 빠뜨린 걸 모르고 배포된다.
   * 기획: apps/docs/source-submission/1-work-guidelines.md §2
   */
  async onModuleInit(): Promise<void> {
    if (!this.root) {
      throw new Error(
        '[submission-storage] UPLOAD_DIR 이 없다. ' +
          '로컬은 ./.uploads, 서버는 /data/uploads 를 잡는다.',
      );
    }

    try {
      await mkdir(this.root, { recursive: true });
      const probe = join(this.root, `.write-probe-${randomUUID()}`);
      await writeFile(probe, 'ok');
      await rm(probe);
      this.logger.log(`업로드 폴더 확인: ${this.root}`);
    } catch (e) {
      throw new Error(
        `[submission-storage] UPLOAD_DIR(${this.root}) 에 쓸 수 없다: ${(e as Error).message}`,
      );
    }
  }

  /**
   * 스트림으로 받아 쓴다. Buffer 로 받으면 파일이 메모리에 통째로 올라간다.
   * 크기와 해시를 쓰는 동안 같이 센다 — 파일을 두 번 읽지 않는다.
   */
  async save(stream: Readable, ext: string, maxBytes: number): Promise<StoredFile> {
    const key = this.makeKey(ext);
    const full = this.toPath(key);
    await mkdir(dirname(full), { recursive: true });

    const hash = createHash('sha256');
    let size = 0;

    try {
      await pipeline(
        stream,
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > maxBytes) throw new SizeLimitExceeded();
            hash.update(chunk);
            yield chunk;
          }
        },
        createWriteStream(full),
      );
    } catch (e) {
      await rm(full, { force: true }).catch(() => undefined);
      if (e instanceof SizeLimitExceeded) {
        throw new PayloadTooLargeException(
          `파일이 ${Math.floor(maxBytes / 1024 / 1024)}MB 를 넘습니다.`,
        );
      }
      throw new InternalServerErrorException('파일 저장 실패', { cause: e });
    }

    return { key, size, sha256: hash.digest('hex') };
  }

  async read(key: string): Promise<Readable> {
    const full = this.toPath(key);
    await stat(full);
    return createReadStream(full);
  }

  async remove(key: string): Promise<void> {
    await rm(this.toPath(key), { force: true });
  }

  /* ── 내부 ── */

  /** 2026/09/<uuid>.pdf — 유저가 준 파일 이름은 경로에 쓰지 않는다. */
  private makeKey(ext: string): string {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const clean = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${yyyy}/${mm}/${randomUUID()}.${clean}`;
  }

  /** key 가 폴더 밖을 가리키면 던진다. key 는 우리가 만들지만 가드는 남겨둔다. */
  private toPath(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new InternalServerErrorException('잘못된 파일 경로');
    }
    return full;
  }
}

export const SUBMISSION_STORAGE = 'SUBMISSION_STORAGE';
