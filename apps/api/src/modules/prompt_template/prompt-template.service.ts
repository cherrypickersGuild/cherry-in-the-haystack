import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { v7 as uuidv7 } from 'uuid';
import type { CreateTemplateDto } from './input-dto/create-template.dto';
import type { UpdateTemplateDto } from './input-dto/update-template.dto';
import type { CreateVersionDto } from './input-dto/create-version.dto';
import type { UpdateVersionDto } from './input-dto/update-version.dto';

/** version_no → A, B, C, ... Z, AA, AB ... */
function versionTag(n: number): string {
  let tag = '';
  let num = n;
  while (num > 0) {
    num--;
    tag = String.fromCharCode(65 + (num % 26)) + tag;
    num = Math.floor(num / 26);
  }
  return tag;
}

const T_TEMPLATE = 'core.prompt_template';
const T_VERSION = 'core.prompt_template_version';

@Injectable()
export class PromptTemplateService {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  /** code로 템플릿 조회 (내부 헬퍼) */
  private async getTemplateByCode(code: string) {
    const template = await this.knex(T_TEMPLATE)
      .where({ code })
      .whereNull('revoked_at')
      .first();

    if (!template) throw new NotFoundException(`템플릿을 찾을 수 없습니다: ${code}`);
    return template;
  }

  /** id로 템플릿 조회 (내부 헬퍼) */
  private async getTemplateById(id: string) {
    const template = await this.knex(T_TEMPLATE)
      .where({ id })
      .whereNull('revoked_at')
      .first();

    if (!template) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    return template;
  }

  /** 전체 템플릿 + 각 버전 조회 */
  async findAll() {
    const templates = await this.knex(T_TEMPLATE)
      .whereNull('revoked_at')
      .orderBy('created_at', 'desc')
      .select('*');

    return this.attachVersions(templates);
  }

  /** 템플릿 배열에 버전 목록을 붙여 반환 (공통 헬퍼) */
  private async attachVersions(templates: { id: string }[]) {
    const ids = templates.map((t) => t.id);
    if (ids.length === 0) return [];

    const versions = await this.knex(T_VERSION)
      .whereIn('prompt_template_id', ids)
      .whereNull('revoked_at')
      .orderBy('version_no', 'desc')
      .select('*');

    const versionMap = new Map<string, unknown[]>();
    for (const v of versions) {
      const tid = (v as { prompt_template_id: string }).prompt_template_id;
      if (!versionMap.has(tid)) versionMap.set(tid, []);
      versionMap.get(tid)!.push(v);
    }

    return templates.map((t) => ({
      ...t,
      versions: versionMap.get(t.id) ?? [],
    }));
  }

  /** type으로 템플릿 목록 + 각 버전 조회 */
  async findByType(type: string) {
    const templates = await this.knex(T_TEMPLATE)
      .where({ type })
      .whereNull('revoked_at')
      .orderBy('created_at', 'desc')
      .select('*');

    return this.attachVersions(templates);
  }

  /** code로 버전 목록만 조회 */
  async findVersionsByCode(code: string) {
    const template = await this.getTemplateByCode(code);

    return this.knex(T_VERSION)
      .where({ prompt_template_id: template.id })
      .whereNull('revoked_at')
      .orderBy('version_no', 'desc')
      .select('*');
  }

