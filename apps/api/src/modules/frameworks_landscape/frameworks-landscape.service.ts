import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Frameworks Landscape — 단일 JSON 파일 기반(DB 미사용).
 * 파일: DATA_DIR/frameworks/frameworks-landscape.json
 * 생성/재생성: apps/api/scripts/generate-frameworks-landscape.cjs
 * 기획서: apps/docs/frameworks-landscape-admin-curation-plan.md
 *
 * P2 범위: 읽기(GET)만. 관리자 쓰기(PUT/DELETE)는 P3에서 추가.
 */
export interface LandscapeItem {
  entityKey: string;
  name: string;
  desc: string;
  detail: string;
  url: string;
  stars: number | null;
  emoji: string;
  icon: string | null;
  verified: boolean;
  vendor: string | null;
}
export interface LandscapeCard {
  key: string;
  label: string;
  types: string[];
  source: 'auto' | 'admin';
  updatedAt: string;
  updatedBy: string | null;
  items: LandscapeItem[];
}
export interface Landscape {
  page: string;
  generatedAt: string;
  source: string;
  categories: LandscapeCard[];
}

/** 지원 페이지 화이트리스트(경로 조작 방지) */
export const LANDSCAPE_PAGES = ['frameworks', 'prompting'] as const;
export type LandscapePage = (typeof LANDSCAPE_PAGES)[number];
export function isLandscapePage(p: string): p is LandscapePage {
  return (LANDSCAPE_PAGES as readonly string[]).includes(p);
}

/** 데이터 루트 — 배포 시 영속 볼륨에 매핑(env DATA_DIR). 기본값은 레포 내 apps/api/storage. */
export function dataDir(): string {
  return process.env.DATA_DIR || path.resolve(__dirname, '..', '..', '..', 'storage');
}
export function landscapeFile(page: LandscapePage): string {
  return path.join(dataDir(), page, `${page}-landscape.json`);
}

@Injectable()
export class FrameworksLandscapeService {
  private readonly logger = new Logger(FrameworksLandscapeService.name);

  /** 파일 읽어 그대로 반환. 없으면 빈 구조. */
  async getLandscape(page: LandscapePage): Promise<Landscape> {
    const file = landscapeFile(page);
    try {
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as Landscape;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`landscape 파일 읽기 실패(${file}): ${msg}`);
      return { page, generatedAt: '', source: '', categories: [] };
    }
  }
}
