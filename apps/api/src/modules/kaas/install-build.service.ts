/**
 * InstallBuildService — one-call orchestrator for "push Workshop build to
 * a connected Claude Code agent".
 *
 * High-level flow (4 gates + install + cleanup, per
 * `apps/docs/install-skill/1-work-guidelines.md §3-2`):
 *   1. Promise-share lock   — 중복 요청은 진행중 Promise 반환
 *   2. agent ownership      — 403 if not the caller's agent
 *   3. MCP connection       — 409 if agent not connected (isAgentConnected)
 *   4. empty build          — 400 if every slot is null
 *   5. serialize → save     — limited parallel save_skill_request (3 동시)
 *   6. atomic cleanup       — 신규 save 전부 성공한 경우에만 고아 cherry-* 삭제
 *   7. self-report refresh  — 에이전트 재스캔 후 local_skills 반환
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  buildActivationPrompt,
  buildMetaSkillFile,
  cardToSkillFile,
  collectSkillFiles,
  getPrimaryTag,
  toSavePayload,
  type BuildContext,
  type SkillFile,
  type SkipEntry,
} from '../bench/cards/serialize';
import type { AgentBuildInput } from '../bench/cards/compose-runtime';
import { KaasAgentService } from './kaas-agent.service';
import { KaasWsGateway } from './kaas-ws.gateway';

export interface InstallBuildRequest {
  build_id: string;
  build_name: string;
  equipped: AgentBuildInput;
}

export interface InstalledEntry {
  slot: string;
  card_id: string;
  dir: string;
  file: string;
  saved_path: string;
  size_bytes: number;
}

export interface FailedEntry {
  slot: string;
  card_id: string;
  error: string;
}

export interface InstallBuildResponse {
  installed: InstalledEntry[];
  skipped: SkipEntry[];
  failed: FailedEntry[];
  meta_written: boolean;
  orphans_removed: string[];
  local_skills_after: Array<{
    dir: string;
    hasSkillMd: boolean;
    sizeBytes: number;
    mtime: string | null;
  }>;
  warnings: string[];
  /** Copy-ready natural-language prompt that activates the installed mode
   *  in Claude Code. e.g. "cherry quant 로 Compare BTC, ETH, ..." */
  activation_prompt: string;
}

const SAVE_TIMEOUT_MS = 10_000;
const DELETE_TIMEOUT_MS = 10_000;
const MAX_PARALLEL_SAVES = 3;

@Injectable()
export class InstallBuildService {
  private readonly logger = new Logger(InstallBuildService.name);

  /** agentId 별 진행 중 Promise. 중복 요청은 진행중을 공유 (409 안 씀). */
  private readonly inFlight = new Map<string, Promise<InstallBuildResponse>>();

  constructor(
    private readonly ws: KaasWsGateway,
    private readonly agents: KaasAgentService,
  ) {}

  /** classifyResult — HTTP 상태 결정 헬퍼. */
  classifyResult(r: InstallBuildResponse): number {
    if (r.failed.length === 0) return 200;
    if (
      r.installed.length === 0 &&
      r.failed.every((f) => /timeout/i.test(f.error))
    ) {
      return 504;
    }
    return 207;
  }

