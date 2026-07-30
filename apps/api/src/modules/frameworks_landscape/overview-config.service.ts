import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { dataDir } from './frameworks-landscape.service';

/**
 * Overview 구성 — 단일 JSON 파일(DB 미사용).
 * 파일: DATA_DIR/overview/overview-config.json
 * 생성/재생성: apps/api/scripts/generate-frameworks-landscape.cjs (generateOverview)
 * 기획서: apps/docs/overview-builder-admin-plan.md
 *
 * P2 범위: 읽기(GET)만. 관리자 쓰기(PUT/DELETE)는 P3에서 추가.
 */
export interface OverviewItem {
  entityKey: string;
  name: string;
  desc: string;
  url: string;
  stars: number | null;
  icon: string | null;
  topic: string;
  type: string;
}
type Source = 'auto' | 'admin';
export interface OverviewConfig {
  page: string;
  generatedAt: string;
  source: string;
  title: { source: Source; updatedAt: string; updatedBy: string | null; heading: string; subheading: string };
  hero: { source: Source; updatedAt: string; updatedBy: string | null; items: OverviewItem[] };
  spotlight: { source: Source; updatedAt: string; updatedBy: string | null; label: string; sub: string; items: OverviewItem[] };
  justAdded: { source: Source; updatedAt: string; updatedBy: string | null; label: string; sub: string; items: OverviewItem[] };
  blocks: Array<{ key: string; source: Source; updatedAt: string; updatedBy: string | null; title: string; banner: OverviewItem[]; rows: OverviewItem[] }>;
}

export function overviewFile(): string {
  return path.join(dataDir(), 'overview', 'overview-config.json');
}

@Injectable()
export class OverviewConfigService {
  private readonly logger = new Logger(OverviewConfigService.name);

  async getConfig(): Promise<OverviewConfig | { page: string; generatedAt: string; categories: [] }> {
    const file = overviewFile();
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as OverviewConfig;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`overview config 읽기 실패(${file}): ${msg}`);
      return { page: 'overview', generatedAt: '', categories: [] };
    }
  }

  /* ── 관리자 쓰기 (ADMIN 전용, P3) ── */

  private async readRaw(): Promise<OverviewConfig> {
    try {
      return JSON.parse(await fs.readFile(overviewFile(), 'utf8')) as OverviewConfig;
    } catch {
      throw new NotFoundException('overview config가 아직 생성되지 않았습니다. 자동 생성 스크립트를 먼저 실행하세요.');
    }
  }
  private async write(cfg: OverviewConfig): Promise<void> {
    const file = overviewFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(cfg, null, 2));
  }

  /** 슬롯 저장 — 관리자가 고른 값으로 덮어쓰고 source='admin'. slot = title|hero|spotlight|justAdded|block:<key> */
  async saveSlot(slot: string, body: any, updatedBy: string | null): Promise<OverviewConfig> {
    const cfg = await this.readRaw();
    const now = new Date().toISOString();
    const stamp = { source: 'admin' as const, updatedAt: now, updatedBy };

    if (slot === 'title') {
      cfg.title = { ...stamp, heading: String(body?.heading ?? cfg.title.heading), subheading: String(body?.subheading ?? cfg.title.subheading) };
    } else if (slot === 'hero') {
      cfg.hero = { ...stamp, items: asItems(body?.items) };
    } else if (slot === 'spotlight') {
      cfg.spotlight = { ...stamp, label: body?.label ?? cfg.spotlight.label, sub: body?.sub ?? cfg.spotlight.sub, items: asItems(body?.items) };
    } else if (slot === 'justAdded') {
      cfg.justAdded = { ...stamp, label: body?.label ?? cfg.justAdded.label, sub: body?.sub ?? cfg.justAdded.sub, items: asItems(body?.items) };
    } else if (slot.startsWith('block:')) {
      const key = slot.slice(6);
      const b = cfg.blocks.find((x) => x.key === key);
      if (!b) throw new NotFoundException(`unknown block: ${key}`);
      b.source = 'admin'; b.updatedAt = now; b.updatedBy = updatedBy;
      if (body?.title != null) b.title = String(body.title);
      if (body?.banner != null) b.banner = asItems(body.banner);
      if (body?.rows != null) b.rows = asItems(body.rows);
    } else {
      throw new BadRequestException(`unknown slot: ${slot}`);
    }

    await this.write(cfg);
    return cfg;
  }

  /** 슬롯 자동 리셋 — source='auto'로 되돌리고 생성 스크립트 재실행(auto 재계산, 다른 admin 슬롯은 보존) */
  async resetSlot(slot: string): Promise<OverviewConfig | { page: string; generatedAt: string; categories: [] }> {
    const cfg = await this.readRaw();
    if (slot === 'title') cfg.title.source = 'auto';
    else if (slot.startsWith('block:')) {
      const b = cfg.blocks.find((x) => x.key === slot.slice(6));
      if (!b) throw new NotFoundException(`unknown block: ${slot.slice(6)}`);
      b.source = 'auto';
    } else if (['hero', 'spotlight', 'justAdded'].includes(slot)) {
      (cfg as any)[slot].source = 'auto';
    } else throw new BadRequestException(`unknown slot: ${slot}`);

    await this.write(cfg);
    await this.regenerate();
    return this.getConfig();
  }

  /** 생성 스크립트 실행(자동 로직 단일 소스). auto 슬롯 재계산 + admin 슬롯 표시데이터 갱신. */
  async regenerate(): Promise<void> {
    const sp = this.scriptPath();
    if (!sp) {
      this.logger.warn('생성 스크립트를 찾지 못함 — 리셋/재생성은 다음 수동 생성 시 반영됩니다.');
      return;
    }
    await new Promise<void>((resolve) => {
      execFile('node', [sp], { timeout: 60_000 }, (err) => {
        if (err) this.logger.error(`regenerate 실패: ${err.message}`);
        resolve();
      });
    });
  }

  private scriptPath(): string | null {
    const rel = 'scripts/generate-frameworks-landscape.cjs';
    const candidates = [
      path.resolve(process.cwd(), rel),
      path.resolve(__dirname, '../../../', rel),
      path.resolve(__dirname, '../../../../', rel),
    ];
    return candidates.find((p) => existsSync(p)) ?? null;
  }
}

/** 항목 배열 최소 검증 — 관리자 클라이언트가 해석해 보낸 형태 그대로 저장 */
function asItems(arr: any): OverviewItem[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x.name === 'string' && typeof x.url === 'string')
    .map((x) => ({
      entityKey: String(x.entityKey ?? `${x.type}|${x.name}`),
      name: String(x.name),
      desc: String(x.desc ?? ''),
      url: String(x.url),
      stars: x.stars == null ? null : Number(x.stars),
      icon: x.icon == null ? null : String(x.icon),
      topic: String(x.topic ?? ''),
      type: String(x.type ?? ''),
    }));
}