  /** 템플릿 + 초기 버전 생성 (트랜잭션) */
  async create(dto: CreateTemplateDto) {
    const templateId = uuidv7();
    const versionId = uuidv7();
    const now = new Date();

    try {
      await this.knex.transaction(async (trx) => {
        await trx(T_TEMPLATE).insert({
          id: templateId,
          scope: 'PLATFORM',
          type: dto.type,
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          tone_text: dto.tone_text,
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        await trx(T_VERSION).insert({
          id: versionId,
          prompt_template_id: templateId,
          version_no: 1,
          version_tag: 'A',
          prompt_text: dto.prompt_text,
          few_shot_examples: dto.few_shot_examples ?? null,
          parameters_json: dto.parameters_json
            ? JSON.stringify(dto.parameters_json)
            : null,
          change_note: dto.change_note ?? '초기 버전',
          is_active: true,
          created_at: now,
          updated_at: now,
        });
      });
    } catch (err: unknown) {
      const dbErr = err as { constraint?: string };
      if (dbErr.constraint === 'uq_prompt_template_platform_active') {
        throw new ConflictException(
          `동일한 type·code 조합이 이미 존재합니다: ${dto.type} / ${dto.code}`,
        );
      }
      throw err;
    }

    return this.findByType(dto.type);
  }

  /** 템플릿 메타 수정 (name, description, tone_text) */
  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.getTemplateById(id);

    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields.name = dto.name;
    if (dto.description !== undefined) fields.description = dto.description;
    if (dto.tone_text !== undefined) fields.tone_text = dto.tone_text;

    if (Object.keys(fields).length > 0) {
      await this.knex(T_TEMPLATE).where({ id }).update(fields);
    }

    return this.findByType(template.type);
  }

  /** 소프트 삭제 (revoked_at 기록) */
  async softDelete(id: string) {
    await this.getTemplateById(id);

    await this.knex(T_TEMPLATE).where({ id }).update({
      revoked_at: new Date(),
      is_active: false,
    });

    return { deleted: true, id };
  }

  /* ═══════════════════════════════════════════
     버전 CRUD
  ═══════════════════════════════════════════ */

  /** 버전 추가 (다음 태그 자동 부여: A → B → C ...) */
  async createVersion(templateId: string, dto: CreateVersionDto) {
    await this.getTemplateById(templateId);

    // 현재 최대 version_no 조회
    const maxRow = await this.knex(T_VERSION)
      .where({ prompt_template_id: templateId })
      .whereNull('revoked_at')
      .max('version_no as max')
      .first();

    const nextNo = ((maxRow?.max as number) ?? 0) + 1;
    const id = uuidv7();
    const now = new Date();

    await this.knex(T_VERSION).insert({
      id,
      prompt_template_id: templateId,
      version_no: nextNo,
      version_tag: versionTag(nextNo),
      prompt_text: dto.prompt_text,
      few_shot_examples: dto.few_shot_examples ?? null,
      parameters_json: dto.parameters_json
        ? JSON.stringify(dto.parameters_json)
        : null,
      change_note: dto.change_note ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    return this.knex(T_VERSION).where({ id }).first();
  }

  /** 버전 수정 */
  async updateVersion(templateId: string, versionId: string, dto: UpdateVersionDto) {
    const version = await this.knex(T_VERSION)
      .where({ id: versionId, prompt_template_id: templateId })
      .whereNull('revoked_at')
      .first();

    if (!version) throw new NotFoundException('버전을 찾을 수 없습니다.');

    const fields: Record<string, unknown> = {};
    if (dto.prompt_text !== undefined) fields.prompt_text = dto.prompt_text;
    if (dto.few_shot_examples !== undefined) fields.few_shot_examples = dto.few_shot_examples;
    if (dto.parameters_json !== undefined) {
      fields.parameters_json = JSON.stringify(dto.parameters_json);
    }
    if (dto.change_note !== undefined) fields.change_note = dto.change_note;

    if (Object.keys(fields).length > 0) {
      await this.knex(T_VERSION).where({ id: versionId }).update(fields);
    }

    return this.knex(T_VERSION).where({ id: versionId }).first();
  }

  /** 활성 버전 지정 (해당 템플릿 내 다른 버전은 비활성) */
  async activateVersion(templateId: string, versionId: string) {
    const version = await this.knex(T_VERSION)
      .where({ id: versionId, prompt_template_id: templateId })
      .whereNull('revoked_at')
      .first();

    if (!version) throw new NotFoundException('버전을 찾을 수 없습니다.');

    await this.knex.transaction(async (trx) => {
      // 같은 템플릿의 모든 버전을 비활성
      await trx(T_VERSION)
        .where({ prompt_template_id: templateId })
        .whereNull('revoked_at')
        .update({ is_active: false });

      // 지정된 버전만 활성
      await trx(T_VERSION)
        .where({ id: versionId })
        .update({ is_active: true });
    });

    return this.knex(T_VERSION).where({ id: versionId }).first();
  }

  /** 버전 소프트 삭제 */
  async softDeleteVersion(templateId: string, versionId: string) {
    const version = await this.knex(T_VERSION)
      .where({ id: versionId, prompt_template_id: templateId })
      .whereNull('revoked_at')
      .first();

    if (!version) throw new NotFoundException('버전을 찾을 수 없습니다.');

    await this.knex(T_VERSION).where({ id: versionId }).update({
      revoked_at: new Date(),
      is_active: false,
    });

    return { deleted: true, id: versionId };
  }
}