  async install(
    userId: string,
    agentId: string,
    build: InstallBuildRequest,
  ): Promise<InstallBuildResponse> {
    // Gate 0 — request shape sanity. Never let bad input reach runInstall.
    if (!build || typeof build !== 'object') {
      throw new HttpException(
        { code: 'BAD_REQUEST_BODY', message: 'install-build: body missing' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!build.equipped || typeof build.equipped !== 'object') {
      throw new HttpException(
        {
          code: 'BAD_REQUEST_SHAPE',
          message:
            "install-build: `equipped` must be an object with 7 slot keys (all values nullable). Got: " +
            JSON.stringify(build.equipped),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Gate 1 — Promise-share lock
    const existing = this.inFlight.get(agentId);
    if (existing) {
      this.logger.log(
        `[install-build agent=${agentId.slice(0, 8)} build=${build.build_id}] joining in-flight install`,
      );
      return existing;
    }

    // `.finally()` is chained to the RETURNED Promise so:
    //   (a) every rejection flows to the awaiting caller — no orphan Promise
    //   (b) inFlight map is always cleaned up even on unexpected throws
    //   (c) Nest's built-in HttpException filter handles 4xx/5xx responses
    //
    // Wrap runInstall in a defensive block: known HttpExceptions pass through
    // as-is, any unexpected error is logged + converted to a 500 so Nest can
    // still return a structured response (never a process-level crash).
    const run = this.runInstall(userId, agentId, build)
      .catch((err: unknown) => {
        if (err instanceof HttpException) throw err; // known, let Nest handle
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[install-build agent=${agentId.slice(0, 8)} build=${build.build_id}] unexpected error: ${msg}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new HttpException(
          { code: 'INSTALL_INTERNAL_ERROR', message: `install failed: ${msg}` },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      })
      .finally(() => {
        this.inFlight.delete(agentId);
      });
    this.inFlight.set(agentId, run);
    return run;
  }

  private async runInstall(
    userId: string,
    agentId: string,
    build: InstallBuildRequest,
  ): Promise<InstallBuildResponse> {
    // Gate 2 — agent ownership
    const agent = await this.agents.findById(agentId);
    if (!agent) {
      throw new HttpException(
        { code: 'AGENT_NOT_FOUND', message: 'Agent not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (agent.user_id !== userId) {
      throw new HttpException(
        { code: 'AGENT_NOT_OWNED', message: 'Not your agent' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Gate 3 — MCP connection (cheap pre-check, prevents 30s hang)
    if (!this.ws.isAgentConnected(agentId)) {
      throw new HttpException(
        {
          code: 'AGENT_OFFLINE',
          message:
            "Agent not connected. Run 'claude' with the cherry-kaas MCP registered.",
        },
        HttpStatus.CONFLICT,
      );
    }

    // Gate 4 — empty build
    const equippedCount = Object.values(build.equipped).filter(Boolean).length;
    if (equippedCount === 0) {
      throw new HttpException(
        {
          code: 'BUILD_EMPTY',
          message: 'Build is empty — nothing to install.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const runId = uuidv4().replace(/-/g, '').slice(0, 8);
    const agentShort = agentId.slice(0, 8);
    const logPrefix = `[install-build agent=${agentShort} build=${build.build_id} run=${runId}]`;
    this.logger.log(`${logPrefix} start · slots=${equippedCount}`);

    const ctx: BuildContext = {
      buildId: build.build_id,
      buildName: build.build_name,
      agentId,
      installedAt: new Date().toISOString(),
      runId,
    };

    // ── 1. Serialize ──
    const { files, skipped } = collectSkillFiles(build.equipped, ctx);
    const metaFile = buildMetaSkillFile(build.equipped, ctx);

    // Unknown card ids (cardId given but cardToSkillFile returned null) —
    // detect by comparing against equipped slots
    const failed: FailedEntry[] = [];
    const regularSlots = ['prompt', 'skillA', 'skillB', 'skillC'] as const;
    for (const slot of regularSlots) {
      const cardId = build.equipped[slot];
      if (!cardId) continue;
      const matched = files.find((f) => f.slot === slot);
      if (!matched) {
        // unknown card id OR type mismatch — record as failed
        failed.push({
          slot,
          card_id: cardId,
          error: 'unknown or invalid card id for this slot',
        });
      }
    }

    // ── 2. Save (limited parallel, individual 10s timeout) ──
    const allToSave: SkillFile[] = metaFile ? [...files, metaFile] : [...files];
    const saveResults = await this.limitedParallel(
      MAX_PARALLEL_SAVES,
      allToSave,
      async (file) => {
        const payload = toSavePayload(file, () => uuidv4());
        const started = Date.now();
        try {
          const ack = await this.withTimeout(
            this.ws.requestSaveSkill(agentId, payload),
            SAVE_TIMEOUT_MS,
            'save_skill timeout',
          );
          this.logger.log(
            `${logPrefix} save-skill ${file.slot} ${file.dir} → saved ${ack.size_bytes}B in ${Date.now() - started}ms`,
          );
          return { ok: true as const, file, ack };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `${logPrefix} save-skill ${file.slot} ${file.dir} → FAILED (${msg})`,
          );
          return { ok: false as const, file, error: msg };
        }
      },
    );

    // ── 3. Aggregate ──
    const installed: InstalledEntry[] = [];
    let metaWritten = false;
    for (const r of saveResults) {
      if (r.ok) {
        if (r.file.slot === '_meta') {
          metaWritten = true;
        } else {
          installed.push({
            slot: r.file.slot,
            card_id: r.file.cardId,
            dir: r.file.dir,
            file: r.file.file,
            saved_path: r.ack.saved_path,
            size_bytes: r.ack.size_bytes,
          });
        }
      } else {
        failed.push({
          slot: r.file.slot,
          card_id: r.file.cardId,
          error: r.error,
        });
      }
    }

    // ── 4. Atomic cleanup — 전부 성공일 때만 고아 정리 ──
    let orphansRemoved: string[] = [];
    if (failed.length === 0) {
      const keepDirs = new Set<string>(allToSave.map((f) => f.dir));
      orphansRemoved = await this.cleanupOrphans(agentId, keepDirs, logPrefix);
    } else {
      this.logger.log(
        `${logPrefix} skipping orphan cleanup (failed=${failed.length})`,
      );
    }

    // ── 5. Self-report refresh ──
    let localSkillsAfter: InstallBuildResponse['local_skills_after'] = [];
    try {
      const report = await this.withTimeout(
        this.ws.requestSelfReport(agentId),
        15_000,
        'self_report timeout',
      );
      const items = report?.report?.local_skills?.items;
      if (Array.isArray(items)) localSkillsAfter = items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`${logPrefix} self-report refresh failed: ${msg}`);
    }

    const tag = getPrimaryTag(build.equipped.prompt);
    const activationPrompt = buildActivationPrompt(build.equipped.prompt);
    const result: InstallBuildResponse = {
      installed,
      skipped,
      failed,
      meta_written: metaWritten,
      orphans_removed: orphansRemoved,
      local_skills_after: localSkillsAfter,
      warnings: this.buildWarnings(tag),
      activation_prompt: activationPrompt,
    };

    this.logger.log(
      `${logPrefix} done · installed=${installed.length} meta_written=${metaWritten} failed=${failed.length} orphans=${orphansRemoved.length}`,
    );

    return result;
  }

  /** 고아 cherry-* 디렉토리 정리. keepDirs 에 없는 것만 삭제. */
  private async cleanupOrphans(
    agentId: string,
    keepDirs: Set<string>,
    logPrefix: string,
  ): Promise<string[]> {
    let existing: Array<{ dir: string }> = [];
    try {
      const report = await this.withTimeout(
        this.ws.requestSelfReport(agentId),
        15_000,
        'self_report timeout (pre-cleanup)',
      );
      const items = report?.report?.local_skills?.items;
      if (Array.isArray(items)) existing = items;
    } catch (err) {
      this.logger.warn(
        `${logPrefix} pre-cleanup self-report failed, skipping orphan sweep: ${(err as Error).message}`,
      );
      return [];
    }

    const orphans = existing
      .map((i) => i.dir)
      .filter((d) => typeof d === 'string')
      .filter((d) => /^cherry-/.test(d))
      .filter((d) => !keepDirs.has(d));

    if (orphans.length === 0) return [];

    this.logger.log(`${logPrefix} orphans_to_remove=[${orphans.join(', ')}]`);

    const removed: string[] = [];
    for (const dir of orphans) {
      try {
        const ack = await this.withTimeout(
          this.ws.requestDeleteSkill(
            agentId,
            {
              request_id: uuidv4(),
              target_dir: `~/.claude/skills/${dir}`,
            },
            DELETE_TIMEOUT_MS,
          ),
          DELETE_TIMEOUT_MS,
          'delete_skill timeout',
        );
        if (ack.deleted) {
          removed.push(dir);
          this.logger.log(`${logPrefix}   ✓ removed orphan ${dir}`);
        } else {
          this.logger.warn(
            `${logPrefix}   - orphan ${dir} not removed: ${ack.error_reason ?? 'unknown'}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `${logPrefix}   ✗ delete ${dir} failed: ${(err as Error).message}`,
        );
      }
    }
    return removed;
  }

  /** BMad-style mode trigger 안내.
   *  Claude Code 는 SKILL.md 를 "참고 가능한 스킬" 로 로드한다.
   *  강제 system prompt 로 주입되진 않지만, description 에 명시된 트리거
   *  키워드를 사용자가 자연어로 말하면 Claude 가 해당 모드 body 를 적용한다.
   *  예: "cherry quant 로 BTC ETH 분석해줘"  → quant mode 활성화 */
  private buildWarnings(tag: string): string[] {
    if (!tag || tag === 'cherry') {
      return ['Say "cherry mode" in Claude Code to activate this build.'];
    }
    return [
      `Activation trigger: say "cherry ${tag}" or "${tag} 모드로 ..." in Claude Code.`,
      `Example: "cherry ${tag} 로 관련 작업 해줘"`,
    ];
  }

  /** 최대 `concurrency` 동시 실행 + 순서 유지. */
  private async limitedParallel<T, R>(
    concurrency: number,
    items: T[],
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let idx = 0;
    const runners = new Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(async () => {
        while (true) {
          const i = idx++;
          if (i >= items.length) return;
          results[i] = await worker(items[i]);
        }
      });
    await Promise.all(runners);
    return results;
  }

  private withTimeout<T>(
    p: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(label)), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }
}
